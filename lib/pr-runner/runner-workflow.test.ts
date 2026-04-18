import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
import type { ValidatedWorkflowRunRequest } from "@/lib/workflow-runs/validation";

const { executeWorkflowPackages } = vi.hoisted(() => ({
  executeWorkflowPackages: vi.fn(),
}));

vi.mock("@/lib/pr-runner/workflows", () => ({
  executeWorkflowPackages,
}));

import { executeWorkflowRunJob, resetPullRequestRunnerForTests } from "@/lib/pr-runner/runner";
import {
  claimRunnableExecutions,
  queueWorkflowRun,
  readWorkflowRun,
} from "@/lib/pr-runner/storage";

const workspaces: string[] = [];

beforeEach(() => {
  executeWorkflowPackages.mockReset();
  executeWorkflowPackages.mockResolvedValue({
    success: true,
    workflows: [],
  });
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

describe("executeWorkflowRunJob", () => {
  it("marks the workflow run as succeeded and appends durable logs", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    const queued = queueWorkflowRun(createWorkflowRequest(repositoryPath, "abcdef1", "lint"), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
    });
    const [execution] = claimRunnableExecutions({
      storage,
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
    });

    if (!execution || execution.kind !== "workflow_run") {
      throw new Error("Expected to claim workflow-1 as a workflow run.");
    }

    const runCommand = vi.fn(async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }));

    await executeWorkflowRunJob(execution, {
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      runCommand,
    });

    expect(executeWorkflowPackages).toHaveBeenCalledWith(
      expect.any(String),
      runCommand,
      expect.objectContaining({
        workflowName: "lint",
        onOutput: expect.any(Function),
      }),
    );
    expect(readWorkflowRun("workflow-1", storage)).toMatchObject({
      id: "workflow-1",
      status: "succeeded",
      errorMessage: null,
    });
    expect(readFileSync(queued.workflowRun.logPath, "utf8")).toContain(
      "Workflow run workflow-1 completed with status succeeded.",
    );
  });

  it("runs repo-worktree workflow executions through the queued worktree path", async () => {
    const workspace = createWorkspace();

    createRepositorySkeleton(workspace, "alpha");

    const workflowRepositoryPath = createRepositoryWorktree(workspace, "alpha", "feature/test");
    const storage = path.join(workspace, "storage", "pull-requests");

    queueWorkflowRun(createWorkflowRequest(workflowRepositoryPath, "abcdef1", "lint"), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
    });
    const [execution] = claimRunnableExecutions({
      storage,
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
    });

    if (!execution || execution.kind !== "workflow_run") {
      throw new Error("Expected to claim workflow-1 as a workflow run.");
    }

    const runCommand = vi.fn(async () => ({
      exitCode: 0,
      stdout: "",
      stderr: "",
    }));

    await executeWorkflowRunJob(execution, {
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      runCommand,
    });

    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      "git",
      expect.arrayContaining(["-C", workflowRepositoryPath, "worktree", "add", "--detach"]),
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      "git",
      expect.arrayContaining(["-C", workflowRepositoryPath, "worktree", "remove", "--force"]),
    );
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-runner-workflow-"));

  workspaces.push(workspace);

  return workspace;
}

function createRepositorySkeleton(workspace: string, repositoryName: string): string {
  const repositoryPath = path.join(workspace, ".data", "repos", repositoryName);

  mkdirSync(path.join(repositoryPath, ".git"), { recursive: true });

  return repositoryPath;
}

function createRepositoryWorktree(
  workspace: string,
  repositoryName: string,
  worktreeName: string,
): string {
  const worktreePath = path.join(
    workspace,
    ".data",
    "repos",
    repositoryName,
    ".ugit",
    "worktrees",
    worktreeName,
  );

  mkdirSync(path.join(worktreePath, ".git"), { recursive: true });

  return worktreePath;
}

function createWorkflowRequest(
  executionRepositoryPath: string,
  commitHash: string,
  workflowName: string,
  branchName: string = "feature/test",
): ValidatedWorkflowRunRequest {
  const { repositoryName, repositoryPath } = resolveOwningRepositoryTarget(executionRepositoryPath);

  return {
    repositoryName,
    repositoryPath,
    executionRepositoryPath,
    publishedBranch: {
      repositoryPath: executionRepositoryPath,
      branchName,
      commitHash,
      remoteName: "origin",
    },
    workflowName,
  };
}

function resolveOwningRepositoryTarget(repositoryPath: string): {
  repositoryName: string;
  repositoryPath: string;
} {
  const repositoriesRootSegment = `${path.sep}repos${path.sep}`;
  const repositoriesIndex = repositoryPath.lastIndexOf(repositoriesRootSegment);

  if (repositoriesIndex < 0) {
    throw new Error(`Expected ${repositoryPath} to be nested under .data/repos.`);
  }

  const repositoryRoot = repositoryPath
    .slice(repositoriesIndex + repositoriesRootSegment.length)
    .split(path.sep)
    .filter((segment) => segment.length > 0)[0];

  if (!repositoryRoot) {
    throw new Error(`Expected ${repositoryPath} to include a repository name.`);
  }

  return {
    repositoryName: repositoryRoot,
    repositoryPath: repositoryPath.slice(
      0,
      repositoriesIndex + repositoriesRootSegment.length + repositoryRoot.length,
    ),
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
