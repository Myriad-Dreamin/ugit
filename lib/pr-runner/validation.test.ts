import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolvePullRequestReadRepository,
  validatePullRequestEditRequest,
  validatePullRequestListRequest,
  validatePullRequestSyncRequest,
  validateRepositoryPullRequestDetailRequest,
  validateRepositoryPullRequestListRequest,
} from "@/lib/pr-runner/validation";

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

describe("validatePullRequestListRequest", () => {
  it("defaults the list state to open and normalizes repository filters", () => {
    const cwd = createWorkspace();
    const repositoryPath = createRepositorySkeleton(cwd, "alpha");

    expect(
      validatePullRequestListRequest(
        {
          repositoryPath,
          headBranch: "feature/test",
        },
        { cwd },
      ),
    ).toEqual({
      repositoryName: "alpha",
      repositoryPath,
      state: "open",
      baseBranch: undefined,
      headBranch: "feature/test",
    });
  });

  it("rejects invalid list state filters", () => {
    const cwd = createWorkspace();
    const repositoryPath = createRepositorySkeleton(cwd, "alpha");

    expect(() =>
      validatePullRequestListRequest(
        {
          repositoryPath,
          state: "closed",
        },
        { cwd },
      ),
    ).toThrow('state must be one of "open", "merged", or "all".');
  });
});

describe("validatePullRequestEditRequest", () => {
  it("accepts metadata-only pull-request edits", () => {
    const cwd = createWorkspace();
    const repositoryPath = createRepositorySkeleton(cwd, "alpha");

    expect(
      validatePullRequestEditRequest(
        {
          repositoryPath,
          branchName: "feature/test",
          title: "Refine the runner logs",
          body: "",
          draft: true,
        },
        { cwd },
      ),
    ).toEqual({
      repositoryName: "alpha",
      repositoryPath,
      branchName: "feature/test",
      title: "Refine the runner logs",
      body: "",
      baseBranch: undefined,
      draft: true,
    });
  });

  it("requires at least one editable field", () => {
    const cwd = createWorkspace();
    const repositoryPath = createRepositorySkeleton(cwd, "alpha");

    expect(() =>
      validatePullRequestEditRequest(
        {
          repositoryPath,
          branchName: "feature/test",
        },
        { cwd },
      ),
    ).toThrow("At least one editable field must be provided.");
  });
});

describe("validateRepositoryPullRequestListRequest", () => {
  it("resolves repository names for browser-safe list reads", () => {
    const cwd = createWorkspace();

    createRepositorySkeleton(cwd, "alpha");

    expect(
      validateRepositoryPullRequestListRequest(
        {
          repositoryName: "alpha",
        },
        { cwd },
      ),
    ).toEqual({
      repositoryName: "alpha",
      repositoryPath: path.join(cwd, ".data", "repos", "alpha"),
      state: "all",
      baseBranch: undefined,
      headBranch: undefined,
    });
  });
});

describe("validateRepositoryPullRequestDetailRequest", () => {
  it("resolves repository detail reads and numeric pull-request ids", () => {
    const cwd = createWorkspace();

    createRepositorySkeleton(cwd, "alpha");

    expect(
      validateRepositoryPullRequestDetailRequest(
        {
          repositoryName: "alpha",
          pullRequestId: "17",
        },
        { cwd },
      ),
    ).toEqual({
      repositoryName: "alpha",
      repositoryPath: path.join(cwd, ".data", "repos", "alpha"),
      pullRequestId: 17,
    });
  });
});

describe("resolvePullRequestReadRepository", () => {
  it("rejects unknown repositories for repo-scoped reads", () => {
    const cwd = createWorkspace();

    expect(() =>
      resolvePullRequestReadRepository("missing-repo", {
        cwd,
      }),
    ).toThrow("ugit repository missing-repo does not exist on the server.");
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
