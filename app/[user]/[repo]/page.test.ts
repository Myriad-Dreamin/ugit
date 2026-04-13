import { beforeEach, describe, expect, it, vi } from "vitest";

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

import RepositoryPage from "@/app/[user]/[repo]/page";
import { getRepositoryHref, isConfiguredOwner } from "@/lib/owner";
import { getRepositoryByName, listRepositoryRootEntries } from "@/lib/repositories";
import { notFound } from "next/navigation";

const mockedNotFound = vi.mocked(notFound);
const mockedGetRepositoryByName = vi.mocked(getRepositoryByName);
const mockedGetRepositoryHref = vi.mocked(getRepositoryHref);
const mockedIsConfiguredOwner = vi.mocked(isConfiguredOwner);
const mockedListRepositoryRootEntries = vi.mocked(listRepositoryRootEntries);

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

  it("loads the repository root entries for valid routes", async () => {
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

    expect(page).toMatchObject({
      type: "main",
    });
    expect(mockedGetRepositoryByName).toHaveBeenCalledWith("example-repo");
    expect(mockedListRepositoryRootEntries).toHaveBeenCalledWith(repository);
    expect(mockedGetRepositoryHref).toHaveBeenCalledWith("example-repo");
  });
});
