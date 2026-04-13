import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pr-runner/service", () => ({
  editPullRequest: vi.fn(),
  listPullRequests: vi.fn(),
}));

import { GET, PATCH } from "@/app/api/pull-requests/route";
import { editPullRequest, listPullRequests } from "@/lib/pr-runner/service";

const mockedEditPullRequest = vi.mocked(editPullRequest);
const mockedListPullRequests = vi.mocked(listPullRequests);

describe("GET /api/pull-requests", () => {
  beforeEach(() => {
    mockedListPullRequests.mockReset();
  });

  it("returns repository pull requests as JSON", async () => {
    mockedListPullRequests.mockReturnValue({
      repositoryName: "alpha",
      pullRequests: [],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/pull-requests?repositoryPath=%2Frepos%2Falpha&state=all&headBranch=feature%2Ftest",
      ),
    );

    expect(response.status).toBe(200);
    expect(mockedListPullRequests).toHaveBeenCalledWith({
      repositoryPath: "/repos/alpha",
      state: "all",
      baseBranch: null,
      headBranch: "feature/test",
    });
    await expect(response.json()).resolves.toEqual({
      repositoryName: "alpha",
      pullRequests: [],
    });
  });
});

describe("PATCH /api/pull-requests", () => {
  beforeEach(() => {
    mockedEditPullRequest.mockReset();
  });

  it("returns the edited pull request as JSON", async () => {
    mockedEditPullRequest.mockReturnValue({
      pullRequest: {
        id: 1,
        repositoryName: "alpha",
        repositoryPath: "/repos/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        title: "Retitle the pull request",
        body: "",
        draft: false,
        status: "queued",
        state: "open",
        latestCommitHash: "abcdef1",
        latestJob: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:10.000Z",
      },
      rerunQueued: false,
      jobId: null,
      queuePosition: null,
    });

    const response = await PATCH(
      new Request("http://localhost/api/pull-requests", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          repositoryPath: "/repos/alpha",
          branchName: "feature/test",
          title: "Retitle the pull request",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      pullRequest: {
        id: 1,
        repositoryName: "alpha",
        repositoryPath: "/repos/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        title: "Retitle the pull request",
        body: "",
        draft: false,
        status: "queued",
        state: "open",
        latestCommitHash: "abcdef1",
        latestJob: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:10.000Z",
      },
      rerunQueued: false,
      jobId: null,
      queuePosition: null,
    });
  });
});
