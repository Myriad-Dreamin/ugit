import "server-only";

import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { combineCommandOutput, type AsyncCommandRunner } from "./process";

export type WorktreeJob = Readonly<{
  commitHash: string;
  repositoryName: string;
  repositoryPath: string;
}>;

const MANAGED_WORKFLOW_WORKTREE_NAME = "workflow1";

type PreparationResult =
  | Readonly<{ ok: true; worktreePath: string }>
  | Readonly<{ ok: false; errorMessage: string }>;

export function getManagedWorkflowWorktreePath(repositoryPath: string): string {
  return path.join(repositoryPath, MANAGED_WORKFLOW_WORKTREE_NAME);
}

export async function createEphemeralCiWorktree(
  job: WorktreeJob,
  runCommand: AsyncCommandRunner,
): Promise<string> {
  const worktreePath = await mkdtemp(path.join(os.tmpdir(), `ugit-ci-${job.repositoryName}-`));
  const addWorktreeResult = await runCommand("git", [
    "-C",
    job.repositoryPath,
    "worktree",
    "add",
    "--detach",
    worktreePath,
    job.commitHash,
  ]);

  if (addWorktreeResult.exitCode !== 0) {
    await rm(worktreePath, {
      force: true,
      recursive: true,
    });
    throw new Error(
      combineCommandOutput(addWorktreeResult) || "Failed to create an isolated CI worktree.",
    );
  }

  return worktreePath;
}

export async function cleanupEphemeralCiWorktree(
  repositoryPath: string,
  worktreePath: string,
  runCommand: AsyncCommandRunner,
): Promise<void> {
  await runCommand("git", ["-C", repositoryPath, "worktree", "remove", "--force", worktreePath]);
  await rm(worktreePath, {
    force: true,
    recursive: true,
  });
}

export async function prepareManagedWorkflowWorktree(
  job: WorktreeJob,
  runCommand: AsyncCommandRunner,
): Promise<string> {
  const worktreePath = getManagedWorkflowWorktreePath(job.repositoryPath);

  const initialResult = await tryPrepareManagedWorkflowWorktree(job, worktreePath, runCommand);

  if (initialResult.ok) {
    return initialResult.worktreePath;
  }

  await recoverManagedWorkflowWorktree(job.repositoryPath, worktreePath, runCommand);

  const recoveryResult = await tryPrepareManagedWorkflowWorktree(job, worktreePath, runCommand);

  if (recoveryResult.ok) {
    return recoveryResult.worktreePath;
  }

  throw new Error(recoveryResult.errorMessage);
}

async function tryPrepareManagedWorkflowWorktree(
  job: WorktreeJob,
  worktreePath: string,
  runCommand: AsyncCommandRunner,
): Promise<PreparationResult> {
  if (existsSync(worktreePath)) {
    if (
      !(await managedWorkflowWorktreeMatchesRepository(
        job.repositoryPath,
        worktreePath,
        runCommand,
      ))
    ) {
      return {
        ok: false,
        errorMessage: `Managed workflow worktree ${worktreePath} does not belong to ${job.repositoryPath}.`,
      };
    }

    return await resetManagedWorkflowWorktree(worktreePath, job.commitHash, runCommand);
  }

  return await createManagedWorkflowWorktree(job, worktreePath, runCommand);
}

async function createManagedWorkflowWorktree(
  job: WorktreeJob,
  worktreePath: string,
  runCommand: AsyncCommandRunner,
): Promise<PreparationResult> {
  const addWorktreeResult = await runCommand("git", [
    "-C",
    job.repositoryPath,
    "worktree",
    "add",
    "--detach",
    worktreePath,
    job.commitHash,
  ]);

  if (addWorktreeResult.exitCode !== 0) {
    return {
      ok: false,
      errorMessage:
        combineCommandOutput(addWorktreeResult) ||
        `Failed to create managed workflow worktree ${worktreePath}.`,
    };
  }

  return {
    ok: true,
    worktreePath,
  };
}

async function resetManagedWorkflowWorktree(
  worktreePath: string,
  commitHash: string,
  runCommand: AsyncCommandRunner,
): Promise<PreparationResult> {
  const checkoutResult = await runCommand("git", [
    "-C",
    worktreePath,
    "checkout",
    "--detach",
    "--force",
    commitHash,
  ]);

  if (checkoutResult.exitCode !== 0) {
    return {
      ok: false,
      errorMessage:
        combineCommandOutput(checkoutResult) ||
        `Failed to detach managed workflow worktree ${worktreePath} at ${commitHash}.`,
    };
  }

  const resetResult = await runCommand("git", ["-C", worktreePath, "reset", "--hard", commitHash]);

  if (resetResult.exitCode !== 0) {
    return {
      ok: false,
      errorMessage:
        combineCommandOutput(resetResult) ||
        `Failed to reset managed workflow worktree ${worktreePath} to ${commitHash}.`,
    };
  }

  return {
    ok: true,
    worktreePath,
  };
}

async function managedWorkflowWorktreeMatchesRepository(
  repositoryPath: string,
  worktreePath: string,
  runCommand: AsyncCommandRunner,
): Promise<boolean> {
  const topLevelResult = await runCommand("git", [
    "-C",
    worktreePath,
    "rev-parse",
    "--show-toplevel",
  ]);

  if (topLevelResult.exitCode !== 0) {
    return false;
  }

  const commonDirResult = await runCommand("git", [
    "-C",
    worktreePath,
    "rev-parse",
    "--git-common-dir",
  ]);

  if (commonDirResult.exitCode !== 0) {
    return false;
  }

  const resolvedTopLevel = resolveGitPath(worktreePath, topLevelResult.stdout);
  const resolvedCommonDir = resolveGitPath(worktreePath, commonDirResult.stdout);

  return (
    resolvedTopLevel === path.resolve(worktreePath) &&
    resolvedCommonDir === path.resolve(repositoryPath, ".git")
  );
}

async function recoverManagedWorkflowWorktree(
  repositoryPath: string,
  worktreePath: string,
  runCommand: AsyncCommandRunner,
): Promise<void> {
  await runCommand("git", ["-C", repositoryPath, "worktree", "remove", "--force", worktreePath]);
  await rm(worktreePath, {
    force: true,
    recursive: true,
  });

  const pruneResult = await runCommand("git", ["-C", repositoryPath, "worktree", "prune"]);

  if (pruneResult.exitCode !== 0) {
    throw new Error(
      combineCommandOutput(pruneResult) ||
        `Failed to prune broken worktree metadata for ${worktreePath}.`,
    );
  }
}

function resolveGitPath(basePath: string, value: string): string {
  return path.resolve(basePath, value.trim());
}
