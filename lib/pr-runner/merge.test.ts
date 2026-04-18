import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { attemptFastForwardMerge } from "@/lib/pr-runner/merge";
import { runAsyncCommand } from "@/lib/pr-runner/process";

const workspaces: string[] = [];

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("attemptFastForwardMerge", () => {
  it("fast-forwards the base branch when the queued commit descends from it", async () => {
    const repositoryPath = createGitRepository();
    const baseCommit = commitFile(repositoryPath, "README.md", "# base\n", "base");

    execFileSync("git", ["-C", repositoryPath, "checkout", "-q", "-b", "feature/test"], {
      stdio: "ignore",
    });
    const featureCommit = commitFile(repositoryPath, "feature.txt", "feature\n", "feature");

    execFileSync("git", ["-C", repositoryPath, "checkout", "-q", "main"], {
      stdio: "ignore",
    });

    await expect(
      attemptFastForwardMerge({
        repositoryPath,
        baseBranch: "main",
        commitHash: featureCommit,
      }),
    ).resolves.toEqual({
      status: "succeeded",
      message: `Fast-forwarded main to ${featureCommit}.`,
    });
    expect(readHeadCommit(repositoryPath, "main")).toBe(featureCommit);
    expect(baseCommit).not.toBe(featureCommit);
  });

  it("reports a failed merge when the base branch is no longer an ancestor", async () => {
    const repositoryPath = createGitRepository();

    commitFile(repositoryPath, "README.md", "# base\n", "base");
    execFileSync("git", ["-C", repositoryPath, "checkout", "-q", "-b", "feature/test"], {
      stdio: "ignore",
    });
    const featureCommit = commitFile(repositoryPath, "feature.txt", "feature\n", "feature");

    execFileSync("git", ["-C", repositoryPath, "checkout", "-q", "main"], {
      stdio: "ignore",
    });
    const advancedMainCommit = commitFile(repositoryPath, "main.txt", "main\n", "main");

    await expect(
      attemptFastForwardMerge({
        repositoryPath,
        baseBranch: "main",
        commitHash: featureCommit,
      }),
    ).resolves.toEqual({
      status: "failed",
      message: `Base branch main is not an ancestor of ${featureCommit}; fast-forward merge is not possible.`,
    });
    expect(readHeadCommit(repositoryPath, "main")).toBe(advancedMainCommit);
  });

  it("evicts the managed workflow slot before fast-forwarding a commit that tracks it", async () => {
    const originPath = createGitRepository();
    const baseCommit = commitFile(originPath, "README.md", "# base\n", "base");
    const repositoryPath = cloneGitRepository(originPath);
    const worktreePath = path.join(repositoryPath, "workflow1");

    execFileSync(
      "git",
      ["-C", repositoryPath, "worktree", "add", "--detach", worktreePath, baseCommit],
      {
        stdio: "ignore",
      },
    );

    execFileSync("git", ["-C", originPath, "checkout", "-q", "-b", "feature/test"], {
      stdio: "ignore",
    });
    const featureCommit = commitFile(
      originPath,
      "workflow1/project-file.txt",
      "tracked\n",
      "add workflow1 path",
    );

    execFileSync("git", ["-C", repositoryPath, "fetch", "--quiet", "origin", "feature/test"], {
      stdio: "ignore",
    });

    const runCommand = vi.fn(runAsyncCommand);

    await expect(
      attemptFastForwardMerge({
        repositoryPath,
        baseBranch: "main",
        commitHash: featureCommit,
        runCommand,
      }),
    ).resolves.toEqual({
      status: "succeeded",
      message: `Fast-forwarded main to ${featureCommit}.`,
    });

    expect(readHeadCommit(repositoryPath, "main")).toBe(featureCommit);
    expect(readGitOutput(repositoryPath, "status", "--short")).toBe("");
    expect(readFileSync(path.join(repositoryPath, "workflow1", "project-file.txt"), "utf8")).toBe(
      "tracked\n",
    );
    expect(existsSync(path.join(repositoryPath, "workflow1", ".git"))).toBe(false);
    expect(listWorktreeRemovals(runCommand)).toContain(worktreePath);
  });

  it("evicts stale workflow1 residue when git still owns the managed slot", async () => {
    const originPath = createGitRepository();
    const baseCommit = commitFile(originPath, "README.md", "# base\n", "base");
    const repositoryPath = cloneGitRepository(originPath);
    const worktreePath = path.join(repositoryPath, "workflow1");

    execFileSync(
      "git",
      ["-C", repositoryPath, "worktree", "add", "--detach", worktreePath, baseCommit],
      {
        stdio: "ignore",
      },
    );
    rmSync(path.join(worktreePath, ".git"), { force: true });
    writeFileSync(path.join(worktreePath, "README.md"), "stale\n", "utf8");

    execFileSync("git", ["-C", originPath, "checkout", "-q", "-b", "feature/stale-slot"], {
      stdio: "ignore",
    });
    const featureCommit = commitFile(
      originPath,
      "workflow1/project-file.txt",
      "tracked\n",
      "add workflow1 path",
    );

    execFileSync(
      "git",
      ["-C", repositoryPath, "fetch", "--quiet", "origin", "feature/stale-slot"],
      {
        stdio: "ignore",
      },
    );

    const runCommand = vi.fn(runAsyncCommand);

    await expect(
      attemptFastForwardMerge({
        repositoryPath,
        baseBranch: "main",
        commitHash: featureCommit,
        runCommand,
      }),
    ).resolves.toEqual({
      status: "succeeded",
      message: `Fast-forwarded main to ${featureCommit}.`,
    });

    expect(readHeadCommit(repositoryPath, "main")).toBe(featureCommit);
    expect(readGitOutput(repositoryPath, "status", "--short")).toBe("");
    expect(existsSync(path.join(worktreePath, "README.md"))).toBe(false);
    expect(readFileSync(path.join(worktreePath, "project-file.txt"), "utf8")).toBe("tracked\n");
    expect(listWorktreeRemovals(runCommand)).toContain(worktreePath);
  });

  it("fails before fast-forwarding when unregistered workflow1 residue would dirty the repo", async () => {
    const originPath = createGitRepository();
    const baseCommit = commitFile(originPath, "README.md", "# base\n", "base");
    const repositoryPath = cloneGitRepository(originPath);
    const worktreePath = path.join(repositoryPath, "workflow1");

    execFileSync(
      "git",
      ["-C", repositoryPath, "worktree", "add", "--detach", worktreePath, baseCommit],
      {
        stdio: "ignore",
      },
    );
    rmSync(path.join(worktreePath, ".git"), { force: true });
    writeFileSync(path.join(worktreePath, "README.md"), "stale\n", "utf8");
    execFileSync("git", ["-C", repositoryPath, "worktree", "prune"], {
      stdio: "ignore",
    });

    execFileSync("git", ["-C", originPath, "checkout", "-q", "-b", "feature/blocked-slot"], {
      stdio: "ignore",
    });
    const featureCommit = commitFile(
      originPath,
      "workflow1/project-file.txt",
      "tracked\n",
      "add workflow1 path",
    );

    execFileSync(
      "git",
      ["-C", repositoryPath, "fetch", "--quiet", "origin", "feature/blocked-slot"],
      {
        stdio: "ignore",
      },
    );

    const runCommand = vi.fn(runAsyncCommand);

    await expect(
      attemptFastForwardMerge({
        repositoryPath,
        baseBranch: "main",
        commitHash: featureCommit,
        runCommand,
      }),
    ).resolves.toMatchObject({
      status: "failed",
      message: expect.stringContaining("Refusing to remove"),
    });

    expect(readHeadCommit(repositoryPath, "main")).toBe(baseCommit);
    expect(
      readGitOutput(
        repositoryPath,
        "status",
        "--short",
        "--untracked-files=all",
        "--",
        "workflow1",
      ),
    ).toBe("?? workflow1/README.md");
    expect(listWorktreeRemovals(runCommand)).not.toContain(worktreePath);
  });
});

function createGitRepository(): string {
  const repositoryPath = mkdtempSync(path.join(os.tmpdir(), "ugit-pr-merge-"));

  workspaces.push(repositoryPath);

  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "--quiet", repositoryPath], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "config", "user.name", "ugit-test"], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "config", "user.email", "ugit@example.com"], {
    stdio: "ignore",
  });

  return repositoryPath;
}

function cloneGitRepository(sourcePath: string): string {
  const repositoryPath = mkdtempSync(path.join(os.tmpdir(), "ugit-pr-merge-clone-"));

  workspaces.push(repositoryPath);

  execFileSync("git", ["clone", "--quiet", sourcePath, repositoryPath], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "config", "user.name", "ugit-test"], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "config", "user.email", "ugit@example.com"], {
    stdio: "ignore",
  });

  return repositoryPath;
}

function commitFile(
  repositoryPath: string,
  relativePath: string,
  contents: string,
  message: string,
): string {
  const filePath = path.join(repositoryPath, relativePath);

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
  execFileSync("git", ["-C", repositoryPath, "add", relativePath], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "commit", "-q", "-m", message], {
    stdio: "ignore",
  });

  return readHeadCommit(repositoryPath, "HEAD");
}

function readHeadCommit(repositoryPath: string, refName: string): string {
  return readGitOutput(repositoryPath, "rev-parse", refName);
}

function readGitOutput(repositoryPath: string, ...args: string[]): string {
  return execFileSync("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function listWorktreeRemovals(runCommand: ReturnType<typeof vi.fn>): string[] {
  return runCommand.mock.calls
    .filter(([, args]) => args.includes("worktree") && args.includes("remove"))
    .map(([, args]) => String(args[args.length - 1]));
}
