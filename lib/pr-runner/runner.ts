import "server-only";

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StorageOptions } from "@/lib/storage/sqlite";
import { attemptFastForwardMerge } from "./merge";
import { runAsyncCommand, type AsyncCommandRunner } from "./process";
import { writeCiResultArtifact, type CiResultArtifact } from "./results";
import { claimRunnableJobs, completeCiJob, requeueRunningJobs, type ClaimedCiJob } from "./storage";
import { executeWorkflowPackages } from "./workflows";

type RunnerOptions = Readonly<{
  cwd?: string;
  now?: () => Date;
  runCommand?: AsyncCommandRunner;
  storage?: StorageOptions | string;
}>;

type RunnerGlobals = {
  activeJobs: Map<string, Promise<void>>;
  drainPromise: Promise<void> | null;
  recovered: boolean;
};

declare global {
  var __ugitPullRequestRunnerGlobals: RunnerGlobals | undefined;
}

export function resetPullRequestRunnerForTests(): void {
  const globals = getRunnerGlobals();

  globals.activeJobs.clear();
  globals.drainPromise = null;
  globals.recovered = false;
}

export function nudgePullRequestRunner(options: RunnerOptions = {}): Promise<void> {
  const globals = getRunnerGlobals();

  if (globals.drainPromise) {
    return globals.drainPromise;
  }

  const drainPromise = drainRunner(options).finally(() => {
    if (globals.drainPromise === drainPromise) {
      globals.drainPromise = null;
    }
  });

  globals.drainPromise = drainPromise;

  return drainPromise;
}

export async function executeCiJob(job: ClaimedCiJob, options: RunnerOptions = {}): Promise<void> {
  const now = options.now ?? (() => new Date());
  const runCommand = options.runCommand ?? runAsyncCommand;
  let worktreePath: string | null = null;
  let resultArtifact: CiResultArtifact | null = null;

  try {
    worktreePath = await createDetachedWorktree(job, runCommand);

    const workflowSummary = await executeWorkflowPackages(worktreePath, runCommand);
    const mergeResult = workflowSummary.success
      ? await attemptFastForwardMerge({
          repositoryPath: job.repositoryPath,
          baseBranch: job.baseBranch,
          commitHash: job.commitHash,
          runCommand,
        })
      : {
          status: "skipped" as const,
          message: "Skipped auto-merge because at least one workflow failed.",
        };
    const status = !workflowSummary.success
      ? "failed"
      : mergeResult.status === "succeeded"
        ? "succeeded"
        : "merge_failed";

    resultArtifact = {
      jobId: job.id,
      pullRequestId: job.pullRequestId,
      repositoryName: job.repositoryName,
      branchName: job.branchName,
      baseBranch: job.baseBranch,
      commitHash: job.commitHash,
      status,
      queuedAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: now().toISOString(),
      errorMessage:
        workflowSummary.failureMessage ?? (status === "merge_failed" ? mergeResult.message : null),
      workflows: workflowSummary.workflows,
      merge: mergeResult,
    };

    const artifactPath = writeCiResultArtifact(resultArtifact, {
      cwd: options.cwd,
    });

    completeCiJob({
      jobId: job.id,
      status,
      resultPath: artifactPath,
      errorMessage: resultArtifact.errorMessage,
      mergeStatus: mergeResult.status,
      now,
      storage: options.storage,
    });
  } catch (error) {
    resultArtifact = {
      jobId: job.id,
      pullRequestId: job.pullRequestId,
      repositoryName: job.repositoryName,
      branchName: job.branchName,
      baseBranch: job.baseBranch,
      commitHash: job.commitHash,
      status: "failed",
      queuedAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: now().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
      workflows: [],
      merge: {
        status: "skipped",
        message:
          "Skipped auto-merge because the CI job failed before workflow execution completed.",
      },
    };

    const artifactPath = writeCiResultArtifact(resultArtifact, {
      cwd: options.cwd,
    });

    completeCiJob({
      jobId: job.id,
      status: "failed",
      resultPath: artifactPath,
      errorMessage: resultArtifact.errorMessage,
      mergeStatus: resultArtifact.merge.status,
      now,
      storage: options.storage,
    });
  } finally {
    if (worktreePath) {
      await cleanupDetachedWorktree(job.repositoryPath, worktreePath, runCommand);
    }
  }
}

async function drainRunner(options: RunnerOptions): Promise<void> {
  const globals = getRunnerGlobals();

  if (!globals.recovered) {
    requeueRunningJobs(options.storage, options.now);
    globals.recovered = true;
  }

  while (true) {
    const claimedJobs = claimRunnableJobs({
      now: options.now,
      storage: options.storage,
    });

    if (claimedJobs.length === 0) {
      return;
    }

    for (const job of claimedJobs) {
      const executionPromise = executeCiJob(job, options).finally(() => {
        globals.activeJobs.delete(job.id);
        void nudgePullRequestRunner(options);
      });

      globals.activeJobs.set(job.id, executionPromise);
    }

    if (globals.activeJobs.size === 0) {
      return;
    }

    return;
  }
}

async function createDetachedWorktree(
  job: ClaimedCiJob,
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
      addWorktreeResult.stderr ||
        addWorktreeResult.stdout ||
        "Failed to create an isolated CI worktree.",
    );
  }

  return worktreePath;
}

async function cleanupDetachedWorktree(
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

function getRunnerGlobals(): RunnerGlobals {
  globalThis.__ugitPullRequestRunnerGlobals ??= {
    activeJobs: new Map(),
    drainPromise: null,
    recovered: false,
  };

  return globalThis.__ugitPullRequestRunnerGlobals;
}
