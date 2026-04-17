import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowRunRequestError } from "@/lib/workflow-runs/validation";

vi.mock("@/lib/workflow-runs/service", () => ({
  streamWorkflowRunLogs: vi.fn(),
}));

import { GET } from "@/app/api/workflows/logs/route";
import { streamWorkflowRunLogs } from "@/lib/workflow-runs/service";

const mockedStreamWorkflowRunLogs = vi.mocked(streamWorkflowRunLogs);

describe("GET /api/workflows/logs", () => {
  beforeEach(() => {
    mockedStreamWorkflowRunLogs.mockReset();
  });

  it("returns the workflow log stream as plain text", async () => {
    mockedStreamWorkflowRunLogs.mockReturnValue(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("queued\nrunning\n"));
          controller.close();
        },
      }),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/workflows/logs?workflowId=workflow-1&repositoryName=alpha&offset=24",
      ),
    );

    expect(response.status).toBe(200);
    expect(mockedStreamWorkflowRunLogs).toHaveBeenCalledWith({
      workflowId: "workflow-1",
      repositoryName: "alpha",
      offset: "24",
    });
    await expect(response.text()).resolves.toBe("queued\nrunning\n");
  });

  it("returns not found when the workflow id does not belong to the repository", async () => {
    mockedStreamWorkflowRunLogs.mockImplementation(() => {
      throw new WorkflowRunRequestError("No workflow run exists for alpha:workflow-1.", 404);
    });

    const response = await GET(
      new Request("http://localhost/api/workflows/logs?workflowId=workflow-1&repositoryName=alpha"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No workflow run exists for alpha:workflow-1.",
    });
  });
});
