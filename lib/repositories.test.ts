import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureExampleRepository,
  getRepositoryByName,
  listRepositories,
  listRepositoryRootEntries,
} from "@/lib/repositories";

const workspaces: string[] = [];

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("ensureExampleRepository", () => {
  it("creates a real Git repository and preserves existing README content", () => {
    const cwd = createWorkspace();
    const exampleRepository = ensureExampleRepository({ cwd });
    const readmePath = path.join(exampleRepository.path, "README.md");

    expect(existsSync(path.join(exampleRepository.path, ".git", "HEAD"))).toBe(true);
    expect(readFileSync(readmePath, "utf8")).toContain("# example-repo");

    writeFileSync(readmePath, "# customized\n", "utf8");

    expect(ensureExampleRepository({ cwd })).toEqual(exampleRepository);
    expect(readFileSync(readmePath, "utf8")).toBe("# customized\n");
  });
});

describe("listRepositories", () => {
  it("returns a stable list of direct child Git repositories only", () => {
    const cwd = createWorkspace();
    const repositoriesRoot = path.join(cwd, ".data", "repos");

    mkdirSync(path.join(repositoriesRoot, "zeta"), { recursive: true });
    mkdirSync(path.join(repositoriesRoot, "alpha"), { recursive: true });
    mkdirSync(path.join(repositoriesRoot, "notes"), { recursive: true });
    mkdirSync(path.join(repositoriesRoot, "container", "nested"), {
      recursive: true,
    });

    initializeGitRepository(path.join(repositoriesRoot, "zeta"));
    initializeGitRepository(path.join(repositoriesRoot, "alpha"));
    initializeGitRepository(path.join(repositoriesRoot, "container", "nested"));

    expect(listRepositories({ cwd })).toEqual([
      {
        name: "alpha",
        path: path.join(repositoriesRoot, "alpha"),
        relativePath: path.join(".data", "repos", "alpha"),
      },
      {
        name: "example-repo",
        path: path.join(repositoriesRoot, "example-repo"),
        relativePath: path.join(".data", "repos", "example-repo"),
      },
      {
        name: "zeta",
        path: path.join(repositoriesRoot, "zeta"),
        relativePath: path.join(".data", "repos", "zeta"),
      },
    ]);
  });
});

describe("getRepositoryByName", () => {
  it("returns null for missing repositories and nested Git directories", () => {
    const cwd = createWorkspace();
    const repositoriesRoot = path.join(cwd, ".data", "repos");

    mkdirSync(path.join(repositoriesRoot, "notes"), { recursive: true });
    mkdirSync(path.join(repositoriesRoot, "container", "nested"), {
      recursive: true,
    });

    initializeGitRepository(path.join(repositoriesRoot, "container", "nested"));

    expect(getRepositoryByName("missing", { cwd })).toBeNull();
    expect(getRepositoryByName("notes", { cwd })).toBeNull();
    expect(getRepositoryByName("nested", { cwd })).toBeNull();
  });
});

describe("listRepositoryRootEntries", () => {
  it("lists direct root entries in stable order and filters the .git directory", () => {
    const cwd = createWorkspace();
    const repositoryPath = createGitRepository(cwd, "alpha");

    mkdirSync(path.join(repositoryPath, "docs"), { recursive: true });
    mkdirSync(path.join(repositoryPath, "src"), { recursive: true });
    writeFileSync(path.join(repositoryPath, "zeta.md"), "zeta\n", "utf8");
    writeFileSync(path.join(repositoryPath, "README.md"), "# alpha\n", "utf8");

    const repository = getRepositoryByName("alpha", { cwd });

    expect(repository).not.toBeNull();
    expect(listRepositoryRootEntries(repository!)).toEqual([
      {
        kind: "file",
        name: "README.md",
        path: path.join(repositoryPath, "README.md"),
        relativePath: path.join(".data", "repos", "alpha", "README.md"),
      },
      {
        kind: "directory",
        name: "docs",
        path: path.join(repositoryPath, "docs"),
        relativePath: path.join(".data", "repos", "alpha", "docs"),
      },
      {
        kind: "directory",
        name: "src",
        path: path.join(repositoryPath, "src"),
        relativePath: path.join(".data", "repos", "alpha", "src"),
      },
      {
        kind: "file",
        name: "zeta.md",
        path: path.join(repositoryPath, "zeta.md"),
        relativePath: path.join(".data", "repos", "alpha", "zeta.md"),
      },
    ]);
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-repositories-"));

  workspaces.push(workspace);

  return workspace;
}

function createGitRepository(cwd: string, repositoryName: string): string {
  const repositoryPath = path.join(cwd, ".data", "repos", repositoryName);

  mkdirSync(repositoryPath, { recursive: true });
  initializeGitRepository(repositoryPath);

  return repositoryPath;
}

function initializeGitRepository(repositoryPath: string): void {
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "--quiet", repositoryPath], {
    stdio: "ignore",
  });
}
