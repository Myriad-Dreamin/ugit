import { beforeEach, describe, expect, it, vi } from "vitest";
import { PullRequestRequestError } from "@/lib/pr-runner/validation";

vi.mock("@/lib/pr-runner/service", () => ({
  getRepositoryPullRequest: vi.fn(),
}));

import { GET } from "@/app/api/pull-requests/[pullRequestId]/route";
import { getRepositoryPullRequest } from "@/lib/pr-runner/service";

const mockedGetRepositoryPullRequest = vi.mocked(getRepositoryPullRequest);

describe("GET /api/pull-requests/[pullRequestId]", () => {
  beforeEach(() => {
    mockedGetRepositoryPullRequest.mockReset();
  });

  it("returns repo-scoped pull-request detail as JSON", async () => {
    mockedGetRepositoryPullRequest.mockReturnValue({
      repositoryName: "alpha",
      pullRequest: {
        id: 7,
        repositoryName: "alpha",
        branchName: "feature/test",
        baseBranch: "main",
        title: "Add PR pages",
        body: "",
        draft: false,
        status: "running",
        state: "open",
        latestCommitHash: "abcdef1",
        latestJob: {
          id: "job-1",
          status: "running",
          commitHash: "abcdef1",
          errorMessage: null,
          mergeStatus: null,
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:05.000Z",
          startedAt: "2026-04-20T00:00:02.000Z",
          finishedAt: null,
        },
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:05.000Z",
        activity: [],
        ciJobs: [],
        github: {
          state: "compare",
          url: "https://github.com/acme/alpha/compare/main...feature%2Ftest?expand=1",
          remoteName: "upstream",
          repositoryUrl: "https://github.com/acme/alpha",
          actionLabel: "Open on GitHub",
          message: "Open the best-effort GitHub compare view for this pull request.",
        },
      },
    });

    const response = await GET(
      new Request("http://localhost/api/pull-requests/7?repositoryName=alpha"),
      {
        params: {
          pullRequestId: "7",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(mockedGetRepositoryPullRequest).toHaveBeenCalledWith({
      repositoryName: "alpha",
      pullRequestId: "7",
    });
    const payload = await response.json();

    expect(payload.pullRequest).not.toHaveProperty("repositoryPath");
    expect(payload.pullRequest.latestJob).not.toHaveProperty("resultPath");
    expect(payload.pullRequest.ciJobs).toEqual([]);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns not found when the pull request does not belong to the repository", async () => {
    mockedGetRepositoryPullRequest.mockImplementation(() => {
      throw new PullRequestRequestError("No ugit pull request exists for alpha:7.", 404);
    });

    const response = await GET(
      new Request("http://localhost/api/pull-requests/7?repositoryName=alpha"),
      {
        params: {
          pullRequestId: "7",
        },
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No ugit pull request exists for alpha:7.",
    });
  });
});
