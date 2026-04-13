import "server-only";

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StorageOptions } from "@/lib/storage/sqlite";
import { appendWorkflowRunLog } from "@/lib/workflow-runs/log-storage";
import { attemptFastForwardMerge } from "./merge";
import { runAsyncCommand, type AsyncCommandRunner } from "./process";
import { writeCiResultArtifact, type CiResultArtifact } from "./results";
import {
  SUPERSEDED_CI_JOB_MESSAGE,
  claimRunnableExecutions,
  completeCiJob,
  completeWorkflowRun,
  isLatestCiJob,
  requeueRunningJobs,
  type ClaimedExecution,
  type ClaimedCiJob,
  type ClaimedWorkflowRun,
} from "./storage";
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

    if (markJobSupersededIfStale(job, options, SUPERSEDED_CI_JOB_MESSAGE)) {
      return;
    }

    const mergeResult = workflowSummary.success
      ? await attemptFastForwardMerge({
          repositoryPath: job.repositoryPath,
          baseBranch: job.baseBranch,
          commitHash: job.commitHash,
          canMutate: () => isLatestCiJob(job.id, options.storage),
          runCommand,
        })
      : {
          status: "skipped" as const,
          message: "Skipped auto-merge because at least one workflow failed.",
        };

    if (markJobSupersededIfStale(job, options, SUPERSEDED_CI_JOB_MESSAGE)) {
      return;
    }

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

    if (markJobSupersededIfStale(job, options, resultArtifact.errorMessage)) {
      return;
    }

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

    if (
      markJobSupersededIfStale(job, options, error instanceof Error ? error.message : String(error))
    ) {
      return;
    }

    if (markJobSupersededIfStale(job, options, resultArtifact.errorMessage)) {
      return;
    }

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

export async function executeWorkflowRunJob(
  workflowRun: ClaimedWorkflowRun,
  options: RunnerOptions = {},
): Promise<void> {
  const now = options.now ?? (() => new Date());
  const runCommand = options.runCommand ?? runAsyncCommand;
  let worktreePath: string | null = null;

  try {
    appendWorkflowRunLog(
      workflowRun.logPath,
      `Starting workflow ${workflowRun.workflowName} on ${workflowRun.branchName}@${workflowRun.commitHash}.\n`,
    );

    worktreePath = await createDetachedWorktree(workflowRun, runCommand);

    const workflowSummary = await executeWorkflowPackages(worktreePath, runCommand, {
      workflowName: workflowRun.workflowName,
      onOutput: (chunk) => appendWorkflowRunLog(workflowRun.logPath, chunk),
    });
    const status = workflowSummary.success ? "succeeded" : "failed";
    const errorMessage = workflowSummary.failureMessage ?? null;

    appendWorkflowRunLog(
      workflowRun.logPath,
      `Workflow run ${workflowRun.id} completed with status ${status}.\n`,
    );

    completeWorkflowRun({
      workflowId: workflowRun.id,
      status,
      errorMessage,
      now,
      storage: options.storage,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    appendWorkflowRunLog(
      workflowRun.logPath,
      `${errorMessage}\nWorkflow run ${workflowRun.id} completed with status failed.\n`,
    );

    completeWorkflowRun({
      workflowId: workflowRun.id,
      status: "failed",
      errorMessage,
      now,
      storage: options.storage,
    });
  } finally {
    if (worktreePath) {
      await cleanupDetachedWorktree(workflowRun.repositoryPath, worktreePath, runCommand);
    }
  }
}

function markJobSupersededIfStale(
  job: Pick<ClaimedCiJob, "id">,
  options: Pick<RunnerOptions, "now" | "storage">,
  errorMessage: string | null,
): boolean {
  if (isLatestCiJob(job.id, options.storage)) {
    return false;
  }

  completeCiJob({
    jobId: job.id,
    status: "superseded",
    resultPath: null,
    errorMessage,
    mergeStatus: "skipped",
    now: options.now,
    storage: options.storage,
  });

  return true;
}

async function drainRunner(options: RunnerOptions): Promise<void> {
  const globals = getRunnerGlobals();

  if (!globals.recovered) {
    requeueRunningJobs(options.storage, options.now);
    globals.recovered = true;
  }

  while (true) {
    const claimedExecutions = claimRunnableExecutions({
      now: options.now,
      storage: options.storage,
    });

    if (claimedExecutions.length === 0) {
      return;
    }

    for (const execution of claimedExecutions) {
      const executionPromise = executeClaimedJob(execution, options).finally(() => {
        globals.activeJobs.delete(execution.id);
        void nudgePullRequestRunner(options);
      });

      globals.activeJobs.set(execution.id, executionPromise);
    }

    if (globals.activeJobs.size === 0) {
      return;
    }

    return;
  }
}

async function createDetachedWorktree(
  job: Pick<ClaimedCiJob, "commitHash" | "repositoryName" | "repositoryPath">,
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

async function executeClaimedJob(
  execution: ClaimedExecution,
  options: RunnerOptions,
): Promise<void> {
  if (execution.kind === "workflow_run") {
    return await executeWorkflowRunJob(execution, options);
  }

  return await executeCiJob(execution, options);
}

function getRunnerGlobals(): RunnerGlobals {
  globalThis.__ugitPullRequestRunnerGlobals ??= {
    activeJobs: new Map(),
    drainPromise: null,
    recovered: false,
  };

  return globalThis.__ugitPullRequestRunnerGlobals;
}
