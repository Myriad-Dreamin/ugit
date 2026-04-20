import "server-only";

import type { StorageOptions } from "@/lib/storage/sqlite";
import {
  buildPullRequestGitHubDelegation,
  type GitCommandRunner,
} from "@/lib/pull-requests/github";
import type {
  BrowserPullRequestCiJobSummary,
  BrowserPullRequestLatestJobSummary,
  BrowserPullRequestSummary,
  EditPullRequestResponse,
  GetRepositoryPullRequestResponse,
  ListPullRequestsResponse,
  ListRepositoryPullRequestsResponse,
  PullRequestActivityEntry,
  PullRequestLatestJobSummary,
  PullRequestSummary,
  SynchronizePullRequestResponse,
} from "@/packages/ugit-cli/src/pull-request-contract";
import { nudgePullRequestRunner } from "./runner";
import { readCiResultArtifact } from "./results";
import {
  listCiJobsForPullRequest,
  listPullRequestActivityEvents,
  listPullRequests as listStoredPullRequests,
  listPullRequestsForRepository,
  queuePullRequestSynchronization,
  readPullRequestForRepository,
  updatePullRequest as updateStoredPullRequest,
  type CiJobRecord,
  type PullRequestActivityEventRecord,
  type PullRequestRecord,
  type PullRequestSummaryRecord,
} from "./storage";
import {
  PullRequestRequestError,
  validatePullRequestEditRequest,
  validatePullRequestListRequest,
  validatePullRequestSyncRequest,
  validateRepositoryPullRequestDetailRequest,
  validateRepositoryPullRequestListRequest,
} from "./validation";

export type PullRequestServiceOptions = Readonly<{
  cwd?: string;
  storage?: StorageOptions | string;
  now?: () => Date;
  jobIdFactory?: () => string;
  nudgeRunner?: typeof nudgePullRequestRunner;
  runGit?: GitCommandRunner;
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

export function listRepositoryPullRequests(
  payload: unknown,
  options: PullRequestServiceOptions = {},
): ListRepositoryPullRequestsResponse {
  const request = validateRepositoryPullRequestListRequest(payload, {
    cwd: options.cwd,
  });

  return {
    repositoryName: request.repositoryName,
    pullRequests: listPullRequestsForRepository(request.repositoryName, {
      storage: options.storage,
      state: request.state,
      baseBranch: request.baseBranch,
      headBranch: request.headBranch,
    }).map(toBrowserPullRequestSummary),
  };
}

export function getRepositoryPullRequest(
  payload: unknown,
  options: PullRequestServiceOptions = {},
): GetRepositoryPullRequestResponse {
  const request = validateRepositoryPullRequestDetailRequest(payload, {
    cwd: options.cwd,
  });
  const pullRequest = readPullRequestForRepository(
    request.repositoryName,
    request.pullRequestId,
    options.storage,
  );

  if (!pullRequest) {
    throw new PullRequestRequestError(
      `No ugit pull request exists for ${request.repositoryName}:${request.pullRequestId}.`,
      404,
    );
  }

  const ciJobs = listCiJobsForPullRequest(pullRequest.id, {
    repositoryName: request.repositoryName,
    storage: options.storage,
  });
  const latestJob = findLatestCiJob(pullRequest, ciJobs);
  const activityEvents = listPullRequestActivityEvents(pullRequest.id, {
    repositoryName: request.repositoryName,
    storage: options.storage,
  });

  return {
    repositoryName: request.repositoryName,
    pullRequest: {
      ...toBrowserPullRequestSummary({
        pullRequest,
        latestJob,
        state: pullRequest.status === "merged" ? "merged" : "open",
      }),
      activity:
        activityEvents.length > 0
          ? activityEvents.map(toActivityEntry)
          : deriveLegacyActivityEntries(pullRequest, ciJobs),
      ciJobs: ciJobs.map(toBrowserCiJobSummary),
      github: buildPullRequestGitHubDelegation({
        repositoryPath: pullRequest.repositoryPath,
        branchName: pullRequest.branchName,
        baseBranch: pullRequest.baseBranch,
        preferredRemoteName: pullRequest.remoteName,
        runGit: options.runGit,
      }),
    },
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

function toBrowserPullRequestSummary(record: PullRequestSummaryRecord): BrowserPullRequestSummary {
  return {
    id: record.pullRequest.id,
    repositoryName: record.pullRequest.repositoryName,
    branchName: record.pullRequest.branchName,
    baseBranch: record.pullRequest.baseBranch,
    title: record.pullRequest.title,
    body: record.pullRequest.body,
    draft: record.pullRequest.draft,
    status: record.pullRequest.status,
    state: record.state,
    latestCommitHash: record.pullRequest.headCommitHash,
    latestJob: record.latestJob ? toBrowserLatestJobSummary(record.latestJob) : null,
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

function toBrowserLatestJobSummary(job: CiJobRecord): BrowserPullRequestLatestJobSummary {
  return {
    id: job.id,
    status: job.status,
    commitHash: job.commitHash,
    errorMessage: job.errorMessage,
    mergeStatus: job.mergeStatus,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

function toBrowserCiJobSummary(job: CiJobRecord): BrowserPullRequestCiJobSummary {
  const artifactState = resolveWorkflowArtifact(job);

  return {
    id: job.id,
    status: job.status,
    branchName: job.branchName,
    baseBranch: job.baseBranch,
    commitHash: job.commitHash,
    errorMessage: job.errorMessage,
    mergeStatus: job.mergeStatus,
    workflowResultStatus: artifactState.status,
    workflowResultError: artifactState.errorMessage,
    workflowExecutions: artifactState.workflowExecutions,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

function resolveWorkflowArtifact(job: CiJobRecord): Readonly<{
  status: BrowserPullRequestCiJobSummary["workflowResultStatus"];
  errorMessage: string | null;
  workflowExecutions: BrowserPullRequestCiJobSummary["workflowExecutions"];
}> {
  if (!job.resultPath) {
    return {
      status: "not_recorded",
      errorMessage: null,
      workflowExecutions: [],
    };
  }

  const artifactResult = readCiResultArtifact(job.resultPath);

  if (artifactResult.status !== "available") {
    return {
      status: artifactResult.status,
      errorMessage: toBrowserWorkflowArtifactError(artifactResult.status),
      workflowExecutions: [],
    };
  }

  if (artifactResult.artifact.jobId !== job.id) {
    return {
      status: "missing",
      errorMessage: "The CI result artifact does not belong to this job.",
      workflowExecutions: [],
    };
  }

  return {
    status: "available",
    errorMessage: null,
    workflowExecutions: artifactResult.artifact.workflows,
  };
}

function toBrowserWorkflowArtifactError(
  status: Exclude<
    BrowserPullRequestCiJobSummary["workflowResultStatus"],
    "available" | "not_recorded"
  >,
): string {
  if (status === "malformed") {
    return "The CI result artifact could not be parsed for this job.";
  }

  return "The CI result artifact is unavailable for this job.";
}

function findLatestCiJob(
  pullRequest: PullRequestRecord,
  ciJobs: readonly CiJobRecord[],
): CiJobRecord | null {
  if (!pullRequest.latestJobId) {
    return null;
  }

  return ciJobs.find((job) => job.id === pullRequest.latestJobId) ?? null;
}

function toActivityEntry(event: PullRequestActivityEventRecord): PullRequestActivityEntry {
  return {
    id: String(event.id),
    type: event.eventType,
    title: event.title,
    description: event.description,
    jobId: event.jobId,
    occurredAt: event.createdAt,
  };
}

function deriveLegacyActivityEntries(
  pullRequest: PullRequestRecord,
  ciJobs: readonly CiJobRecord[],
): readonly PullRequestActivityEntry[] {
  const entries: PullRequestActivityEntry[] = [
    {
      id: `legacy-created-${pullRequest.id}`,
      type: "created",
      title: "Pull request created",
      description: `Created ${pullRequest.branchName} targeting ${pullRequest.baseBranch}.`,
      jobId: null,
      occurredAt: pullRequest.createdAt,
    },
  ];
  const orderedJobs = [...ciJobs].sort((left, right) =>
    left.createdAt === right.createdAt
      ? left.id.localeCompare(right.id)
      : left.createdAt.localeCompare(right.createdAt),
  );

  orderedJobs.forEach((job, index) => {
    if (index > 0) {
      entries.push({
        id: `legacy-sync-${job.id}`,
        type: "synchronized",
        title: "Pull request synchronized",
        description: `Synchronized ${job.branchName} at ${job.commitHash}.`,
        jobId: job.id,
        occurredAt: job.createdAt,
      });
    }

    if (job.startedAt) {
      entries.push({
        id: `legacy-start-${job.id}`,
        type: "ci_started",
        title: "CI job started",
        description: `Started CI job ${job.id} for ${job.branchName}.`,
        jobId: job.id,
        occurredAt: job.startedAt,
      });
    }

    if (job.finishedAt) {
      entries.push({
        id: `legacy-finish-${job.id}`,
        type: "ci_finished",
        title: "CI job finished",
        description: `Finished CI job ${job.id} with status ${job.status}.`,
        jobId: job.id,
        occurredAt: job.finishedAt,
      });

      if (job.status === "succeeded" && job.mergeStatus === "succeeded") {
        entries.push({
          id: `legacy-merged-${job.id}`,
          type: "merged",
          title: "Pull request merged",
          description: `Merged ${job.branchName} into ${job.baseBranch}.`,
          jobId: job.id,
          occurredAt: job.finishedAt,
        });
      }
    }
  });

  return entries.sort(compareActivityEntries);
}

function compareActivityEntries(
  left: Pick<PullRequestActivityEntry, "id" | "occurredAt">,
  right: Pick<PullRequestActivityEntry, "id" | "occurredAt">,
): number {
  if (left.occurredAt !== right.occurredAt) {
    return left.occurredAt.localeCompare(right.occurredAt);
  }

  return left.id.localeCompare(right.id);
}
