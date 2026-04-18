import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAsyncCommand } from "@/lib/pr-runner/process";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
import type { ValidatedWorkflowRunRequest } from "@/lib/workflow-runs/validation";

const { executeWorkflowPackages } = vi.hoisted(() => ({
  executeWorkflowPackages: vi.fn(),
}));

vi.mock("@/lib/pr-runner/workflows", () => ({
  executeWorkflowPackages,
}));

import { executeWorkflowRunJob, resetPullRequestRunnerForTests } from "@/lib/pr-runner/runner";
import {
  claimRunnableExecutions,
  queueWorkflowRun,
  readWorkflowRun,
} from "@/lib/pr-runner/storage";

const workspaces: string[] = [];

beforeEach(() => {
  executeWorkflowPackages.mockReset();
  executeWorkflowPackages.mockResolvedValue({
    success: true,
    workflows: [],
  });
});

afterEach(() => {
  resetPullRequestRunnerForTests();
  resetStorageCacheForTests();

  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("executeWorkflowRunJob", () => {
  it("fails safely when workflow1 already contains repository content", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createGitRepository(workspace, "alpha");

    commitRepositoryFile(
      repositoryPath,
      "workflow1/project-file.txt",
      "tracked\n",
      "add workflow1",
    );

    const commitHash = readGitOutput(repositoryPath, "rev-parse", "HEAD");
    const storage = path.join(workspace, "storage", "pull-requests");
    const runCommand = vi.fn(runAsyncCommand);
    const queued = queueWorkflowRun(createWorkflowRequest(repositoryPath, commitHash, "lint"), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      workflowIdFactory: createIdFactory("workflow-1"),
    });
    const execution = claimWorkflowRun(storage, "2026-04-14T00:00:10.000Z");
    const contentPath = path.join(repositoryPath, "workflow1", "project-file.txt");

    await executeWorkflowRunJob(execution, {
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      runCommand,
    });

    expect(executeWorkflowPackages).not.toHaveBeenCalled();
    expect(readFileSync(contentPath, "utf8")).toBe("tracked\n");
    expect(readWorkflowRun("workflow-1", storage)).toMatchObject({
      id: "workflow-1",
      status: "failed",
      errorMessage: expect.stringContaining("Refusing to remove"),
    });
    expect(readFileSync(queued.workflowRun.logPath, "utf8")).toContain("Refusing to remove");
    expect(listWorktreeRemovals(runCommand)).toHaveLength(0);
  });

  it("creates and reuses the managed workflow worktree without normal cleanup", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createGitRepository(workspace, "alpha");
    const commitHash = readGitOutput(repositoryPath, "rev-parse", "HEAD");
    const storage = path.join(workspace, "storage", "pull-requests");
    const runCommand = vi.fn(runAsyncCommand);

    const firstQueued = queueWorkflowRun(
      createWorkflowRequest(repositoryPath, commitHash, "lint"),
      {
        cwd: workspace,
        storage,
        now: createNowFactory("2026-04-14T00:00:00.000Z"),
        workflowIdFactory: createIdFactory("workflow-1"),
      },
    );
    const firstExecution = claimWorkflowRun(storage, "2026-04-14T00:00:10.000Z");
    const worktreePath = path.join(repositoryPath, "workflow1");

    await executeWorkflowRunJob(firstExecution, {
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      runCommand,
    });

    const secondQueued = queueWorkflowRun(
      createWorkflowRequest(repositoryPath, commitHash, "lint"),
      {
        cwd: workspace,
        storage,
        now: createNowFactory("2026-04-14T00:01:00.000Z"),
        workflowIdFactory: createIdFactory("workflow-2"),
      },
    );
    const secondExecution = claimWorkflowRun(storage, "2026-04-14T00:01:10.000Z");

    await executeWorkflowRunJob(secondExecution, {
      storage,
      now: createNowFactory("2026-04-14T00:01:20.000Z"),
      runCommand,
    });

    expect(executeWorkflowPackages).toHaveBeenCalledWith(
      worktreePath,
      runCommand,
      expect.objectContaining({
        workflowName: "lint",
        onOutput: expect.any(Function),
      }),
    );
    expect(executeWorkflowPackages).toHaveBeenNthCalledWith(
      2,
      worktreePath,
      runCommand,
      expect.objectContaining({
        workflowName: "lint",
        onOutput: expect.any(Function),
      }),
    );
    expect(existsSync(worktreePath)).toBe(true);
    expect(readWorkflowRun("workflow-1", storage)).toMatchObject({
      id: "workflow-1",
      status: "succeeded",
      errorMessage: null,
    });
    expect(readWorkflowRun("workflow-2", storage)).toMatchObject({
      id: "workflow-2",
      status: "succeeded",
      errorMessage: null,
    });
    expect(readFileSync(firstQueued.workflowRun.logPath, "utf8")).toContain(
      "Workflow run workflow-1 completed with status succeeded.",
    );
    expect(readFileSync(secondQueued.workflowRun.logPath, "utf8")).toContain(
      "Workflow run workflow-2 completed with status succeeded.",
    );
    expect(listWorktreeRemovals(runCommand)).toHaveLength(0);
  });

  it("resets tracked state to the queued commit while keeping untracked cache files", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createGitRepository(workspace, "alpha");
    const commitHash = readGitOutput(repositoryPath, "rev-parse", "HEAD");
    const storage = path.join(workspace, "storage", "pull-requests");
    const runCommand = vi.fn(runAsyncCommand);

    const firstExecution = queueAndClaimWorkflowRun({
      cwd: workspace,
      commitHash,
      repositoryPath,
      storage,
      timestamp: "2026-04-14T00:00:00.000Z",
      workflowId: "workflow-1",
    });
    const worktreePath = path.join(repositoryPath, "workflow1");

    await executeWorkflowRunJob(firstExecution, {
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      runCommand,
    });

    writeFileSync(path.join(worktreePath, "README.md"), "# drift\n", "utf8");
    writeFileSync(path.join(worktreePath, "cache.txt"), "keep-me\n", "utf8");
    execFileSync("git", ["-C", worktreePath, "switch", "-q", "-c", "scratch"], {
      stdio: "ignore",
    });

    const secondExecution = queueAndClaimWorkflowRun({
      cwd: workspace,
      commitHash,
      repositoryPath,
      storage,
      timestamp: "2026-04-14T00:01:00.000Z",
      workflowId: "workflow-2",
    });

    await executeWorkflowRunJob(secondExecution, {
      storage,
      now: createNowFactory("2026-04-14T00:01:20.000Z"),
      runCommand,
    });

    expect(readFileSync(path.join(worktreePath, "README.md"), "utf8")).toBe("# alpha\n");
    expect(readFileSync(path.join(worktreePath, "cache.txt"), "utf8")).toBe("keep-me\n");
    expect(readGitOutput(worktreePath, "rev-parse", "--abbrev-ref", "HEAD")).toBe("HEAD");
  });

  it("recovers the managed worktree when linked-worktree metadata is missing", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createGitRepository(workspace, "alpha");
    const commitHash = readGitOutput(repositoryPath, "rev-parse", "HEAD");
    const storage = path.join(workspace, "storage", "pull-requests");
    const runCommand = vi.fn(runAsyncCommand);

    const firstExecution = queueAndClaimWorkflowRun({
      cwd: workspace,
      commitHash,
      repositoryPath,
      storage,
      timestamp: "2026-04-14T00:00:00.000Z",
      workflowId: "workflow-1",
    });
    const worktreePath = path.join(repositoryPath, "workflow1");

    await executeWorkflowRunJob(firstExecution, {
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      runCommand,
    });

    const linkedGitDir = readLinkedGitDir(worktreePath);

    rmSync(linkedGitDir, { recursive: true, force: true });
    writeFileSync(path.join(worktreePath, "stale-cache.txt"), "stale\n", "utf8");

    const secondExecution = queueAndClaimWorkflowRun({
      cwd: workspace,
      commitHash,
      repositoryPath,
      storage,
      timestamp: "2026-04-14T00:01:00.000Z",
      workflowId: "workflow-2",
    });

    await executeWorkflowRunJob(secondExecution, {
      storage,
      now: createNowFactory("2026-04-14T00:01:20.000Z"),
      runCommand,
    });

    expect(existsSync(worktreePath)).toBe(true);
    expect(existsSync(path.join(worktreePath, "stale-cache.txt"))).toBe(false);
    expect(readGitOutput(worktreePath, "rev-parse", "--git-common-dir")).toBe(
      path.join(repositoryPath, ".git"),
    );
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-runner-workflow-"));

  workspaces.push(workspace);

  return workspace;
}

function createGitRepository(workspace: string, repositoryName: string): string {
  const repositoryPath = path.join(workspace, ".data", "repos", repositoryName);

  mkdirSync(path.dirname(repositoryPath), { recursive: true });
  execFileSync("git", ["-c", "init.defaultBranch=main", "init", "--quiet", repositoryPath], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "config", "user.name", "ugit-test"], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "config", "user.email", "ugit@example.com"], {
    stdio: "ignore",
  });

  writeFileSync(path.join(repositoryPath, "README.md"), "# alpha\n", "utf8");
  execFileSync("git", ["-C", repositoryPath, "add", "README.md"], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "commit", "-q", "-m", "init"], {
    stdio: "ignore",
  });

  return repositoryPath;
}

function commitRepositoryFile(
  repositoryPath: string,
  relativePath: string,
  contents: string,
  message: string,
): void {
  const filePath = path.join(repositoryPath, relativePath);

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
  execFileSync("git", ["-C", repositoryPath, "add", relativePath], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", repositoryPath, "commit", "-q", "-m", message], {
    stdio: "ignore",
  });
}

function claimWorkflowRun(storage: string, timestamp: string) {
  const [execution] = claimRunnableExecutions({
    storage,
    now: createNowFactory(timestamp),
  });

  if (!execution || execution.kind !== "workflow_run") {
    throw new Error("Expected to claim a workflow run.");
  }

  return execution;
}

function queueAndClaimWorkflowRun(options: {
  cwd: string;
  commitHash: string;
  repositoryPath: string;
  storage: string;
  timestamp: string;
  workflowId: string;
}) {
  queueWorkflowRun(createWorkflowRequest(options.repositoryPath, options.commitHash, "lint"), {
    cwd: options.cwd,
    storage: options.storage,
    now: createNowFactory(options.timestamp),
    workflowIdFactory: createIdFactory(options.workflowId),
  });

  return claimWorkflowRun(options.storage, options.timestamp);
}

function createWorkflowRequest(
  executionRepositoryPath: string,
  commitHash: string,
  workflowName: string,
  branchName: string = "feature/test",
): ValidatedWorkflowRunRequest {
  const { repositoryName, repositoryPath } = resolveOwningRepositoryTarget(executionRepositoryPath);

  return {
    repositoryName,
    repositoryPath,
    executionRepositoryPath,
    publishedBranch: {
      repositoryPath: executionRepositoryPath,
      branchName,
      commitHash,
      remoteName: "origin",
    },
    workflowName,
  };
}

function resolveOwningRepositoryTarget(repositoryPath: string): {
  repositoryName: string;
  repositoryPath: string;
} {
  const repositoriesRootSegment = `${path.sep}repos${path.sep}`;
  const repositoriesIndex = repositoryPath.lastIndexOf(repositoriesRootSegment);

  if (repositoriesIndex < 0) {
    throw new Error(`Expected ${repositoryPath} to be nested under .data/repos.`);
  }

  const repositoryRoot = repositoryPath
    .slice(repositoriesIndex + repositoriesRootSegment.length)
    .split(path.sep)
    .filter((segment) => segment.length > 0)[0];

  if (!repositoryRoot) {
    throw new Error(`Expected ${repositoryPath} to include a repository name.`);
  }

  return {
    repositoryName: repositoryRoot,
    repositoryPath: repositoryPath.slice(
      0,
      repositoriesIndex + repositoriesRootSegment.length + repositoryRoot.length,
    ),
  };
}

function createIdFactory(...ids: string[]): () => string {
  let index = 0;

  return () => {
    const id = ids[Math.min(index, ids.length - 1)];

    index += 1;

    return id;
  };
}

function createNowFactory(...timestamps: string[]): () => Date {
  let index = 0;

  return () => {
    const timestamp = timestamps[Math.min(index, timestamps.length - 1)];

    index += 1;

    return new Date(timestamp);
  };
}

function listWorktreeRemovals(runCommand: ReturnType<typeof vi.fn>): string[] {
  return runCommand.mock.calls
    .filter(([, args]) => args.includes("worktree") && args.includes("remove"))
    .map(([, args]) => String(args[args.length - 1]));
}

function readGitOutput(repositoryPath: string, ...args: string[]): string {
  return execFileSync("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function readLinkedGitDir(worktreePath: string): string {
  const gitFile = readFileSync(path.join(worktreePath, ".git"), "utf8").trim();

  if (!gitFile.startsWith("gitdir: ")) {
    throw new Error(`Expected ${worktreePath}/.git to point at a linked-worktree gitdir.`);
  }

  return gitFile.slice("gitdir: ".length);
}
