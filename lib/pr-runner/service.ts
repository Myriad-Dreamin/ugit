import "server-only";

import type { StorageOptions } from "@/lib/storage/sqlite";
import type { SynchronizePullRequestResponse } from "@/packages/ugit-cli/src/pull-request-contract";
import { nudgePullRequestRunner } from "./runner";
import { queuePullRequestSynchronization } from "./storage";
import { validatePullRequestSyncRequest } from "./validation";

export type SynchronizePullRequestServiceOptions = Readonly<{
  cwd?: string;
  storage?: StorageOptions | string;
}>;

export function synchronizePullRequest(
  payload: unknown,
  options: SynchronizePullRequestServiceOptions = {},
): SynchronizePullRequestResponse {
  const request = validatePullRequestSyncRequest(payload, {
    cwd: options.cwd,
  });
  const queued = queuePullRequestSynchronization(request, {
    storage: options.storage,
  });

  void nudgePullRequestRunner({
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
