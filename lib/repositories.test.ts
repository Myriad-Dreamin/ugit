import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureExampleRepository, listRepositories } from "@/lib/repositories";

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

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-repositories-"));

  workspaces.push(workspace);

  return workspace;
}

function initializeGitRepository(repositoryPath: string): void {
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "--quiet", repositoryPath], {
    stdio: "ignore",
  });
}
