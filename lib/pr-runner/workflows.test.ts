import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeWorkflowPackages } from "@/lib/pr-runner/workflows";
import type { AsyncCommandRunner } from "@/lib/pr-runner/process";

const workspaces: string[] = [];

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("executeWorkflowPackages", () => {
  it("discovers workflow packages and runs install plus ugit:ci for each one", async () => {
    const repositoryPath = createWorkspace();
    const workflowPath = path.join(repositoryPath, ".ugit", "workflows", "lint");

    mkdirSync(workflowPath, { recursive: true });
    writeFileSync(
      path.join(workflowPath, "package.json"),
      JSON.stringify({
        name: "lint",
        scripts: {
          "ugit:ci": 'node -e "process.exit(0)"',
        },
      }),
      "utf8",
    );

    const runCommand: AsyncCommandRunner = vi.fn(async () => ({
      exitCode: 0,
      stdout: "ok",
      stderr: "",
    }));

    await expect(executeWorkflowPackages(repositoryPath, runCommand)).resolves.toEqual({
      success: true,
      workflows: [
        {
          name: "lint",
          status: "passed",
          installCommand: `pnpm install --dir ${workflowPath} --ignore-workspace --no-frozen-lockfile`,
          runCommand: `pnpm --dir ${workflowPath} run ugit:ci`,
          output: "ok\nok",
        },
      ],
    });

    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      "pnpm",
      ["install", "--dir", workflowPath, "--ignore-workspace", "--no-frozen-lockfile"],
      expect.objectContaining({
        cwd: repositoryPath,
      }),
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      "pnpm",
      ["--dir", workflowPath, "run", "ugit:ci"],
      expect.objectContaining({
        cwd: repositoryPath,
      }),
    );
  });

  it("fails with an actionable message when a workflow omits the ugit:ci script", async () => {
    const repositoryPath = createWorkspace();
    const workflowPath = path.join(repositoryPath, ".ugit", "workflows", "lint");

    mkdirSync(workflowPath, { recursive: true });
    writeFileSync(
      path.join(workflowPath, "package.json"),
      JSON.stringify({
        name: "lint",
        scripts: {},
      }),
      "utf8",
    );

    await expect(executeWorkflowPackages(repositoryPath)).resolves.toEqual({
      success: false,
      failureMessage: 'Workflow lint must define a "ugit:ci" script.',
      workflows: [],
    });
  });

  it("runs only the requested workflow when a workflow name is provided", async () => {
    const repositoryPath = createWorkspace();
    const lintWorkflowPath = path.join(repositoryPath, ".ugit", "workflows", "lint");
    const testWorkflowPath = path.join(repositoryPath, ".ugit", "workflows", "test");

    mkdirSync(lintWorkflowPath, { recursive: true });
    mkdirSync(testWorkflowPath, { recursive: true });
    writeFileSync(
      path.join(lintWorkflowPath, "package.json"),
      JSON.stringify({
        name: "lint",
        scripts: {
          "ugit:ci": 'node -e "process.exit(0)"',
        },
      }),
      "utf8",
    );
    writeFileSync(
      path.join(testWorkflowPath, "package.json"),
      JSON.stringify({
        name: "test",
        scripts: {
          "ugit:ci": 'node -e "process.exit(0)"',
        },
      }),
      "utf8",
    );

    const runCommand: AsyncCommandRunner = vi.fn(async () => ({
      exitCode: 0,
      stdout: "ok",
      stderr: "",
    }));

    await expect(
      executeWorkflowPackages(repositoryPath, runCommand, {
        workflowName: "test",
      }),
    ).resolves.toEqual({
      success: true,
      workflows: [
        {
          name: "test",
          status: "passed",
          installCommand: `pnpm install --dir ${testWorkflowPath} --ignore-workspace --no-frozen-lockfile`,
          runCommand: `pnpm --dir ${testWorkflowPath} run ugit:ci`,
          output: "ok\nok",
        },
      ],
    });
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      "pnpm",
      ["install", "--dir", testWorkflowPath, "--ignore-workspace", "--no-frozen-lockfile"],
      expect.objectContaining({
        cwd: repositoryPath,
      }),
    );
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-pr-workflows-"));

  workspaces.push(workspace);

  return workspace;
}
