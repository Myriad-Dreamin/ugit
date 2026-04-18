import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAsyncCommand } from "@/lib/pr-runner/process";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
import type { ValidatedPullRequestSyncRequest } from "@/lib/pr-runner/validation";

const { attemptFastForwardMerge, executeWorkflowPackages, writeCiResultArtifact } = vi.hoisted(
  () => ({
    attemptFastForwardMerge: vi.fn(),
    executeWorkflowPackages: vi.fn(),
    writeCiResultArtifact: vi.fn(),
  }),
);

vi.mock("@/lib/pr-runner/merge", () => ({
  attemptFastForwardMerge,
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
  attemptFastForwardMerge.mockReset();
  executeWorkflowPackages.mockReset();
  writeCiResultArtifact.mockReset();
  attemptFastForwardMerge.mockResolvedValue({
    status: "succeeded",
    message: "Fast-forwarded main to the queued commit.",
  });
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

describe("executeCiJob", () => {
  it("keeps pull-request CI on an ephemeral detached worktree", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createGitRepository(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const commitHash = readGitOutput(repositoryPath, "rev-parse", "HEAD");

    queuePullRequestSynchronization(createRequest(repositoryPath, commitHash), {
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    const [runningJob] = claimRunnableJobs({
      storage,
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
    });

    if (!runningJob) {
      throw new Error("Expected the synchronization to claim job-1.");
    }

    const runCommand = vi.fn(runAsyncCommand);

    await executeCiJob(runningJob, {
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      runCommand,
    });

    const addedWorktreePath = findWorktreePath(runCommand, "add");
    const removedWorktreePath = findWorktreePath(runCommand, "remove");

    expect(addedWorktreePath).not.toBe(path.join(repositoryPath, "workflow1"));
    expect(removedWorktreePath).toBe(addedWorktreePath);
    expect(existsSync(addedWorktreePath)).toBe(false);
    expect(existsSync(path.join(repositoryPath, "workflow1"))).toBe(false);
    expect(readCiJob("job-1", storage)).toMatchObject({
      id: "job-1",
      status: "succeeded",
      mergeStatus: "succeeded",
    });
  });

  it("skips merge and artifact publication when a newer sync supersedes the running job", async () => {
    const workspace = createWorkspace();
    const repositoryPath = path.join(workspace, "repos", "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

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

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef2"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      jobIdFactory: createJobIdFactory("job-2"),
    });

    const runCommand = vi.fn(async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }));

    await executeCiJob(runningJob, {
      storage,
      now: createNowFactory("2026-04-14T00:00:30.000Z"),
      runCommand,
    });

    expect(executeWorkflowPackages).toHaveBeenCalledTimes(1);
    expect(attemptFastForwardMerge).not.toHaveBeenCalled();
    expect(writeCiResultArtifact).not.toHaveBeenCalled();
    expect(readCiJob("job-1", storage)).toMatchObject({
      id: "job-1",
      status: "superseded",
      errorMessage: SUPERSEDED_CI_JOB_MESSAGE,
    });
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      latestJobId: "job-2",
      headCommitHash: "abcdef2",
      status: "queued",
    });
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-pr-runner-"));

  workspaces.push(workspace);

  return workspace;
}

function createGitRepository(workspace: string, repositoryName: string): string {
  const repositoryPath = path.join(workspace, "repos", repositoryName);

  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "--quiet", repositoryPath], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "config", "user.name", "ugit-test"], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "config", "user.email", "ugit@example.com"], {
    stdio: "ignore",
  });

  writeFileSync(path.join(repositoryPath, "README.md"), "# alpha\n", "utf8");
  execFileSync("git", ["-C", repositoryPath, "add", "README.md"], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "commit", "-q", "-m", "init"], {
    stdio: "ignore",
  });

  return repositoryPath;
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

function findWorktreePath(runCommand: ReturnType<typeof vi.fn>, action: "add" | "remove"): string {
  const call = runCommand.mock.calls.find(
    ([, args]) => args.includes("worktree") && args.includes(action),
  );

  if (!call) {
    throw new Error(`Expected to capture a git worktree ${action} command.`);
  }

  return String(call[1][call[1].length - (action === "add" ? 2 : 1)]);
}

function readGitOutput(repositoryPath: string, ...args: string[]): string {
  return execFileSync("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
