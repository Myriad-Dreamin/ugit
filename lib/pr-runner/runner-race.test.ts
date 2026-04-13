import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
import type { ValidatedPullRequestSyncRequest } from "@/lib/pr-runner/validation";

const { executeWorkflowPackages, writeCiResultArtifact } = vi.hoisted(() => ({
  executeWorkflowPackages: vi.fn(),
  writeCiResultArtifact: vi.fn(),
}));

vi.mock("@/lib/pr-runner/results", () => ({
  writeCiResultArtifact,
}));

vi.mock("@/lib/pr-runner/workflows", () => ({
  executeWorkflowPackages,
}));

import {
  SUPERSEDED_CI_JOB_MESSAGE,
  claimRunnableJobs,
  queuePullRequestSynchronization,
  readCiJob,
  readPullRequest,
} from "@/lib/pr-runner/storage";
import { executeCiJob, resetPullRequestRunnerForTests } from "@/lib/pr-runner/runner";

const workspaces: string[] = [];

beforeEach(() => {
  executeWorkflowPackages.mockReset();
  writeCiResultArtifact.mockReset();
  executeWorkflowPackages.mockResolvedValue({
    success: true,
    workflows: [],
  });
  writeCiResultArtifact.mockReturnValue("/tmp/ci-result.json");
});

afterEach(() => {
  resetPullRequestRunnerForTests();
  resetStorageCacheForTests();

  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("executeCiJob merge races", () => {
  it("does not reach update-ref when a newer sync takes ownership during merge preflight", async () => {
    const workspace = createWorkspace();
    const repositoryPath = path.join(workspace, "repos", "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const updateRefCalls: string[][] = [];
    let queuedNewerJob = false;

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef1"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    const [runningJob] = claimRunnableJobs({
      storage,
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
    });

    if (!runningJob) {
      throw new Error("Expected the initial synchronization to claim job-1.");
    }

    const runCommand = vi.fn(async (_command: string, args: readonly string[]) => {
      if (args.includes("worktree") && args.includes("add")) {
        return {
          exitCode: 0,
          stdout: "",
          stderr: "",
        };
      }

      if (args.includes("rev-parse")) {
        return {
          exitCode: 0,
          stdout: "base-commit",
          stderr: "",
        };
      }

      if (args.includes("merge-base")) {
        return {
          exitCode: 0,
          stdout: "",
          stderr: "",
        };
      }

      if (args.includes("symbolic-ref")) {
        if (!queuedNewerJob) {
          queuedNewerJob = true;

          queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef2"), {
            storage,
            now: createNowFactory("2026-04-14T00:00:20.000Z"),
            jobIdFactory: createJobIdFactory("job-2"),
          });
        }

        return {
          exitCode: 0,
          stdout: "feature/other",
          stderr: "",
        };
      }

      if (args.includes("update-ref")) {
        updateRefCalls.push([...args]);

        return {
          exitCode: 0,
          stdout: "",
          stderr: "",
        };
      }

      if (args.includes("worktree") && args.includes("remove")) {
        return {
          exitCode: 0,
          stdout: "",
          stderr: "",
        };
      }

      throw new Error(`Unexpected git command: ${args.join(" ")}`);
    });

    await executeCiJob(runningJob, {
      storage,
      now: createNowFactory("2026-04-14T00:00:30.000Z"),
      runCommand,
    });

    expect(updateRefCalls).toHaveLength(0);
    expect(writeCiResultArtifact).not.toHaveBeenCalled();
    expect(readCiJob("job-1", storage)).toMatchObject({
      id: "job-1",
      status: "superseded",
      errorMessage: SUPERSEDED_CI_JOB_MESSAGE,
    });
    expect(readCiJob("job-2", storage)).toMatchObject({
      id: "job-2",
      status: "queued",
      commitHash: "abcdef2",
    });
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      latestJobId: "job-2",
      headCommitHash: "abcdef2",
      status: "queued",
    });
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-pr-runner-race-"));

  workspaces.push(workspace);

  return workspace;
}

function createRequest(
  repositoryPath: string,
  commitHash: string,
  branchName: string = "feature/test",
): ValidatedPullRequestSyncRequest {
  return {
    repositoryName: path.basename(repositoryPath),
    repositoryPath,
    publishedBranch: {
      repositoryPath,
      branchName,
      commitHash,
      remoteName: "origin",
    },
    pullRequest: {
      repositoryPath,
      branchName,
      baseBranch: "main",
      title: `Sync ${branchName}`,
      body: "Synchronize the pull request.",
      draft: false,
      remoteName: "origin",
    },
  };
}

function createJobIdFactory(...jobIds: string[]): () => string {
  let index = 0;

  return () => {
    const jobId = jobIds[Math.min(index, jobIds.length - 1)];

    index += 1;

    return jobId;
  };
}

function createNowFactory(...timestamps: string[]): () => Date {
  let index = 0;

  return () => {
    const timestamp = timestamps[Math.min(index, timestamps.length - 1)];

    index += 1;

    return new Date(timestamp);
  };
}
