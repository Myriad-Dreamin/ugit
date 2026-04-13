import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { attemptFastForwardMerge } from "@/lib/pr-runner/merge";

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

function commitFile(
  repositoryPath: string,
  relativePath: string,
  contents: string,
  message: string,
): string {
  writeFileSync(path.join(repositoryPath, relativePath), contents, "utf8");
  execFileSync("git", ["-C", repositoryPath, "add", relativePath], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "commit", "-q", "-m", message], {
    stdio: "ignore",
  });

  return readHeadCommit(repositoryPath, "HEAD");
}

function readHeadCommit(repositoryPath: string, refName: string): string {
  return execFileSync("git", ["-C", repositoryPath, "rev-parse", refName], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
