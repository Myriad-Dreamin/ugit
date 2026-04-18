import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowRunRequestError } from "@/lib/workflow-runs/validation";

vi.mock("@/lib/workflow-runs/service", () => ({
  listWorkflowRuns: vi.fn(),
  queueWorkflowRun: vi.fn(),
}));

import { GET, POST } from "@/app/api/workflows/runs/route";
import { listWorkflowRuns, queueWorkflowRun } from "@/lib/workflow-runs/service";

const mockedListWorkflowRuns = vi.mocked(listWorkflowRuns);
const mockedQueueWorkflowRun = vi.mocked(queueWorkflowRun);

describe("GET /api/workflows/runs", () => {
  beforeEach(() => {
    mockedListWorkflowRuns.mockReset();
  });

  it("returns repo-scoped workflow summaries as JSON", async () => {
    mockedListWorkflowRuns.mockReturnValue({
      repositoryName: "alpha",
      workflowRuns: [],
    });

    const response = await GET(
      new Request("https://ugit.example.test/api/workflows/runs?repositoryName=alpha"),
    );

    expect(response.status).toBe(200);
    expect(mockedListWorkflowRuns).toHaveBeenCalledWith({
      repositoryName: "alpha",
    });
    const payload = await response.json();

    expect(payload).toEqual({
      repositoryName: "alpha",
      workflowRuns: [],
    });
    expect(payload).not.toHaveProperty("repositoryPath");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns not found when the repository name does not resolve on the server", async () => {
    mockedListWorkflowRuns.mockImplementation(() => {
      throw new WorkflowRunRequestError(
        "ugit repository missing-repo does not exist on the server.",
        404,
      );
    });

    const response = await GET(
      new Request("http://localhost/api/workflows/runs?repositoryName=missing-repo"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "ugit repository missing-repo does not exist on the server.",
    });
  });
});

describe("POST /api/workflows/runs", () => {
  beforeEach(() => {
    mockedQueueWorkflowRun.mockReset();
  });

  it("returns queued workflow details as JSON", async () => {
    mockedQueueWorkflowRun.mockReturnValue({
      workflowId: "workflow-1",
      workflowName: "lint",
      status: "queued",
      queuePosition: 1,
      repositoryName: "alpha",
      branchName: "feature/test",
      commitHash: "abcdef1",
    });

    const response = await POST(
      new Request("http://localhost/api/workflows/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          publishedBranch: {},
          workflowName: "lint",
        }),
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      workflowId: "workflow-1",
      workflowName: "lint",
      status: "queued",
      queuePosition: 1,
      repositoryName: "alpha",
      branchName: "feature/test",
      commitHash: "abcdef1",
    });
  });
});
