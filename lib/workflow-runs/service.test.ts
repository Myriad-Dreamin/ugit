import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeWorkflowRun, readWorkflowRun } from "@/lib/pr-runner/storage";
import { resetStorageCacheForTests, withStorage } from "@/lib/storage/sqlite";
import { appendWorkflowRunLog } from "@/lib/workflow-runs/log-storage";
import {
  getWorkflowRun,
  getWorkflowRunPageData,
  listWorkflowRuns,
  queueWorkflowRun,
  streamWorkflowRunLogs,
  type WorkflowRunServiceOptions,
} from "@/lib/workflow-runs/service";
import { WorkflowRunRequestError } from "@/lib/workflow-runs/validation";

const workspaces: string[] = [];
const mockedNudgeRunner = vi.fn();

beforeEach(() => {
  mockedNudgeRunner.mockReset();
  mockedNudgeRunner.mockResolvedValue(undefined);
});

afterEach(() => {
  resetStorageCacheForTests();

  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("queueWorkflowRun service", () => {
  it("queues the workflow run, writes the initial log header, and nudges the runner", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    expect(
      queueWorkflowRun(createPayload(repositoryPath), {
        cwd: workspace,
        storage,
        now: createNowFactory("2026-04-14T00:00:00.000Z"),
        workflowIdFactory: createIdFactory("workflow-1"),
        nudgeRunner: mockedNudgeRunner,
      }),
    ).toEqual({
      workflowId: "workflow-1",
      workflowName: "lint",
      status: "queued",
      queuePosition: 1,
      repositoryName: "alpha",
      branchName: "feature/test",
      commitHash: "abcdef1",
    });
    expect(readWorkflowRun("workflow-1", storage)).toMatchObject({
      id: "workflow-1",
      status: "queued",
      workflowName: "lint",
    });
    expect(readFileSync(readWorkflowRun("workflow-1", storage)!.logPath, "utf8")).toContain(
      "Queued workflow workflow-1 for alpha:feature/test (lint @ abcdef1).",
    );
    expect(mockedNudgeRunner).toHaveBeenCalledWith({
      cwd: workspace,
      storage,
    });
  });
});

describe("repo-scoped workflow services", () => {
  it("lists repository workflow summaries through the shared service DTO", () => {
    const workspace = createWorkspace();

    createRepositorySkeleton(workspace, "alpha");

    const repositoryPath = createRepositoryWorktree(workspace, "alpha", "feature/test");
    const storage = path.join(workspace, "storage", "pull-requests");

    queueWorkflowRun(createPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
      nudgeRunner: mockedNudgeRunner,
    });

    const response = listWorkflowRuns(
      {
        repositoryName: "alpha",
      },
      {
        cwd: workspace,
        storage,
      },
    );

    expect(response).toEqual({
      repositoryName: "alpha",
      workflowRuns: [
        expect.objectContaining({
          id: "workflow-1",
          workflowName: "lint",
          status: "queued",
        }),
      ],
    });
    expect(response.workflowRuns[0]).not.toHaveProperty("repositoryPath");
  });

  it("keeps repo-scoped list, detail, and log reads stable when the stored path drifts", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    const queued = queueWorkflowRun(createPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
      nudgeRunner: mockedNudgeRunner,
    });
    const workflowRun = readWorkflowRun(queued.workflowId, storage);

    if (!workflowRun) {
      throw new Error("Expected workflow-1 to exist before mutating its stored repository path.");
    }

    appendWorkflowRunLog(workflowRun.logPath, "running\n");
    completeWorkflowRun({
      workflowId: queued.workflowId,
      status: "succeeded",
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
      storage,
    });
    driftWorkflowRunRepositoryPath(storage, queued.workflowId, "/srv/ugit/aliases/alpha");

    expect(
      listWorkflowRuns(
        {
          repositoryName: "alpha",
        },
        {
          cwd: workspace,
          storage,
        },
      ),
    ).toEqual({
      repositoryName: "alpha",
      workflowRuns: [
        expect.objectContaining({
          id: "workflow-1",
          workflowName: "lint",
          status: "succeeded",
        }),
      ],
    });
    expect(
      getWorkflowRun(
        {
          repositoryName: "alpha",
          workflowId: queued.workflowId,
        },
        {
          cwd: workspace,
          storage,
        },
      ),
    ).toMatchObject({
      repositoryName: "alpha",
      workflowRun: {
        id: "workflow-1",
        workflowName: "lint",
        status: "succeeded",
      },
    });
    expect(
      getWorkflowRunPageData(
        {
          repositoryName: "alpha",
          workflowId: queued.workflowId,
        },
        {
          cwd: workspace,
          storage,
        },
      ),
    ).toMatchObject({
      repositoryName: "alpha",
      workflowRun: {
        id: "workflow-1",
      },
      initialLog: {
        text: expect.stringContaining("Queued workflow workflow-1"),
      },
    });
    await expect(
      readStream(
        streamWorkflowRunLogs(
          {
            workflowId: queued.workflowId,
            repositoryName: "alpha",
          },
          createServiceOptions(workspace, storage),
        ),
      ),
    ).resolves.toContain("running\n");
  });

  it("rejects repo-scoped detail reads for workflow ids owned by another repository", () => {
    const workspace = createWorkspace();
    const repositoryA = createRepositorySkeleton(workspace, "alpha");
    createRepositorySkeleton(workspace, "beta");
    const storage = path.join(workspace, "storage", "pull-requests");

    queueWorkflowRun(createPayload(repositoryA), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
      nudgeRunner: mockedNudgeRunner,
    });

    expect(() =>
      getWorkflowRun(
        {
          repositoryName: "beta",
          workflowId: "workflow-1",
        },
        {
          cwd: workspace,
          storage,
        },
      ),
    ).toThrowError(WorkflowRunRequestError);
  });
});

describe("streamWorkflowRunLogs service", () => {
  it("streams queued logs and follows appended output until the workflow completes", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    const queued = queueWorkflowRun(createPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
      nudgeRunner: mockedNudgeRunner,
    });

    void delay(10).then(() => {
      const workflowRun = readWorkflowRun(queued.workflowId, storage);

      if (!workflowRun) {
        throw new Error("Expected workflow-1 to exist before streaming logs.");
      }

      appendWorkflowRunLog(workflowRun.logPath, "running\n");
      completeWorkflowRun({
        workflowId: queued.workflowId,
        status: "succeeded",
        now: createNowFactory("2026-04-14T00:00:10.000Z"),
        storage,
      });
    });

    await expect(
      readStream(
        streamWorkflowRunLogs(
          {
            workflowId: queued.workflowId,
            repositoryName: "alpha",
          },
          createServiceOptions(workspace, storage),
        ),
      ),
    ).resolves.toContain("running\n");
  });

  it("still streams logs by workflow id when no repository name is provided", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    const queued = queueWorkflowRun(createPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
      nudgeRunner: mockedNudgeRunner,
    });

    void delay(10).then(() => {
      const workflowRun = readWorkflowRun(queued.workflowId, storage);

      if (!workflowRun) {
        throw new Error("Expected workflow-1 to exist before streaming logs.");
      }

      appendWorkflowRunLog(workflowRun.logPath, "running\n");
      completeWorkflowRun({
        workflowId: queued.workflowId,
        status: "succeeded",
        now: createNowFactory("2026-04-14T00:00:10.000Z"),
        storage,
      });
    });

    await expect(
      readStream(
        streamWorkflowRunLogs(
          {
            workflowId: queued.workflowId,
          },
          createServiceOptions(workspace, storage),
        ),
      ),
    ).resolves.toContain("running\n");
  });

  it("rejects repo-scoped log streams for workflow ids owned by another repository", () => {
    const workspace = createWorkspace();
    const repositoryA = createRepositorySkeleton(workspace, "alpha");
    createRepositorySkeleton(workspace, "beta");
    const storage = path.join(workspace, "storage", "pull-requests");

    queueWorkflowRun(createPayload(repositoryA), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
      nudgeRunner: mockedNudgeRunner,
    });

    expect(() =>
      streamWorkflowRunLogs(
        {
          workflowId: "workflow-1",
          repositoryName: "beta",
        },
        createServiceOptions(workspace, storage),
      ),
    ).toThrowError(WorkflowRunRequestError);
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-workflow-service-"));

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

function createPayload(repositoryPath: string): Record<string, unknown> {
  return {
    publishedBranch: {
      repositoryPath,
      branchName: "feature/test",
      commitHash: "abcdef1",
      remoteName: "origin",
    },
    workflowName: "lint",
  };
}

function createServiceOptions(workspace: string, storage: string): WorkflowRunServiceOptions {
  return {
    cwd: workspace,
    storage,
    logPollIntervalMs: 1,
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

function driftWorkflowRunRepositoryPath(
  storage: string,
  workflowId: string,
  repositoryPath: string,
): void {
  withStorage(storage, (database) => {
    database
      .prepare<[string, string]>(
        `
          UPDATE workflow_runs
          SET repository_path = ?
          WHERE id = ?
        `,
      )
      .run(repositoryPath, workflowId);
  });
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      return text + decoder.decode();
    }

    text += decoder.decode(value, { stream: true });
  }
}
