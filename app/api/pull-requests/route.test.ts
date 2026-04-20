import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pr-runner/service", () => ({
  editPullRequest: vi.fn(),
  listPullRequests: vi.fn(),
  listRepositoryPullRequests: vi.fn(),
}));

import { GET, PATCH } from "@/app/api/pull-requests/route";
import {
  editPullRequest,
  listPullRequests,
  listRepositoryPullRequests,
} from "@/lib/pr-runner/service";

const mockedEditPullRequest = vi.mocked(editPullRequest);
const mockedListPullRequests = vi.mocked(listPullRequests);
const mockedListRepositoryPullRequests = vi.mocked(listRepositoryPullRequests);

describe("GET /api/pull-requests", () => {
  beforeEach(() => {
    mockedListPullRequests.mockReset();
    mockedListRepositoryPullRequests.mockReset();
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
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockedListRepositoryPullRequests).not.toHaveBeenCalled();
  });

  it("returns repo-scoped browser pull requests when repositoryName is provided", async () => {
    mockedListRepositoryPullRequests.mockReturnValue({
      repositoryName: "alpha",
      pullRequests: [
        {
          id: 1,
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
        },
      ],
    });

    const response = await GET(
      new Request("http://localhost/api/pull-requests?repositoryName=alpha"),
    );

    expect(response.status).toBe(200);
    expect(mockedListRepositoryPullRequests).toHaveBeenCalledWith({
      repositoryName: "alpha",
      state: null,
      baseBranch: null,
      headBranch: null,
    });
    const payload = await response.json();

    expect(payload).toEqual({
      repositoryName: "alpha",
      pullRequests: [
        expect.objectContaining({
          id: 1,
          repositoryName: "alpha",
          branchName: "feature/test",
        }),
      ],
    });
    expect(payload.pullRequests[0]).not.toHaveProperty("repositoryPath");
    expect(payload.pullRequests[0].latestJob).not.toHaveProperty("resultPath");
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
