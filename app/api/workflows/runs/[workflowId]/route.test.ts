import { beforeEach, describe, expect, it, vi } from "vitest";

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
        repositoryPath: "/repos/alpha",
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
      new Request("http://localhost/api/workflows/runs/workflow-1?repositoryPath=%2Frepos%2Falpha"),
      {
        params: {
          workflowId: "workflow-1",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(mockedGetWorkflowRun).toHaveBeenCalledWith({
      repositoryPath: "/repos/alpha",
      workflowId: "workflow-1",
    });
    await expect(response.json()).resolves.toEqual({
      repositoryName: "alpha",
      workflowRun: {
        id: "workflow-1",
        repositoryName: "alpha",
        repositoryPath: "/repos/alpha",
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
  });
});
