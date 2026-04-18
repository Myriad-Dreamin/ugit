import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/app/[user]/[repo]/workflows/workflow-runs-list-client", () => ({
  WorkflowRunsListClient: mockedWorkflowRunsListClient,
}));

import { GET as getWorkflowRunsRoute } from "@/app/api/workflows/runs/route";
import RepositoryWorkflowsPage from "@/app/[user]/[repo]/workflows/page";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
import { queueWorkflowRun } from "@/lib/workflow-runs/service";

const workspaces: string[] = [];
const originalCwd = process.cwd();
const mockedHeadersReader = vi.mocked(mockedHeaders);
const mockedFetch = vi.fn<typeof fetch>();

vi.stubGlobal("fetch", mockedFetch);

describe("RepositoryWorkflowsPage queue-to-list bootstrap", () => {
  beforeEach(() => {
    mockedWorkflowRunsListClient.mockClear();
    mockedHeadersReader.mockReset();
    mockedHeadersReader.mockResolvedValue(
      new Headers({
        host: "localhost",
      }),
    );
    mockedFetch.mockReset();
    mockedFetch.mockImplementation(async (input, init) => {
      const request = input instanceof Request ? input : new Request(String(input), init);

      return await getWorkflowRunsRoute(request);
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    resetStorageCacheForTests();

    while (workspaces.length > 0) {
      const workspace = workspaces.pop();

      if (workspace) {
        rmSync(workspace, { recursive: true, force: true });
      }
    }
  });

  it("hydrates queued repo worktree runs through the repo-scoped runs API", async () => {
    const workspace = createWorkspace();

    createRepositorySkeleton(workspace, "alpha");

    const workflowRepositoryPath = createRepositoryWorktree(workspace, "alpha", "feature/test");

    process.chdir(workspace);

    queueWorkflowRun(createPayload(workflowRepositoryPath), {
      cwd: workspace,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
      nudgeRunner: async () => undefined,
    });

    const page = await RepositoryWorkflowsPage({
      params: {
        user: "Myriad-Dreamin",
        repo: "alpha",
      },
    });
    const workflowRunsClient = findElementByType(page, mockedWorkflowRunsListClient);
    const workflowRunsClientProps = workflowRunsClient?.props as
      | {
          repositoryName: string;
          initialWorkflowRuns: Array<Record<string, unknown>>;
        }
      | undefined;

    expect(mockedFetch).toHaveBeenCalledWith(
      "http://localhost/api/workflows/runs?repositoryName=alpha",
      {
        cache: "no-store",
      },
    );
    expect(workflowRunsClientProps).toMatchObject({
      repositoryName: "alpha",
      initialWorkflowRuns: [
        expect.objectContaining({
          id: "workflow-1",
          repositoryName: "alpha",
          status: "queued",
        }),
      ],
    });
    expect(workflowRunsClientProps?.initialWorkflowRuns[0]).not.toHaveProperty("repositoryPath");
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-workflow-page-"));

  workspaces.push(workspace);

  return workspace;
}

function createRepositorySkeleton(workspace: string, repositoryName: string): string {
  const repositoryPath = path.join(workspace, ".data", "repos", repositoryName);

  mkdirSync(path.join(repositoryPath, ".git"), { recursive: true });

  return repositoryPath;
}

function createRepositoryWorktree(
  workspace: string,
  repositoryName: string,
  worktreeName: string,
): string {
  const worktreePath = path.join(
    workspace,
    ".data",
    "repos",
    repositoryName,
    ".ugit",
    "worktrees",
    worktreeName,
  );

  mkdirSync(path.join(worktreePath, ".git"), { recursive: true });

  return worktreePath;
}

function createPayload(repositoryPath: string): Record<string, unknown> {
  return {
    publishedBranch: {
      repositoryPath,
      branchName: "feature/test",
      commitHash: "abcdef1",
      remoteName: "origin",
    },
    workflowName: "lint",
  };
}

function createIdFactory(...ids: string[]): () => string {
  let index = 0;

  return () => {
    const id = ids[Math.min(index, ids.length - 1)];

    index += 1;

    return id;
  };
}

function createNowFactory(...timestamps: string[]): () => Date {
  let index = 0;

  return () => {
    const timestamp = timestamps[Math.min(index, timestamps.length - 1)];

    index += 1;

    return new Date(timestamp);
  };
}

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
