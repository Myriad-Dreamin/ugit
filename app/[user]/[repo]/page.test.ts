import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const NEXT_NOT_FOUND_ERROR = "NEXT_NOT_FOUND";

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
  isConfiguredOwner: vi.fn(),
}));

vi.mock("@/lib/repositories", () => ({
  getRepositoryByName: vi.fn(),
  listRepositoryRootEntries: vi.fn(),
}));

vi.mock("@/lib/repository-workflow-summary", () => ({
  getRepositoryWorkflowPanelSummary: vi.fn(),
}));

import RepositoryPage from "@/app/[user]/[repo]/page";
import { getRepositoryHref, isConfiguredOwner } from "@/lib/owner";
import { getRepositoryByName, listRepositoryRootEntries } from "@/lib/repositories";
import { getRepositoryWorkflowPanelSummary } from "@/lib/repository-workflow-summary";
import { notFound } from "next/navigation";

const mockedNotFound = vi.mocked(notFound);
const mockedGetRepositoryByName = vi.mocked(getRepositoryByName);
const mockedGetRepositoryHref = vi.mocked(getRepositoryHref);
const mockedIsConfiguredOwner = vi.mocked(isConfiguredOwner);
const mockedListRepositoryRootEntries = vi.mocked(listRepositoryRootEntries);
const mockedGetRepositoryWorkflowPanelSummary = vi.mocked(getRepositoryWorkflowPanelSummary);

describe("RepositoryPage", () => {
  beforeEach(() => {
    mockedNotFound.mockClear();
    mockedNotFound.mockImplementation(() => {
      throw new Error(NEXT_NOT_FOUND_ERROR);
    });

    mockedGetRepositoryByName.mockReset();
    mockedGetRepositoryHref.mockReset();
    mockedGetRepositoryHref.mockImplementation((repositoryName) => {
      return `/Myriad-Dreamin/${repositoryName}`;
    });
    mockedIsConfiguredOwner.mockReset();
    mockedListRepositoryRootEntries.mockReset();
    mockedGetRepositoryWorkflowPanelSummary.mockReset();
    mockedGetRepositoryWorkflowPanelSummary.mockReturnValue({
      repositoryName: "example-repo",
      status: "empty",
      branchSummaries: [],
    });
  });

  it("calls notFound for unsupported users", async () => {
    mockedIsConfiguredOwner.mockReturnValue(false);

    await expect(
      RepositoryPage({
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
      RepositoryPage({
        params: {
          user: "Myriad-Dreamin",
          repo: "missing-repo",
        },
      }),
    ).rejects.toThrowError(NEXT_NOT_FOUND_ERROR);

    expect(mockedGetRepositoryByName).toHaveBeenCalledWith("missing-repo");
    expect(mockedNotFound).toHaveBeenCalledTimes(1);
  });

  it("renders an empty workflow panel while keeping repository root entries", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);

    const repository = {
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    };

    mockedGetRepositoryByName.mockReturnValue(repository);
    mockedListRepositoryRootEntries.mockReturnValue([
      {
        kind: "file",
        name: "README.md",
        path: "/tmp/example-repo/README.md",
        relativePath: ".data/repos/example-repo/README.md",
      },
    ]);

    const page = await RepositoryPage({
      params: Promise.resolve({
        user: "Myriad-Dreamin",
        repo: "example-repo",
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(page).toMatchObject({
      type: "main",
    });
    expect(markup).toContain("Workflow status");
    expect(markup).toContain("Empty");
    expect(markup).toContain("No triggered workflows have been recorded for this repository yet.");
    expect(markup).toContain("Repository root entries");
    expect(markup).toContain("README.md");
    expect(mockedGetRepositoryByName).toHaveBeenCalledWith("example-repo");
    expect(mockedListRepositoryRootEntries).toHaveBeenCalledWith(repository);
    expect(mockedGetRepositoryHref).toHaveBeenCalledWith("example-repo");
    expect(mockedGetRepositoryWorkflowPanelSummary).toHaveBeenCalledWith(repository);
  });

  it("renders populated workflow details with mixed repository status", async () => {
    mockedIsConfiguredOwner.mockReturnValue(true);

    const repository = {
      name: "example-repo",
      path: "/tmp/example-repo",
      relativePath: ".data/repos/example-repo",
    };

    mockedGetRepositoryByName.mockReturnValue(repository);
    mockedListRepositoryRootEntries.mockReturnValue([
      {
        kind: "directory",
        name: "docs",
        path: "/tmp/example-repo/docs",
        relativePath: ".data/repos/example-repo/docs",
      },
    ]);
    mockedGetRepositoryWorkflowPanelSummary.mockReturnValue({
      repositoryName: "example-repo",
      status: "mixed",
      branchSummaries: [
        {
          branchName: "feature/test",
          commitHash: "abcdef1234567890",
          status: "succeeded",
          queuedAt: "2026-04-14T00:00:00.000Z",
          startedAt: "2026-04-14T00:00:10.000Z",
          finishedAt: "2026-04-14T00:00:20.000Z",
          activityAt: "2026-04-14T00:00:20.000Z",
          source: "artifact",
          workflows: [
            {
              name: "lint",
              status: "passed",
            },
            {
              name: "test",
              status: "failed",
            },
          ],
        },
        {
          branchName: "feature/live",
          commitHash: "9876543210fedcba",
          status: "running",
          queuedAt: "2026-04-14T01:00:00.000Z",
          startedAt: "2026-04-14T01:05:00.000Z",
          finishedAt: null,
          activityAt: "2026-04-14T01:05:00.000Z",
          source: "active_job",
          workflows: [],
        },
      ],
    });

    const markup = renderToStaticMarkup(
      await RepositoryPage({
        params: {
          user: "Myriad-Dreamin",
          repo: "example-repo",
        },
      }),
    );

    expect(markup).toContain("Mixed results");
    expect(markup).toContain("feature/test");
    expect(markup).toContain("feature/live");
    expect(markup).toContain("Commit <code>abcdef1</code>");
    expect(markup).toContain("Commit <code>9876543</code>");
    expect(markup).toContain("Mixed workflow results");
    expect(markup).toContain("lint");
    expect(markup).toContain("Passed");
    expect(markup).toContain("test");
    expect(markup).toContain("Failed");
    expect(markup).toContain("Queued");
    expect(markup).toContain("Started");
    expect(markup).toContain("Finished");
    expect(markup).toContain("Detailed workflow results will appear after this run finishes.");
  });
});
