import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validatePullRequestSyncRequest } from "@/lib/pr-runner/validation";

const workspaces: string[] = [];

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("validatePullRequestSyncRequest", () => {
  it("accepts a valid pull-request synchronization payload", () => {
    const cwd = createWorkspace();
    const repositoryPath = createRepositorySkeleton(cwd, "alpha");

    expect(
      validatePullRequestSyncRequest(
        {
          publishedBranch: {
            repositoryPath,
            branchName: "feature/test",
            commitHash: "abcdef1",
            remoteName: "origin",
          },
          pullRequest: {
            repositoryPath,
            branchName: "feature/test",
            baseBranch: "main",
            title: "Add a feature",
            body: "Implements the feature.",
          },
        },
        { cwd },
      ),
    ).toEqual({
      publishedBranch: {
        repositoryPath,
        branchName: "feature/test",
        commitHash: "abcdef1",
        remoteName: "origin",
        pushedAt: undefined,
      },
      pullRequest: {
        repositoryPath,
        branchName: "feature/test",
        baseBranch: "main",
        title: "Add a feature",
        body: "Implements the feature.",
        draft: false,
        remoteName: undefined,
      },
      repositoryName: "alpha",
      repositoryPath,
    });
  });

  it("rejects repositories outside the ugit repository root", () => {
    const cwd = createWorkspace();
    const outsideRepositoryPath = path.join(cwd, "..", "outside-repo");

    mkdirSync(path.join(outsideRepositoryPath, ".git"), { recursive: true });

    expect(() =>
      validatePullRequestSyncRequest(
        {
          publishedBranch: {
            repositoryPath: outsideRepositoryPath,
            branchName: "feature/test",
            commitHash: "abcdef1",
          },
          pullRequest: {
            repositoryPath: outsideRepositoryPath,
            branchName: "feature/test",
            baseBranch: "main",
            title: "Add a feature",
            body: "",
          },
        },
        { cwd },
      ),
    ).toThrow(
      `Repository path ${path.normalize(outsideRepositoryPath)} is outside the configured ugit repository root.`,
    );
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-pr-validation-"));

  workspaces.push(workspace);

  return workspace;
}

function createRepositorySkeleton(cwd: string, repositoryName: string): string {
  const repositoryPath = path.join(cwd, ".data", "repos", repositoryName);

  mkdirSync(path.join(repositoryPath, ".git"), { recursive: true });

  return repositoryPath;
}
