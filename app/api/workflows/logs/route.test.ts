import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/repositories", () => ({
  getRepositoryByName: vi.fn(),
}));

vi.mock("@/lib/workflow-runs/service", () => ({
  streamWorkflowRunLogs: vi.fn(),
}));

import { GET } from "@/app/api/workflows/logs/route";
import { getRepositoryByName } from "@/lib/repositories";
import { streamWorkflowRunLogs } from "@/lib/workflow-runs/service";

const mockedGetRepositoryByName = vi.mocked(getRepositoryByName);
const mockedStreamWorkflowRunLogs = vi.mocked(streamWorkflowRunLogs);

describe("GET /api/workflows/logs", () => {
  beforeEach(() => {
    mockedGetRepositoryByName.mockReset();
    mockedStreamWorkflowRunLogs.mockReset();
  });

  it("returns the workflow log stream as plain text", async () => {
    mockedGetRepositoryByName.mockReturnValue({
      name: "alpha",
      path: "/repos/alpha",
      relativePath: ".data/repos/alpha",
    });
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
    expect(mockedGetRepositoryByName).toHaveBeenCalledWith("alpha");
    expect(mockedStreamWorkflowRunLogs).toHaveBeenCalledWith({
      workflowId: "workflow-1",
      repositoryPath: "/repos/alpha",
      offset: "24",
    });
    await expect(response.text()).resolves.toBe("queued\nrunning\n");
  });

  it("returns not found when the repository name does not resolve on the server", async () => {
    mockedGetRepositoryByName.mockReturnValue(null);

    const response = await GET(
      new Request(
        "http://localhost/api/workflows/logs?workflowId=workflow-1&repositoryName=missing-repo",
      ),
    );

    expect(response.status).toBe(404);
    expect(mockedStreamWorkflowRunLogs).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "ugit repository missing-repo does not exist on the server.",
    });
  });
});
