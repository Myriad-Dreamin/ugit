import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workflow-runs/service", () => ({
  queueWorkflowRun: vi.fn(),
}));

import { POST } from "@/app/api/workflows/runs/route";
import { queueWorkflowRun } from "@/lib/workflow-runs/service";

const mockedQueueWorkflowRun = vi.mocked(queueWorkflowRun);

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
