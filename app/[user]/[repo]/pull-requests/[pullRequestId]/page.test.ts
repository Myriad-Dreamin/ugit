import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NEXT_NOT_FOUND_ERROR = "NEXT_NOT_FOUND";

const { mockedHeaders, mockedPullRequestDetailClient } = vi.hoisted(() => ({
  mockedHeaders: vi.fn(),
  mockedPullRequestDetailClient: vi.fn(() => null),
}));

vi.mock("next/headers", () => ({
  headers: mockedHeaders,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error(NEXT_NOT_FOUND_ERROR);
  }),
}));

vi.mock("@/lib/owner", () => ({
  configuredOwner: {
    username: "Myriad-Dreamin",
  },
  getRepositoryHref: vi.fn(),
  getRepositoryPullRequestsHref: vi.fn(),
  isConfiguredOwner: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  getRepositoryByName: vi.fn(),
}));

vi.mock("@/lib/pr-runner/service", () => {
  throw new Error("PullRequestPage must not import pull-request services directly.");
});

vi.mock("@/app/[user]/[repo]/pull-requests/[pullRequestId]/pull-request-detail-client", () => ({
  PullRequestDetailClient: mockedPullRequestDetailClient,
}));

import PullRequestPage from "@/app/[user]/[repo]/pull-requests/[pullRequestId]/page";
import { getRepositoryHref, getRepositoryPullRequestsHref, isConfiguredOwner } from "@/lib/owner";
import { getRepositoryByName } from "@/lib/repositories";
import { notFound } from "next/navigation";

const mockedNotFound = vi.mocked(notFound);
const mockedGetRepositoryByName = vi.mocked(getRepositoryByName);
const mockedGetRepositoryHref = vi.mocked(getRepositoryHref);
const mockedGetRepositoryPullRequestsHref = vi.mocked(getRepositoryPullRequestsHref);
const mockedIsConfiguredOwner = vi.mocked(isConfiguredOwner);
const mockedHeadersReader = vi.mocked(mockedHeaders);
const mockedFetch = vi.fn<typeof fetch>();

vi.stubGlobal("fetch", mockedFetch);

describe("PullRequestPage", () => {
  beforeEach(() => {
    mockedNotFound.mockClear();
    mockedNotFound.mockImplementation(() => {
      throw new Error(NEXT_NOT_FOUND_ERROR);
    });

    mockedPullRequestDetailClient.mockClear();
    mockedGetRepositoryByName.mockReset();
    mockedGetRepositoryHref.mockReset();
    mockedGetRepositoryHref.mockImplementation((repositoryName) => {
      return `/Myriad-Dreamin/${repositoryName}`;
    });
    mockedGetRepositoryPullRequestsHref.mockReset();
    mockedGetRepositoryPullRequestsHref.mockImplementation((repositoryName) => {
      return `/Myriad-Dreamin/${repositoryName}/pull-requests`;
    });
    mockedIsConfiguredOwner.mockReset();
    mockedHeadersReader.mockReset();
    mockedHeadersReader.mockResolvedValue(
      new Headers({
        host: "localhost",
      }),
    );
    mockedFetch.mockReset();
  });

  it("calls notFound for missing pull requests", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);
    mockedGetRepositoryByName.mockReturnValue({
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    });
    mockedFetch.mockResolvedValue(
      Response.json(
        {
          error: "No ugit pull request exists for example-repo:7.",
        },
        { status: 404 },
      ),
    );

    await expect(
      PullRequestPage({
        params: {
          user: "Myriad-Dreamin",
          repo: "example-repo",
          pullRequestId: "7",
        },
      }),
    ).rejects.toThrowError(NEXT_NOT_FOUND_ERROR);

    expect(mockedFetch).toHaveBeenCalledWith(
      "http://localhost/api/pull-requests/7?repositoryName=example-repo",
      {
        cache: "no-store",
      },
    );
  });

  it("wires repo-scoped pull-request detail into the live client component", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);
    mockedGetRepositoryByName.mockReturnValue({
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    });
    mockedFetch.mockResolvedValue(
      Response.json({
        repositoryName: "example-repo",
        pullRequest: {
          id: 7,
          repositoryName: "example-repo",
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
      }),
    );

    const page = await PullRequestPage({
      params: {
        user: "Myriad-Dreamin",
        repo: "example-repo",
        pullRequestId: "7",
      },
    });
    const pullRequestDetailClient = findElementByType(page, mockedPullRequestDetailClient);

    expect(pullRequestDetailClient?.props.initialPullRequest).toMatchObject({
      id: 7,
      repositoryName: "example-repo",
      branchName: "feature/test",
    });
    expect(pullRequestDetailClient?.props.initialPullRequest).not.toHaveProperty("repositoryPath");
  });
});

type ElementWithChildren = ReactElement<Record<string, unknown> & { children?: unknown }>;

function findElementByType(node: unknown, type: unknown): ElementWithChildren | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  if ("type" in node && (node as ElementWithChildren).type === type) {
    return node as ElementWithChildren;
  }

  if (!("props" in node)) {
    return null;
  }

  const children = (node as ElementWithChildren).props?.children;

  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElementByType(child, type);

      if (found) {
        return found;
      }
    }

    return null;
  }

  return findElementByType(children, type);
}
