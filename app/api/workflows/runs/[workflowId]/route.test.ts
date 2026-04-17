import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowRunRequestError } from "@/lib/workflow-runs/validation";

vi.mock("@/lib/workflow-runs/service", () => ({
  getWorkflowRun: vi.fn(),
}));

import { GET } from "@/app/api/workflows/runs/[workflowId]/route";
import { getWorkflowRun } from "@/lib/workflow-runs/service";

const mockedGetWorkflowRun = vi.mocked(getWorkflowRun);

describe("GET /api/workflows/runs/[workflowId]", () => {
  beforeEach(() => {
    mockedGetWorkflowRun.mockReset();
  });

  it("returns repo-scoped workflow run detail as JSON", async () => {
    mockedGetWorkflowRun.mockReturnValue({
      repositoryName: "alpha",
      workflowRun: {
        id: "workflow-1",
        repositoryName: "alpha",
        branchName: "feature/test",
        commitHash: "abcdef1",
        workflowName: "lint",
        status: "running",
        errorMessage: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:05.000Z",
        startedAt: "2026-04-14T00:00:02.000Z",
        finishedAt: null,
      },
    });

    const response = await GET(
      new Request("http://localhost/api/workflows/runs/workflow-1?repositoryName=alpha"),
      {
        params: {
          workflowId: "workflow-1",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(mockedGetWorkflowRun).toHaveBeenCalledWith({
      repositoryName: "alpha",
      workflowId: "workflow-1",
    });
    const payload = await response.json();

    expect(payload).toEqual({
      repositoryName: "alpha",
      workflowRun: {
        id: "workflow-1",
        repositoryName: "alpha",
        branchName: "feature/test",
        commitHash: "abcdef1",
        workflowName: "lint",
        status: "running",
        errorMessage: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:05.000Z",
        startedAt: "2026-04-14T00:00:02.000Z",
        finishedAt: null,
      },
    });
    expect(payload).not.toHaveProperty("repositoryPath");
    expect(payload.workflowRun).not.toHaveProperty("repositoryPath");
  });

  it("returns not found when the workflow id does not belong to the resolved repository", async () => {
    mockedGetWorkflowRun.mockImplementation(() => {
      throw new WorkflowRunRequestError("No workflow run exists for alpha:workflow-1.", 404);
    });

    const response = await GET(
      new Request("http://localhost/api/workflows/runs/workflow-1?repositoryName=alpha"),
      {
        params: {
          workflowId: "workflow-1",
        },
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No workflow run exists for alpha:workflow-1.",
    });
  });
});
