import { beforeEach, describe, expect, it, vi } from "vitest";

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
        "http://localhost/api/workflows/logs?workflowId=workflow-1&repositoryPath=%2Frepos%2Falpha&offset=24",
      ),
    );

    expect(response.status).toBe(200);
    expect(mockedStreamWorkflowRunLogs).toHaveBeenCalledWith({
      workflowId: "workflow-1",
      repositoryPath: "/repos/alpha",
      offset: "24",
    });
    await expect(response.text()).resolves.toBe("queued\nrunning\n");
  });
});
