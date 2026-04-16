import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeWorkflowRun, readWorkflowRun } from "@/lib/pr-runner/storage";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
import { appendWorkflowRunLog } from "@/lib/workflow-runs/log-storage";
import {
  getWorkflowRun,
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
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    queueWorkflowRun(createPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
      nudgeRunner: mockedNudgeRunner,
    });

    expect(
      listWorkflowRuns(
        {
          repositoryPath,
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
          status: "queued",
        }),
      ],
    });
  });

  it("rejects repo-scoped detail reads for workflow ids owned by another repository", () => {
    const workspace = createWorkspace();
    const repositoryA = createRepositorySkeleton(workspace, "alpha");
    const repositoryB = createRepositorySkeleton(workspace, "beta");
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
          repositoryPath: repositoryB,
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
            repositoryPath,
          },
          createServiceOptions(workspace, storage),
        ),
      ),
    ).resolves.toContain("running\n");
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
