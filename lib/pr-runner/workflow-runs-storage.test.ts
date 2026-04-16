import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
import type { ValidatedPullRequestSyncRequest } from "@/lib/pr-runner/validation";
import type { ValidatedWorkflowRunRequest } from "@/lib/workflow-runs/validation";
import {
  claimRunnableExecutions,
  listWorkflowRuns,
  queuePullRequestSynchronization,
  queueWorkflowRun,
  readWorkflowRun,
  readWorkflowRunForRepository,
} from "@/lib/pr-runner/storage";

const workspaces: string[] = [];

afterEach(() => {
  resetStorageCacheForTests();

  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("queueWorkflowRun", () => {
  it("persists workflow-run metadata and shared queue position", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createPullRequestRequest(repositoryPath, "abcdef1"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createIdFactory("job-1"),
    });

    const queued = queueWorkflowRun(createWorkflowRequest(repositoryPath, "abcdef2", "lint"), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
    });

    expect(queued.queuePosition).toBe(2);
    expect(readWorkflowRun("workflow-1", storage)).toMatchObject({
      id: "workflow-1",
      branchName: "feature/test",
      commitHash: "abcdef2",
      workflowName: "lint",
      status: "queued",
    });
    expect(readWorkflowRun("workflow-1", storage)?.logPath).toBe(
      path.resolve(workspace, ".data", "workflow-run-logs", "alpha", "workflow-1.log"),
    );
  });
});

describe("claimRunnableExecutions", () => {
  it("shares one scheduler across pull requests and manual workflow runs", () => {
    const workspace = createWorkspace();
    const repositoryA = createRepositorySkeleton(workspace, "alpha");
    const repositoryB = createRepositorySkeleton(workspace, "beta");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createPullRequestRequest(repositoryA, "abcdef1"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createIdFactory("job-1"),
    });
    queueWorkflowRun(createWorkflowRequest(repositoryA, "abcdef2", "lint"), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
    });
    queueWorkflowRun(createWorkflowRequest(repositoryB, "fedcba9", "test"), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      workflowIdFactory: createIdFactory("workflow-2"),
    });

    expect(
      claimRunnableExecutions({
        storage,
        now: createNowFactory("2026-04-14T00:00:30.000Z"),
      }),
    ).toEqual([
      expect.objectContaining({
        kind: "pull_request",
        id: "job-1",
        repositoryPath: repositoryA,
      }),
      expect.objectContaining({
        kind: "workflow_run",
        id: "workflow-2",
        repositoryPath: repositoryB,
      }),
    ]);
  });
});

describe("repo-scoped workflow run reads", () => {
  it("lists only workflow runs for the requested repository in reverse update order", () => {
    const workspace = createWorkspace();
    const repositoryA = createRepositorySkeleton(workspace, "alpha");
    const repositoryB = createRepositorySkeleton(workspace, "beta");
    const storage = path.join(workspace, "storage", "pull-requests");

    queueWorkflowRun(createWorkflowRequest(repositoryA, "abcdef1", "lint"), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
    });
    queueWorkflowRun(createWorkflowRequest(repositoryB, "abcdef2", "test"), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
      workflowIdFactory: createIdFactory("workflow-2"),
    });
    queueWorkflowRun(createWorkflowRequest(repositoryA, "abcdef3", "release"), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      workflowIdFactory: createIdFactory("workflow-3"),
    });

    expect(listWorkflowRuns(repositoryA, { storage })).toMatchObject([
      {
        id: "workflow-3",
        repositoryPath: repositoryA,
      },
      {
        id: "workflow-1",
        repositoryPath: repositoryA,
      },
    ]);
  });

  it("returns null when a workflow id belongs to another repository", () => {
    const workspace = createWorkspace();
    const repositoryA = createRepositorySkeleton(workspace, "alpha");
    const repositoryB = createRepositorySkeleton(workspace, "beta");
    const storage = path.join(workspace, "storage", "pull-requests");

    queueWorkflowRun(createWorkflowRequest(repositoryA, "abcdef1", "lint"), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
    });

    expect(readWorkflowRunForRepository(repositoryB, "workflow-1", storage)).toBeNull();
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-workflow-storage-"));

  workspaces.push(workspace);

  return workspace;
}

function createRepositorySkeleton(workspace: string, repositoryName: string): string {
  const repositoryPath = path.join(workspace, ".data", "repos", repositoryName);

  mkdirSync(path.join(repositoryPath, ".git"), { recursive: true });

  return repositoryPath;
}

function createPullRequestRequest(
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

function createWorkflowRequest(
  repositoryPath: string,
  commitHash: string,
  workflowName: string,
  branchName: string = "feature/test",
): ValidatedWorkflowRunRequest {
  return {
    repositoryName: path.basename(repositoryPath),
    repositoryPath,
    publishedBranch: {
      repositoryPath,
      branchName,
      commitHash,
      remoteName: "origin",
    },
    workflowName,
  };
}

function createIdFactory(...ids: string[]): () => string {
  let index = 0;

  return () => {
    const id = ids[Math.min(index, ids.length - 1)];

    index += 1;

    return id;
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
