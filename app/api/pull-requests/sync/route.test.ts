import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pr-runner/service", () => ({
  synchronizePullRequest: vi.fn(),
}));

import { POST } from "@/app/api/pull-requests/sync/route";
import { synchronizePullRequest } from "@/lib/pr-runner/service";

const mockedSynchronizePullRequest = vi.mocked(synchronizePullRequest);

describe("POST /api/pull-requests/sync", () => {
  beforeEach(() => {
    mockedSynchronizePullRequest.mockReset();
  });

  it("returns queued job details as JSON", async () => {
    mockedSynchronizePullRequest.mockReturnValue({
      pullRequestId: 1,
      jobId: "job-1",
      status: "queued",
      queuePosition: 1,
      repositoryName: "alpha",
      branchName: "feature/test",
      baseBranch: "main",
      latestCommitHash: "abcdef1",
    });

    const response = await POST(
      new Request("http://localhost/api/pull-requests/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          publishedBranch: {},
          pullRequest: {},
        }),
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      pullRequestId: 1,
      jobId: "job-1",
      status: "queued",
      queuePosition: 1,
      repositoryName: "alpha",
      branchName: "feature/test",
      baseBranch: "main",
      latestCommitHash: "abcdef1",
    });
  });
});
