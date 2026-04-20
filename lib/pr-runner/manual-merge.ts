import "server-only";

import type { StorageOptions } from "@/lib/storage/sqlite";
import {
  buildPullRequestGitHubDelegation,
  readCanonicalGitHubPullRequest,
  resolveGitHubRepositoryContext,
  squashMergeGitHubPullRequest,
  GitHubPullRequestMergeError,
  type CanonicalGitHubPullRequest,
  type GitCommandRunner,
  type GitHubFetch,
  type GitHubRepositoryContext,
} from "@/lib/pull-requests/github";
import type {
  PullRequestGitHubDelegation,
  PullRequestMergeReadiness,
  PullRequestMergeReadinessCheck,
} from "@/packages/ugit-cli/src/pull-request-contract";
import {
  advanceMirroredBaseBranchToCommit,
  fetchRemoteBranchCommit,
  validateFastForwardPreflight,
} from "./merge";
import { runAsyncCommand, type AsyncCommandRunner } from "./process";
import { completePullRequestMerge, type CiJobRecord, type PullRequestRecord } from "./storage";

type ManualMergeSharedOptions = Readonly<{
  fetchImpl?: GitHubFetch;
  githubToken?: string | null;
  now?: () => Date;
  runCommand?: AsyncCommandRunner;
  runGit?: GitCommandRunner;
  storage?: StorageOptions | string;
}>;

export type PullRequestMergeEvaluation = Readonly<{
  github: PullRequestGitHubDelegation;
  readiness: PullRequestMergeReadiness;
  githubRepository: GitHubRepositoryContext | null;
  canonicalPullRequest: CanonicalGitHubPullRequest | null;
}>;

export type ExecuteApprovedPullRequestMergeResult = Readonly<{
  outcome: "merged" | "not_ready" | "rebase_required";
  message: string;
}>;

export async function evaluatePullRequestMergeReadiness(
  options: Readonly<{
    pullRequest: PullRequestRecord;
    latestJob: CiJobRecord | null;
  }> &
    ManualMergeSharedOptions,
): Promise<PullRequestMergeEvaluation> {
  const checkedAt = (options.now ?? (() => new Date()))().toISOString();
  const fallbackGitHub = buildPullRequestGitHubDelegation({
    repositoryPath: options.pullRequest.repositoryPath,
    branchName: options.pullRequest.branchName,
    baseBranch: options.pullRequest.baseBranch,
    preferredRemoteName: options.pullRequest.remoteName,
    runGit: options.runGit,
  });

  if (options.pullRequest.status === "merged") {
    return {
      github: fallbackGitHub,
      readiness: {
        state: "blocked",
        canMerge: false,
        summary: "This pull request has already been merged.",
        blockingReasons: ["This pull request has already been merged."],
        checks: [],
        checkedAt,
      },
      githubRepository: null,
      canonicalPullRequest: null,
    };
  }

  const githubRepository = resolveGitHubRepositoryContext(
    options.pullRequest.repositoryPath,
    options.pullRequest.remoteName,
    options.runGit,
  );
  const canonicalPullRequestResult = await readCanonicalGitHubPullRequest({
    repositoryPath: options.pullRequest.repositoryPath,
    branchName: options.pullRequest.branchName,
    baseBranch: options.pullRequest.baseBranch,
    preferredRemoteName: options.pullRequest.remoteName,
    repository: githubRepository,
    runGit: options.runGit,
    fetchImpl: options.fetchImpl,
    token: options.githubToken,
  });
  const baseParityCheck = await buildBaseParityCheck({
    pullRequest: options.pullRequest,
    githubRepository,
    runCommand: options.runCommand,
  });
  const canonicalPullRequest =
    canonicalPullRequestResult.status === "available"
      ? canonicalPullRequestResult.pullRequest
      : null;
  const ciCheck = buildCurrentCiCheck(options.pullRequest, options.latestJob, canonicalPullRequest);
  const githubMergeabilityCheck = buildGitHubMergeabilityCheck(canonicalPullRequestResult);

  const checks = [ciCheck, baseParityCheck, githubMergeabilityCheck];
  const blockingReasons = checks
    .filter((check) => check.state === "blocked")
    .map((check) => check.message);
  const hasPendingChecks = checks.some((check) => check.state === "pending");
  const state = blockingReasons.length > 0 ? "blocked" : hasPendingChecks ? "pending" : "ready";
  const github =
    canonicalPullRequest && githubRepository
      ? buildPullRequestGitHubDelegation({
          repositoryPath: options.pullRequest.repositoryPath,
          branchName: options.pullRequest.branchName,
          baseBranch: options.pullRequest.baseBranch,
          preferredRemoteName: githubRepository.remoteName,
          pullRequestUrl: canonicalPullRequest.url,
          runGit: options.runGit,
        })
      : fallbackGitHub;

  return {
    github,
    readiness: {
      state,
      canMerge: state === "ready",
      summary: buildMergeReadinessSummary(state, blockingReasons),
      blockingReasons,
      checks,
      checkedAt,
    },
    githubRepository,
    canonicalPullRequest,
  };
}

export async function executeApprovedPullRequestMerge(
  options: Readonly<{
    pullRequest: PullRequestRecord;
    latestJob: CiJobRecord | null;
    githubRepository: GitHubRepositoryContext;
    canonicalPullRequest: CanonicalGitHubPullRequest;
  }> &
    ManualMergeSharedOptions,
): Promise<ExecuteApprovedPullRequestMergeResult> {
  const currentCiBlockingReason = resolveCurrentCiBlockingReason(
    options.pullRequest,
    options.latestJob,
    options.canonicalPullRequest,
  );

  if (currentCiBlockingReason) {
    return {
      outcome: "not_ready",
      message: currentCiBlockingReason,
    };
  }

  const preflight = await validateFastForwardPreflight({
    repositoryPath: options.pullRequest.repositoryPath,
    baseBranch: options.pullRequest.baseBranch,
    commitHash: options.pullRequest.headCommitHash,
    runCommand: options.runCommand,
  });

  if (preflight.status === "rebase_required") {
    return {
      outcome: "rebase_required",
      message: preflight.message,
    };
  }

  if (preflight.status === "failed") {
    return {
      outcome: "not_ready",
      message: preflight.message,
    };
  }

  try {
    await squashMergeGitHubPullRequest({
      repository: options.githubRepository,
      pullRequestNumber: options.canonicalPullRequest.number,
      fetchImpl: options.fetchImpl,
      token: options.githubToken,
    });
  } catch (error) {
    if (
      error instanceof GitHubPullRequestMergeError &&
      [405, 409, 422, 503].includes(error.statusCode)
    ) {
      return {
        outcome: "not_ready",
        message: error.message,
      };
    }

    throw error;
  }

  const fetchedBaseCommit = await fetchRemoteBranchCommit({
    repositoryPath: options.pullRequest.repositoryPath,
    remoteName: options.githubRepository.remoteName,
    branchName: options.pullRequest.baseBranch,
    runCommand: options.runCommand,
  });

  if (fetchedBaseCommit.status !== "succeeded") {
    throw new Error(fetchedBaseCommit.message);
  }

  const mirrorUpdate = await advanceMirroredBaseBranchToCommit({
    repositoryPath: options.pullRequest.repositoryPath,
    baseBranch: options.pullRequest.baseBranch,
    commitHash: fetchedBaseCommit.commitHash,
    runCommand: options.runCommand,
  });

  if (mirrorUpdate.status !== "succeeded") {
    throw new Error(mirrorUpdate.message);
  }

  completePullRequestMerge({
    pullRequestId: options.pullRequest.id,
    jobId: options.latestJob?.id ?? null,
    now: options.now,
    storage: options.storage,
  });

  return {
    outcome: "merged",
    message: `GitHub squash-merged the pull request and realigned ${options.pullRequest.baseBranch} to ${fetchedBaseCommit.commitHash}.`,
  };
}

function buildCurrentCiCheck(
  pullRequest: PullRequestRecord,
  latestJob: CiJobRecord | null,
  canonicalPullRequest: CanonicalGitHubPullRequest | null,
): PullRequestMergeReadinessCheck {
  const blockingReason = resolveCurrentCiBlockingReason(
    pullRequest,
    latestJob,
    canonicalPullRequest,
  );

  if (blockingReason) {
    return {
      id: "current_ci",
      label: "Current CI",
      state: "blocked",
      message: blockingReason,
    };
  }

  if (!latestJob) {
    throw new Error("A ready current CI check requires the latest CI job.");
  }

  return {
    id: "current_ci",
    label: "Current CI",
    state: "ready",
    message: `The latest CI job ${latestJob.id} succeeded for ${pullRequest.headCommitHash}.`,
  };
}

async function buildBaseParityCheck(
  options: Readonly<{
    pullRequest: PullRequestRecord;
    githubRepository: GitHubRepositoryContext | null;
    runCommand?: AsyncCommandRunner;
  }>,
): Promise<PullRequestMergeReadinessCheck> {
  if (!options.githubRepository) {
    return {
      id: "base_parity",
      label: "Mirror parity",
      state: "blocked",
      message: "GitHub remote metadata is unavailable for this repository.",
    };
  }

  const fetchedBaseCommit = await fetchRemoteBranchCommit({
    repositoryPath: options.pullRequest.repositoryPath,
    remoteName: options.githubRepository.remoteName,
    branchName: options.pullRequest.baseBranch,
    runCommand: options.runCommand,
  });

  if (fetchedBaseCommit.status !== "succeeded") {
    return {
      id: "base_parity",
      label: "Mirror parity",
      state: "blocked",
      message: fetchedBaseCommit.message,
    };
  }

  const localBaseCommit = await readLocalBranchCommit(
    options.pullRequest.repositoryPath,
    options.pullRequest.baseBranch,
    options.runCommand,
  );

  if (!localBaseCommit) {
    return {
      id: "base_parity",
      label: "Mirror parity",
      state: "blocked",
      message: `Base branch ${options.pullRequest.baseBranch} does not exist on the ugit server.`,
    };
  }

  if (localBaseCommit !== fetchedBaseCommit.commitHash) {
    return {
      id: "base_parity",
      label: "Mirror parity",
      state: "blocked",
      message: `Local ${options.pullRequest.baseBranch} is at ${localBaseCommit}, but GitHub ${options.pullRequest.baseBranch} is at ${fetchedBaseCommit.commitHash}.`,
    };
  }

  return {
    id: "base_parity",
    label: "Mirror parity",
    state: "ready",
    message: `Local ${options.pullRequest.baseBranch} matches GitHub at ${localBaseCommit}.`,
  };
}

function buildGitHubMergeabilityCheck(
  result: Awaited<ReturnType<typeof readCanonicalGitHubPullRequest>>,
): PullRequestMergeReadinessCheck {
  if (result.status !== "available") {
    return {
      id: "github_mergeability",
      label: "GitHub mergeability",
      state: "blocked",
      message: result.message,
    };
  }

  if (result.pullRequest.mergeable === true) {
    return {
      id: "github_mergeability",
      label: "GitHub mergeability",
      state: "ready",
      message: `GitHub reports pull request #${result.pullRequest.number} is mergeable.`,
    };
  }

  if (result.pullRequest.mergeable === null) {
    return {
      id: "github_mergeability",
      label: "GitHub mergeability",
      state: "pending",
      message: `GitHub is still calculating mergeability for pull request #${result.pullRequest.number}. Refresh again shortly.`,
    };
  }

  return {
    id: "github_mergeability",
    label: "GitHub mergeability",
    state: "blocked",
    message: `GitHub reports pull request #${result.pullRequest.number} cannot be merged cleanly.`,
  };
}

function buildMergeReadinessSummary(
  state: PullRequestMergeReadiness["state"],
  blockingReasons: readonly string[],
): string {
  if (state === "ready") {
    return "All manual-merge checks passed. This pull request is ready for approval.";
  }

  if (state === "pending") {
    return "At least one merge check is still pending. Refresh again in a few seconds.";
  }

  return blockingReasons[0] ?? "Resolve the blocked checks before merging.";
}

function resolveCurrentCiBlockingReason(
  pullRequest: PullRequestRecord,
  latestJob: CiJobRecord | null,
  canonicalPullRequest: CanonicalGitHubPullRequest | null,
): string | null {
  if (!latestJob) {
    return "No CI job is available for the current head commit.";
  }

  if (latestJob.commitHash !== pullRequest.headCommitHash) {
    return "The latest CI result no longer matches the current head commit. Refresh and rerun CI.";
  }

  if (latestJob.status !== "succeeded") {
    return `The latest CI job ${latestJob.id} finished with status ${latestJob.status}. Wait for a passing run before merging.`;
  }

  if (canonicalPullRequest && canonicalPullRequest.headCommitHash !== pullRequest.headCommitHash) {
    return `GitHub pull request #${canonicalPullRequest.number} now points at ${canonicalPullRequest.headCommitHash}, but the latest passing CI job ${latestJob.id} only covers ${latestJob.commitHash}. Refresh and rerun CI before merging.`;
  }

  return null;
}

async function readLocalBranchCommit(
  repositoryPath: string,
  branchName: string,
  runCommand: AsyncCommandRunner = runAsyncCommand,
): Promise<string | null> {
  const response = await runCommand("git", [
    "-C",
    repositoryPath,
    "rev-parse",
    "--verify",
    `refs/heads/${branchName}`,
  ]);

  if (response.exitCode !== 0) {
    return null;
  }

  return response.stdout.trim();
}
