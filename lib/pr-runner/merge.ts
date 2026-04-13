import "server-only";

import { combineCommandOutput, runAsyncCommand, type AsyncCommandRunner } from "./process";

export type FastForwardMergeResult = Readonly<{
  message: string;
  status: "succeeded" | "failed" | "skipped";
}>;

export type AttemptFastForwardMergeOptions = Readonly<{
  baseBranch: string;
  canMutate?: () => boolean | Promise<boolean>;
  commitHash: string;
  repositoryPath: string;
  runCommand?: AsyncCommandRunner;
}>;

const SUPERSEDED_MERGE_MESSAGE =
  "Skipped auto-merge because the CI job was superseded by a newer pull-request synchronization request.";

export async function attemptFastForwardMerge(
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
      message: `Base branch ${options.baseBranch} is not an ancestor of ${options.commitHash}; fast-forward merge is not possible.`,
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
  const currentBranch = currentBranchResult.exitCode === 0 ? currentBranchResult.stdout : null;

  if (!(await canMutateRef(options))) {
    return {
      status: "skipped",
      message: SUPERSEDED_MERGE_MESSAGE,
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
      currentBase.stdout,
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

async function canMutateRef(options: AttemptFastForwardMergeOptions): Promise<boolean> {
  if (!options.canMutate) {
    return true;
  }

  return await options.canMutate();
}
