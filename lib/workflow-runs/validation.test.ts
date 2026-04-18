import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveWorkflowReadRepository,
  WorkflowRunRequestError,
  validateWorkflowLogsRequest,
  validateWorkflowRunDetailRequest,
  validateWorkflowRunListRequest,
  validateWorkflowRunRequest,
} from "@/lib/workflow-runs/validation";

const workspaces: string[] = [];

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("validateWorkflowRunRequest", () => {
  it("rejects workflow names with path traversal", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");

    expect(() =>
      validateWorkflowRunRequest(
        {
          publishedBranch: {
            repositoryPath,
            branchName: "feature/test",
            commitHash: "abcdef1",
          },
          workflowName: "../lint",
        },
        {
          cwd: workspace,
        },
      ),
    ).toThrowError(WorkflowRunRequestError);
  });

  it("keeps the owning repository name stable when the execution path is a repo worktree", () => {
    const workspace = createWorkspace();

    createRepositorySkeleton(workspace, "alpha");

    const workflowRepositoryPath = createRepositoryWorktree(workspace, "alpha", "feature/test");

    expect(
      validateWorkflowRunRequest(
        {
          publishedBranch: {
            repositoryPath: workflowRepositoryPath,
            branchName: "feature/test",
            commitHash: "abcdef1",
          },
          workflowName: "lint",
        },
        {
          cwd: workspace,
        },
      ),
    ).toEqual({
      publishedBranch: {
        repositoryPath: workflowRepositoryPath,
        branchName: "feature/test",
        commitHash: "abcdef1",
        remoteName: undefined,
        pushedAt: undefined,
      },
      repositoryName: "alpha",
      repositoryPath: workflowRepositoryPath,
      workflowName: "lint",
    });
  });
});

describe("validateWorkflowRunDetailRequest", () => {
  it("accepts repo-scoped detail reads without exposing repository paths", () => {
    expect(
      validateWorkflowRunDetailRequest({
        repositoryName: "alpha",
        workflowId: "workflow-1",
      }),
    ).toEqual({
      repositoryName: "alpha",
      workflowId: "workflow-1",
    });
  });
});

describe("validateWorkflowRunListRequest", () => {
  it("accepts repo-scoped list reads without repository paths", () => {
    expect(
      validateWorkflowRunListRequest({
        repositoryName: "alpha",
      }),
    ).toEqual({
      repositoryName: "alpha",
    });
  });
});

describe("resolveWorkflowReadRepository", () => {
  it("resolves a repository name into a server-side repository path", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");

    expect(
      resolveWorkflowReadRepository("alpha", {
        cwd: workspace,
      }),
    ).toEqual({
      repositoryName: "alpha",
      repositoryPath,
    });
  });

  it("rejects missing repositories by name", () => {
    const workspace = createWorkspace();

    expect(() =>
      resolveWorkflowReadRepository("missing-repo", {
        cwd: workspace,
      }),
    ).toThrowError(WorkflowRunRequestError);
  });
});

describe("validateWorkflowLogsRequest", () => {
  it("accepts repo-scoped log streams with offsets", () => {
    expect(
      validateWorkflowLogsRequest({
        workflowId: "workflow-1",
        repositoryName: "alpha",
        offset: "42",
      }),
    ).toEqual({
      workflowId: "workflow-1",
      repositoryName: "alpha",
      offset: 42,
    });
  });

  it("preserves workflow-id-only log reads for non-browser callers", () => {
    expect(
      validateWorkflowLogsRequest({
        workflowId: "workflow-1",
      }),
    ).toEqual({
      workflowId: "workflow-1",
      repositoryName: null,
      offset: 0,
    });
  });

  it("rejects negative offsets", () => {
    expect(() =>
      validateWorkflowLogsRequest({
        workflowId: "workflow-1",
        offset: "-1",
      }),
    ).toThrowError(WorkflowRunRequestError);
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-workflow-validation-"));

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
