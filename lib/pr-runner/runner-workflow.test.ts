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
