import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET as getWorkflowLogsRoute } from "@/app/api/workflows/logs/route";
import { GET as getWorkflowRunRoute } from "@/app/api/workflows/runs/[workflowId]/route";
import { GET as getWorkflowRunsRoute } from "@/app/api/workflows/runs/route";
import { completeWorkflowRun, readWorkflowRun } from "@/lib/pr-runner/storage";
import { resetStorageCacheForTests, withStorage } from "@/lib/storage/sqlite";
import { appendWorkflowRunLog } from "@/lib/workflow-runs/log-storage";
import { queueWorkflowRun } from "@/lib/workflow-runs/service";

const workspaces: string[] = [];
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  resetStorageCacheForTests();

  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("repo-scoped workflow API repository identity", () => {
  it("returns repo-scoped list, detail, and logs after the stored path drifts", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");

    process.chdir(workspace);

    const queued = queueWorkflowRun(createPayload(repositoryPath), {
      cwd: workspace,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
      nudgeRunner: async () => undefined,
    });
    const workflowRun = readWorkflowRun(queued.workflowId);

    if (!workflowRun) {
      throw new Error("Expected workflow-1 to exist before mutating its stored repository path.");
    }

    appendWorkflowRunLog(workflowRun.logPath, "running\n");
    completeWorkflowRun({
      workflowId: queued.workflowId,
      status: "succeeded",
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
    });
    driftWorkflowRunRepositoryPath(queued.workflowId, "/srv/ugit/aliases/alpha");

    const listResponse = await getWorkflowRunsRoute(
      new Request("http://localhost/api/workflows/runs?repositoryName=alpha"),
    );
    const detailResponse = await getWorkflowRunRoute(
      new Request("http://localhost/api/workflows/runs/workflow-1?repositoryName=alpha"),
      {
        params: {
          workflowId: "workflow-1",
        },
      },
    );
    const logsResponse = await getWorkflowLogsRoute(
      new Request("http://localhost/api/workflows/logs?workflowId=workflow-1&repositoryName=alpha"),
    );

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toEqual({
      repositoryName: "alpha",
      workflowRuns: [
        expect.objectContaining({
          id: "workflow-1",
          workflowName: "lint",
          status: "succeeded",
        }),
      ],
    });
    expect(detailResponse.status).toBe(200);
    await expect(detailResponse.json()).resolves.toEqual({
      repositoryName: "alpha",
      workflowRun: expect.objectContaining({
        id: "workflow-1",
        workflowName: "lint",
        status: "succeeded",
      }),
    });
    expect(logsResponse.status).toBe(200);
    await expect(logsResponse.text()).resolves.toContain("running\n");
  });

  it("returns not found for repo-scoped detail and log reads from another repository", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");

    createRepositorySkeleton(workspace, "beta");
    process.chdir(workspace);

    queueWorkflowRun(createPayload(repositoryPath), {
      cwd: workspace,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
      nudgeRunner: async () => undefined,
    });

    const detailResponse = await getWorkflowRunRoute(
      new Request("http://localhost/api/workflows/runs/workflow-1?repositoryName=beta"),
      {
        params: {
          workflowId: "workflow-1",
        },
      },
    );
    const logsResponse = await getWorkflowLogsRoute(
      new Request("http://localhost/api/workflows/logs?workflowId=workflow-1&repositoryName=beta"),
    );

    expect(detailResponse.status).toBe(404);
    await expect(detailResponse.json()).resolves.toEqual({
      error: "No workflow run exists for beta:workflow-1.",
    });
    expect(logsResponse.status).toBe(404);
    await expect(logsResponse.json()).resolves.toEqual({
      error: "No workflow run exists for beta:workflow-1.",
    });
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-workflow-api-"));

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

function driftWorkflowRunRepositoryPath(workflowId: string, repositoryPath: string): void {
  withStorage(undefined, (database) => {
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
