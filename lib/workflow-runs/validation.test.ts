import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  WorkflowRunRequestError,
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
