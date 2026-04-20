import { beforeEach, describe, expect, it, vi } from "vitest";
import { PullRequestRequestError } from "@/lib/pr-runner/validation";

vi.mock("@/lib/pr-runner/service", () => ({
  mergeRepositoryPullRequest: vi.fn(),
}));

import { POST } from "@/app/api/pull-requests/[pullRequestId]/merge/route";
import { mergeRepositoryPullRequest } from "@/lib/pr-runner/service";

const mockedMergeRepositoryPullRequest = vi.mocked(mergeRepositoryPullRequest);

describe("POST /api/pull-requests/[pullRequestId]/merge", () => {
  beforeEach(() => {
    mockedMergeRepositoryPullRequest.mockReset();
  });

  it("returns structured repo-scoped merge outcomes", async () => {
    mockedMergeRepositoryPullRequest.mockResolvedValue({
      outcome: "rebase_required",
      message:
        "Base branch main is not an ancestor of abcdef1; rebase the pull request and rerun CI before merging.",
      pullRequest: {
        id: 7,
        repositoryName: "alpha",
        branchName: "feature/test",
        baseBranch: "main",
        title: "Add PR pages",
        body: "",
        draft: false,
        status: "passed",
        state: "open",
        latestCommitHash: "abcdef1",
        latestJob: null,
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:05.000Z",
        activity: [],
        ciJobs: [],
        github: {
          state: "pull_request",
          url: "https://github.com/acme/alpha/pull/7",
          remoteName: "upstream",
          repositoryUrl: "https://github.com/acme/alpha",
          actionLabel: "Open on GitHub",
          message: "Open the canonical GitHub pull request for this branch.",
        },
        mergeReadiness: {
          state: "ready",
          canMerge: true,
          summary: "All manual-merge checks passed. This pull request is ready for approval.",
          blockingReasons: [],
          checks: [],
          checkedAt: "2026-04-20T00:00:05.000Z",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/pull-requests/7/merge?repositoryName=alpha", {
        method: "POST",
      }),
      {
        params: {
          pullRequestId: "7",
        },
      },
    );

    expect(response.status).toBe(200);
    expect(mockedMergeRepositoryPullRequest).toHaveBeenCalledWith({
      repositoryName: "alpha",
      pullRequestId: "7",
    });
    await expect(response.json()).resolves.toMatchObject({
      outcome: "rebase_required",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns repository-scoped validation errors", async () => {
    mockedMergeRepositoryPullRequest.mockRejectedValue(
      new PullRequestRequestError("No ugit pull request exists for alpha:7.", 404),
    );

    const response = await POST(
      new Request("http://localhost/api/pull-requests/7/merge?repositoryName=alpha", {
        method: "POST",
      }),
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
