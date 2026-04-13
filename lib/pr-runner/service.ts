import "server-only";

import type { StorageOptions } from "@/lib/storage/sqlite";
import type {
  EditPullRequestResponse,
  ListPullRequestsResponse,
  PullRequestLatestJobSummary,
  PullRequestSummary,
  SynchronizePullRequestResponse,
} from "@/packages/ugit-cli/src/pull-request-contract";
import { nudgePullRequestRunner } from "./runner";
import {
  listPullRequests as listStoredPullRequests,
  queuePullRequestSynchronization,
  updatePullRequest as updateStoredPullRequest,
  type PullRequestSummaryRecord,
} from "./storage";
import {
  PullRequestRequestError,
  validatePullRequestEditRequest,
  validatePullRequestListRequest,
  validatePullRequestSyncRequest,
} from "./validation";

export type PullRequestServiceOptions = Readonly<{
  cwd?: string;
  storage?: StorageOptions | string;
  now?: () => Date;
  jobIdFactory?: () => string;
  nudgeRunner?: typeof nudgePullRequestRunner;
}>;

export function synchronizePullRequest(
  payload: unknown,
  options: PullRequestServiceOptions = {},
): SynchronizePullRequestResponse {
  const request = validatePullRequestSyncRequest(payload, {
    cwd: options.cwd,
  });
  const queued = queuePullRequestSynchronization(request, {
    storage: options.storage,
    now: options.now,
    jobIdFactory: options.jobIdFactory,
  });

  void (options.nudgeRunner ?? nudgePullRequestRunner)({
    cwd: options.cwd,
    storage: options.storage,
  });

  return {
    pullRequestId: queued.pullRequest.id,
    jobId: queued.job.id,
    status: queued.job.status as SynchronizePullRequestResponse["status"],
    queuePosition: queued.queuePosition,
    repositoryName: queued.pullRequest.repositoryName,
    branchName: queued.pullRequest.branchName,
    baseBranch: queued.pullRequest.baseBranch,
    latestCommitHash: queued.pullRequest.headCommitHash,
  };
}

export function listPullRequests(
  payload: unknown,
  options: PullRequestServiceOptions = {},
): ListPullRequestsResponse {
  const request = validatePullRequestListRequest(payload, {
    cwd: options.cwd,
  });
  const pullRequests = listStoredPullRequests(request.repositoryPath, {
    storage: options.storage,
    state: request.state,
    baseBranch: request.baseBranch,
    headBranch: request.headBranch,
  }).map(toPullRequestSummary);

  return {
    repositoryName: request.repositoryName,
    pullRequests,
  };
}

export function editPullRequest(
  payload: unknown,
  options: PullRequestServiceOptions = {},
): EditPullRequestResponse {
  const request = validatePullRequestEditRequest(payload, {
    cwd: options.cwd,
  });
  const updated = updateStoredPullRequest(request, {
    storage: options.storage,
    now: options.now,
    jobIdFactory: options.jobIdFactory,
  });

  if (!updated) {
    throw new PullRequestRequestError(
      `No ugit pull request exists for ${request.repositoryName}:${request.branchName}.`,
      404,
    );
  }

  if (updated.rerunJob) {
    void (options.nudgeRunner ?? nudgePullRequestRunner)({
      cwd: options.cwd,
      storage: options.storage,
    });
  }

  return {
    pullRequest: toPullRequestSummary({
      pullRequest: updated.pullRequest,
      latestJob: updated.latestJob,
      state: updated.pullRequest.status === "merged" ? "merged" : "open",
    }),
    rerunQueued: updated.rerunJob !== null,
    jobId: updated.rerunJob?.id ?? null,
    queuePosition: updated.queuePosition,
  };
}

function toPullRequestSummary(record: PullRequestSummaryRecord): PullRequestSummary {
  return {
    id: record.pullRequest.id,
    repositoryName: record.pullRequest.repositoryName,
    repositoryPath: record.pullRequest.repositoryPath,
    branchName: record.pullRequest.branchName,
    baseBranch: record.pullRequest.baseBranch,
    title: record.pullRequest.title,
    body: record.pullRequest.body,
    draft: record.pullRequest.draft,
    status: record.pullRequest.status,
    state: record.state,
    latestCommitHash: record.pullRequest.headCommitHash,
    latestJob: record.latestJob ? toLatestJobSummary(record.latestJob) : null,
    createdAt: record.pullRequest.createdAt,
    updatedAt: record.pullRequest.updatedAt,
  };
}

function toLatestJobSummary(
  job: PullRequestSummaryRecord["latestJob"],
): PullRequestLatestJobSummary {
  if (!job) {
    throw new Error("Latest job summary requires a CI job.");
  }

  return {
    id: job.id,
    status: job.status,
    resultPath: job.resultPath,
    errorMessage: job.errorMessage,
    mergeStatus: job.mergeStatus,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}
