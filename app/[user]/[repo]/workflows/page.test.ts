import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NEXT_NOT_FOUND_ERROR = "NEXT_NOT_FOUND";

const { mockedHeaders, mockedWorkflowRunsListClient } = vi.hoisted(() => ({
  mockedHeaders: vi.fn(),
  mockedWorkflowRunsListClient: vi.fn(() => null),
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
  getRepositoryWorkflowsHref: vi.fn(),
  isConfiguredOwner: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  getRepositoryByName: vi.fn(),
}));

vi.mock("@/lib/workflow-runs/service", () => {
  throw new Error("RepositoryWorkflowsPage must not import workflow services directly.");
});

vi.mock("@/app/[user]/[repo]/workflows/workflow-runs-list-client", () => ({
  WorkflowRunsListClient: mockedWorkflowRunsListClient,
}));

import RepositoryWorkflowsPage from "@/app/[user]/[repo]/workflows/page";
import { getRepositoryHref, getRepositoryWorkflowsHref, isConfiguredOwner } from "@/lib/owner";
import { getRepositoryByName } from "@/lib/repositories";
import { notFound } from "next/navigation";

const mockedNotFound = vi.mocked(notFound);
const mockedGetRepositoryByName = vi.mocked(getRepositoryByName);
const mockedGetRepositoryHref = vi.mocked(getRepositoryHref);
const mockedGetRepositoryWorkflowsHref = vi.mocked(getRepositoryWorkflowsHref);
const mockedIsConfiguredOwner = vi.mocked(isConfiguredOwner);
const mockedHeadersReader = vi.mocked(mockedHeaders);
const mockedFetch = vi.fn<typeof fetch>();

vi.stubGlobal("fetch", mockedFetch);

describe("RepositoryWorkflowsPage", () => {
  beforeEach(() => {
    mockedNotFound.mockClear();
    mockedNotFound.mockImplementation(() => {
      throw new Error(NEXT_NOT_FOUND_ERROR);
    });

    mockedWorkflowRunsListClient.mockClear();
    mockedGetRepositoryByName.mockReset();
    mockedGetRepositoryHref.mockReset();
    mockedGetRepositoryHref.mockImplementation((repositoryName) => {
      return `/Myriad-Dreamin/${repositoryName}`;
    });
    mockedGetRepositoryWorkflowsHref.mockReset();
    mockedGetRepositoryWorkflowsHref.mockImplementation((repositoryName) => {
      return `/Myriad-Dreamin/${repositoryName}/workflows`;
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
      RepositoryWorkflowsPage({
        params: {
          user: "someone-else",
          repo: "example-repo",
        },
      }),
    ).rejects.toThrowError(NEXT_NOT_FOUND_ERROR);

    expect(mockedNotFound).toHaveBeenCalledTimes(1);
    expect(mockedGetRepositoryByName).not.toHaveBeenCalled();
    expect(mockedHeadersReader).not.toHaveBeenCalled();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("calls notFound when the repository does not exist", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);
    mockedGetRepositoryByName.mockReturnValue(null);

    await expect(
      RepositoryWorkflowsPage({
        params: {
          user: "Myriad-Dreamin",
          repo: "missing-repo",
        },
      }),
    ).rejects.toThrowError(NEXT_NOT_FOUND_ERROR);

    expect(mockedGetRepositoryByName).toHaveBeenCalledWith("missing-repo");
    expect(mockedNotFound).toHaveBeenCalledTimes(1);
    expect(mockedHeadersReader).not.toHaveBeenCalled();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("calls notFound when the runs API returns a repo-scoped 404", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);
    mockedGetRepositoryByName.mockReturnValue({
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    });
    mockedHeadersReader.mockResolvedValue(
      new Headers({
        host: "localhost:3000",
      }),
    );
    mockedFetch.mockResolvedValue(
      Response.json(
        {
          error: "ugit repository example-repo does not exist on the server.",
        },
        { status: 404 },
      ),
    );

    await expect(
      RepositoryWorkflowsPage({
        params: {
          user: "Myriad-Dreamin",
          repo: "example-repo",
        },
      }),
    ).rejects.toThrowError(NEXT_NOT_FOUND_ERROR);

    expect(mockedFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/workflows/runs?repositoryName=example-repo",
      {
        cache: "no-store",
      },
    );
    expect(mockedNotFound).toHaveBeenCalledTimes(1);
  });

  it("wires the repository workflow summaries into the live client component", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);

    const repository = {
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    };

    mockedGetRepositoryByName.mockReturnValue(repository);
    mockedHeadersReader.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "ugit.example.test",
        "x-forwarded-proto": "https",
      }),
    );
    mockedFetch.mockResolvedValue(
      Response.json({
        repositoryName: "example-repo",
        workflowRuns: [],
      }),
    );

    const page = await RepositoryWorkflowsPage({
      params: {
        user: "Myriad-Dreamin",
        repo: "example-repo",
      },
    });
    const workflowRunsClient = findElementByType(page, mockedWorkflowRunsListClient);

    expect(page).toMatchObject({
      type: "main",
    });
    expect(mockedFetch).toHaveBeenCalledWith(
      "https://ugit.example.test/api/workflows/runs?repositoryName=example-repo",
      {
        cache: "no-store",
      },
    );
    expect(workflowRunsClient?.props).toMatchObject({
      initialWorkflowRuns: [],
      repositoryName: "example-repo",
    });
    expect(workflowRunsClient?.props).not.toHaveProperty("repositoryPath");
  });

  it("uses the trusted forwarded origin when proxies append forwarded headers", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);
    mockedGetRepositoryByName.mockReturnValue({
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    });
    mockedHeadersReader.mockResolvedValue(
      new Headers({
        "x-forwarded-host": "attacker.example.test, ugit.example.test",
        "x-forwarded-proto": "http, https",
      }),
    );
    mockedFetch.mockResolvedValue(
      Response.json({
        repositoryName: "example-repo",
        workflowRuns: [],
      }),
    );

    await RepositoryWorkflowsPage({
      params: {
        user: "Myriad-Dreamin",
        repo: "example-repo",
      },
    });

    expect(mockedFetch).toHaveBeenCalledWith(
      "https://ugit.example.test/api/workflows/runs?repositoryName=example-repo",
      {
        cache: "no-store",
      },
    );
  });

  it("falls back to the request host when the forwarded host is malformed", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);
    mockedGetRepositoryByName.mockReturnValue({
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    });
    mockedHeadersReader.mockResolvedValue(
      new Headers({
        host: "ugit.example.test",
        "x-forwarded-host": "[",
        "x-forwarded-proto": "https",
      }),
    );
    mockedFetch.mockResolvedValue(
      Response.json({
        repositoryName: "example-repo",
        workflowRuns: [],
      }),
    );

    await RepositoryWorkflowsPage({
      params: {
        user: "Myriad-Dreamin",
        repo: "example-repo",
      },
    });

    expect(mockedFetch).toHaveBeenCalledWith(
      "https://ugit.example.test/api/workflows/runs?repositoryName=example-repo",
      {
        cache: "no-store",
      },
    );
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
