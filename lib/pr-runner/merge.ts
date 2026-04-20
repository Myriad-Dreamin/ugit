import "server-only";

import { combineCommandOutput, runAsyncCommand, type AsyncCommandRunner } from "./process";
import { evictManagedWorkflowWorktreeForCommit } from "./worktrees";

export type FastForwardMergeResult = Readonly<{
  message: string;
  status: "succeeded" | "failed" | "skipped";
}>;

export type FastForwardPreflightResult =
  | Readonly<{
      status: "ready";
      baseCommitHash: string;
      message: string;
    }>
  | Readonly<{
      status: "failed" | "rebase_required";
      baseCommitHash: string | null;
      message: string;
    }>;

export type FetchRemoteBranchCommitResult =
  | Readonly<{
      status: "succeeded";
      commitHash: string;
      message: string;
    }>
  | Readonly<{
      status: "failed";
      commitHash: null;
      message: string;
    }>;

export type AttemptFastForwardMergeOptions = Readonly<{
  baseBranch: string;
  canMutate?: () => boolean | Promise<boolean>;
  commitHash: string;
  repositoryPath: string;
  runCommand?: AsyncCommandRunner;
}>;

export type FetchRemoteBranchCommitOptions = Readonly<{
  branchName: string;
  remoteName: string;
  repositoryPath: string;
  runCommand?: AsyncCommandRunner;
}>;

const SUPERSEDED_MERGE_MESSAGE =
  "Skipped auto-merge because the CI job was superseded by a newer pull-request synchronization request.";

export async function validateFastForwardPreflight(
  options: Readonly<{
    baseBranch: string;
    commitHash: string;
    repositoryPath: string;
    runCommand?: AsyncCommandRunner;
  }>,
): Promise<FastForwardPreflightResult> {
  const runCommand = options.runCommand ?? runAsyncCommand;
  const baseRef = `refs/heads/${options.baseBranch}`;
  const currentBase = await runCommand("git", [
    "-C",
    options.repositoryPath,
    "rev-parse",
    "--verify",
    baseRef,
  ]);

  if (currentBase.exitCode !== 0) {
    return {
      status: "failed",
      baseCommitHash: null,
      message: `Base branch ${options.baseBranch} does not exist on the ugit server.`,
    };
  }

  const baseCommitHash = currentBase.stdout.trim();
  const ancestryCheck = await runCommand("git", [
    "-C",
    options.repositoryPath,
    "merge-base",
    "--is-ancestor",
    baseRef,
    options.commitHash,
  ]);

  if (ancestryCheck.exitCode !== 0) {
    return {
      status: "rebase_required",
      baseCommitHash,
      message: `Base branch ${options.baseBranch} is not an ancestor of ${options.commitHash}; rebase the pull request and rerun CI before merging.`,
    };
  }

  return {
    status: "ready",
    baseCommitHash,
    message: `Base branch ${options.baseBranch} can fast-forward to ${options.commitHash}.`,
  };
}

export async function fetchRemoteBranchCommit(
  options: FetchRemoteBranchCommitOptions,
): Promise<FetchRemoteBranchCommitResult> {
  const runCommand = options.runCommand ?? runAsyncCommand;
  const remoteTrackingRef = `refs/remotes/${options.remoteName}/${options.branchName}`;
  const fetchResult = await runCommand("git", [
    "-C",
    options.repositoryPath,
    "fetch",
    "--quiet",
    options.remoteName,
    `${options.branchName}:${remoteTrackingRef}`,
  ]);

  if (fetchResult.exitCode !== 0) {
    return {
      status: "failed",
      commitHash: null,
      message:
        combineCommandOutput(fetchResult) ||
        `Failed to fetch ${options.remoteName}/${options.branchName} from GitHub.`,
    };
  }

  const headResult = await runCommand("git", [
    "-C",
    options.repositoryPath,
    "rev-parse",
    "--verify",
    remoteTrackingRef,
  ]);

  if (headResult.exitCode !== 0) {
    return {
      status: "failed",
      commitHash: null,
      message: `GitHub fetch for ${options.remoteName}/${options.branchName} did not produce a commit.`,
    };
  }

  return {
    status: "succeeded",
    commitHash: headResult.stdout.trim(),
    message: `Fetched ${options.remoteName}/${options.branchName}.`,
  };
}

export async function advanceMirroredBaseBranchToCommit(
  options: AttemptFastForwardMergeOptions,
): Promise<FastForwardMergeResult> {
  const runCommand = options.runCommand ?? runAsyncCommand;
  const baseRef = `refs/heads/${options.baseBranch}`;
  const currentBase = await runCommand("git", [
    "-C",
    options.repositoryPath,
    "rev-parse",
    "--verify",
    baseRef,
  ]);

  if (currentBase.exitCode !== 0) {
    return {
      status: "failed",
      message: `Base branch ${options.baseBranch} does not exist on the ugit server.`,
    };
  }

  const ancestryCheck = await runCommand("git", [
    "-C",
    options.repositoryPath,
    "merge-base",
    "--is-ancestor",
    baseRef,
    options.commitHash,
  ]);

  if (ancestryCheck.exitCode !== 0) {
    return {
      status: "failed",
      message: `Base branch ${options.baseBranch} cannot fast-forward to ${options.commitHash}.`,
    };
  }

  const currentBranchResult = await runCommand("git", [
    "-C",
    options.repositoryPath,
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  ]);
  const currentBranch =
    currentBranchResult.exitCode === 0 ? currentBranchResult.stdout.trim() : null;

  if (!(await canMutateRef(options))) {
    return {
      status: "skipped",
      message: SUPERSEDED_MERGE_MESSAGE,
    };
  }

  try {
    await evictManagedWorkflowWorktreeForCommit(
      options.repositoryPath,
      options.commitHash,
      runCommand,
    );
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (currentBranch === options.baseBranch) {
    const mergeResult = await runCommand("git", [
      "-C",
      options.repositoryPath,
      "merge",
      "--ff-only",
      "--quiet",
      options.commitHash,
    ]);

    if (mergeResult.exitCode !== 0) {
      return {
        status: "failed",
        message:
          combineCommandOutput(mergeResult) ||
          `Failed to fast-forward ${options.baseBranch} to ${options.commitHash}.`,
      };
    }
  } else {
    const updateResult = await runCommand("git", [
      "-C",
      options.repositoryPath,
      "update-ref",
      baseRef,
      options.commitHash,
      currentBase.stdout.trim(),
    ]);

    if (updateResult.exitCode !== 0) {
      return {
        status: "failed",
        message:
          combineCommandOutput(updateResult) ||
          `Failed to update ${options.baseBranch} to ${options.commitHash}.`,
      };
    }
  }

  return {
    status: "succeeded",
    message: `Fast-forwarded ${options.baseBranch} to ${options.commitHash}.`,
  };
}

export async function attemptFastForwardMerge(
  options: AttemptFastForwardMergeOptions,
): Promise<FastForwardMergeResult> {
  const preflight = await validateFastForwardPreflight(options);

  if (preflight.status !== "ready") {
    return {
      status: "failed",
      message: preflight.message,
    };
  }

  return await advanceMirroredBaseBranchToCommit(options);
}

async function canMutateRef(options: AttemptFastForwardMergeOptions): Promise<boolean> {
  if (!options.canMutate) {
    return true;
  }

  return await options.canMutate();
}
