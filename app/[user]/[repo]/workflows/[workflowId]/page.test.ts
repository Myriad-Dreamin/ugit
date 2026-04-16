import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowRunRequestError } from "@/lib/workflow-runs/validation";

const NEXT_NOT_FOUND_ERROR = "NEXT_NOT_FOUND";

const { mockedWorkflowRunDetailClient } = vi.hoisted(() => ({
  mockedWorkflowRunDetailClient: vi.fn(() => null),
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
  getWorkflowRunPageData: vi.fn(),
}));

vi.mock("@/app/[user]/[repo]/workflows/[workflowId]/workflow-run-detail-client", () => ({
  WorkflowRunDetailClient: mockedWorkflowRunDetailClient,
}));

import WorkflowRunPage from "@/app/[user]/[repo]/workflows/[workflowId]/page";
import { getRepositoryHref, getRepositoryWorkflowsHref, isConfiguredOwner } from "@/lib/owner";
import { getRepositoryByName } from "@/lib/repositories";
import { getWorkflowRunPageData } from "@/lib/workflow-runs/service";
import { notFound } from "next/navigation";

const mockedNotFound = vi.mocked(notFound);
const mockedGetRepositoryByName = vi.mocked(getRepositoryByName);
const mockedGetRepositoryHref = vi.mocked(getRepositoryHref);
const mockedGetRepositoryWorkflowsHref = vi.mocked(getRepositoryWorkflowsHref);
const mockedIsConfiguredOwner = vi.mocked(isConfiguredOwner);
const mockedGetWorkflowRunPageData = vi.mocked(getWorkflowRunPageData);

describe("WorkflowRunPage", () => {
  beforeEach(() => {
    mockedNotFound.mockClear();
    mockedNotFound.mockImplementation(() => {
      throw new Error(NEXT_NOT_FOUND_ERROR);
    });

    mockedWorkflowRunDetailClient.mockClear();
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
    mockedGetWorkflowRunPageData.mockReset();
  });

  it("calls notFound for unsupported users", async () => {
    mockedIsConfiguredOwner.mockReturnValue(false);

    await expect(
      WorkflowRunPage({
        params: {
          user: "someone-else",
          repo: "example-repo",
          workflowId: "workflow-1",
        },
      }),
    ).rejects.toThrowError(NEXT_NOT_FOUND_ERROR);

    expect(mockedNotFound).toHaveBeenCalledTimes(1);
    expect(mockedGetRepositoryByName).not.toHaveBeenCalled();
  });

  it("calls notFound when the workflow does not belong to the repository", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);
    mockedGetRepositoryByName.mockReturnValue({
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    });
    mockedGetWorkflowRunPageData.mockImplementation(() => {
      throw new WorkflowRunRequestError("No workflow run exists for example-repo:workflow-1.", 404);
    });

    await expect(
      WorkflowRunPage({
        params: {
          user: "Myriad-Dreamin",
          repo: "example-repo",
          workflowId: "workflow-1",
        },
      }),
    ).rejects.toThrowError(NEXT_NOT_FOUND_ERROR);

    expect(mockedGetWorkflowRunPageData).toHaveBeenCalledWith({
      repositoryPath: "/tmp/example-repo",
      workflowId: "workflow-1",
    });
    expect(mockedNotFound).toHaveBeenCalledTimes(1);
  });

  it("wires repo-scoped workflow page data into the live detail client component", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);

    mockedGetRepositoryByName.mockReturnValue({
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    });
    mockedGetWorkflowRunPageData.mockReturnValue({
      repositoryName: "example-repo",
      workflowRun: {
        id: "workflow-1",
        repositoryName: "example-repo",
        repositoryPath: "/tmp/example-repo",
        branchName: "feature/test",
        commitHash: "abcdef1",
        workflowName: "lint",
        status: "running",
        errorMessage: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:05.000Z",
        startedAt: "2026-04-14T00:00:02.000Z",
        finishedAt: null,
      },
      initialLog: {
        text: "Queued workflow.\n",
        nextOffset: 16,
      },
    });

    const page = await WorkflowRunPage({
      params: {
        user: "Myriad-Dreamin",
        repo: "example-repo",
        workflowId: "workflow-1",
      },
    });
    const workflowRunDetailClient = findElementByType(page, mockedWorkflowRunDetailClient);

    expect(page).toMatchObject({
      type: "main",
    });
    expect(workflowRunDetailClient?.props).toMatchObject({
      initialLogOffset: 16,
      initialLogText: "Queued workflow.\n",
      initialWorkflowRun: expect.objectContaining({
        id: "workflow-1",
        workflowName: "lint",
      }),
      repositoryPath: "/tmp/example-repo",
    });
  });
});

type ElementWithChildren = ReactElement<{ children?: unknown }>;

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
