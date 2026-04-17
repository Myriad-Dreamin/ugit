import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NEXT_NOT_FOUND_ERROR = "NEXT_NOT_FOUND";

const { mockedWorkflowRunsListClient } = vi.hoisted(() => ({
  mockedWorkflowRunsListClient: vi.fn(() => null),
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

vi.mock("@/lib/workflow-runs/service", () => ({
  listWorkflowRuns: vi.fn(),
}));

vi.mock("@/app/[user]/[repo]/workflows/workflow-runs-list-client", () => ({
  WorkflowRunsListClient: mockedWorkflowRunsListClient,
}));

import RepositoryWorkflowsPage from "@/app/[user]/[repo]/workflows/page";
import { getRepositoryHref, getRepositoryWorkflowsHref, isConfiguredOwner } from "@/lib/owner";
import { getRepositoryByName } from "@/lib/repositories";
import { listWorkflowRuns } from "@/lib/workflow-runs/service";
import { notFound } from "next/navigation";

const mockedNotFound = vi.mocked(notFound);
const mockedGetRepositoryByName = vi.mocked(getRepositoryByName);
const mockedGetRepositoryHref = vi.mocked(getRepositoryHref);
const mockedGetRepositoryWorkflowsHref = vi.mocked(getRepositoryWorkflowsHref);
const mockedIsConfiguredOwner = vi.mocked(isConfiguredOwner);
const mockedListWorkflowRuns = vi.mocked(listWorkflowRuns);

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
    mockedListWorkflowRuns.mockReset();
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
  });

  it("wires the repository workflow summaries into the live client component", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);

    const repository = {
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    };

    mockedGetRepositoryByName.mockReturnValue(repository);
    mockedListWorkflowRuns.mockReturnValue({
      repositoryName: "example-repo",
      workflowRuns: [],
    });

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
    expect(mockedListWorkflowRuns).toHaveBeenCalledWith({
      repositoryName: "example-repo",
    });
    expect(workflowRunsClient?.props).toMatchObject({
      initialWorkflowRuns: [],
      repositoryName: "example-repo",
    });
    expect(workflowRunsClient?.props).not.toHaveProperty("repositoryPath");
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
