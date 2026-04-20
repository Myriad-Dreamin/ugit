import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NEXT_NOT_FOUND_ERROR = "NEXT_NOT_FOUND";

const { mockedHeaders, mockedPullRequestsListClient } = vi.hoisted(() => ({
  mockedHeaders: vi.fn(),
  mockedPullRequestsListClient: vi.fn(() => null),
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
  throw new Error("RepositoryPullRequestsPage must not import pull-request services directly.");
});

vi.mock("@/app/[user]/[repo]/pull-requests/pull-requests-list-client", () => ({
  PullRequestsListClient: mockedPullRequestsListClient,
}));

import RepositoryPullRequestsPage from "@/app/[user]/[repo]/pull-requests/page";
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

describe("RepositoryPullRequestsPage", () => {
  beforeEach(() => {
    mockedNotFound.mockClear();
    mockedNotFound.mockImplementation(() => {
      throw new Error(NEXT_NOT_FOUND_ERROR);
    });

    mockedPullRequestsListClient.mockClear();
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

  it("calls notFound for unsupported users", async () => {
    mockedIsConfiguredOwner.mockReturnValue(false);

    await expect(
      RepositoryPullRequestsPage({
        params: {
          user: "someone-else",
          repo: "example-repo",
        },
      }),
    ).rejects.toThrowError(NEXT_NOT_FOUND_ERROR);

    expect(mockedNotFound).toHaveBeenCalledTimes(1);
    expect(mockedGetRepositoryByName).not.toHaveBeenCalled();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("calls notFound when the API returns a repo-scoped 404", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);
    mockedGetRepositoryByName.mockReturnValue({
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    });
    mockedFetch.mockResolvedValue(
      Response.json(
        {
          error: "ugit repository example-repo does not exist on the server.",
        },
        { status: 404 },
      ),
    );

    await expect(
      RepositoryPullRequestsPage({
        params: {
          user: "Myriad-Dreamin",
          repo: "example-repo",
        },
      }),
    ).rejects.toThrowError(NEXT_NOT_FOUND_ERROR);

    expect(mockedFetch).toHaveBeenCalledWith(
      "http://localhost/api/pull-requests?repositoryName=example-repo",
      {
        cache: "no-store",
      },
    );
  });

  it("wires repo-scoped pull-request summaries into the live client component", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);
    mockedGetRepositoryByName.mockReturnValue({
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    });
    mockedHeadersReader.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "ugit.example.test",
        "x-forwarded-proto": "https",
      }),
    );
    mockedFetch.mockResolvedValue(
      Response.json({
        repositoryName: "example-repo",
        pullRequests: [],
      }),
    );

    const page = await RepositoryPullRequestsPage({
      params: {
        user: "Myriad-Dreamin",
        repo: "example-repo",
      },
    });
    const pullRequestsClient = findElementByType(page, mockedPullRequestsListClient);

    expect(mockedFetch).toHaveBeenCalledWith(
      "https://ugit.example.test/api/pull-requests?repositoryName=example-repo",
      {
        cache: "no-store",
      },
    );
    expect(pullRequestsClient?.props).toMatchObject({
      initialPullRequests: [],
      repositoryName: "example-repo",
    });
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
