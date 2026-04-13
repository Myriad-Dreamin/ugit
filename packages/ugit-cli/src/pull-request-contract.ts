export type GitPlatformPublishedBranch = {
  repositoryPath: string;
  branchName: string;
  commitHash: string;
  remoteName?: string;
  pushedAt?: string;
};

export type PullRequestListState = "open" | "merged" | "all";
export type PullRequestStatus = "queued" | "running" | "failed" | "passed" | "merged";
export type PullRequestCiStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "merge_failed"
  | "superseded";

export type SynchronizeGitPlatformPullRequestArgs = {
  repositoryPath: string;
  branchName: string;
  baseBranch: string;
  title: string;
  body: string;
  draft?: boolean;
  remoteName?: string;
};

export type SynchronizePullRequestRequest = {
  publishedBranch: GitPlatformPublishedBranch;
  pullRequest: SynchronizeGitPlatformPullRequestArgs;
};

export type PullRequestLatestJobSummary = {
  id: string;
  status: PullRequestCiStatus;
  resultPath: string | null;
  errorMessage: string | null;
  mergeStatus: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type PullRequestSummary = {
  id: number;
  repositoryName: string;
  repositoryPath: string;
  branchName: string;
  baseBranch: string;
  title: string;
  body: string;
  draft: boolean;
  status: PullRequestStatus;
  state: Exclude<PullRequestListState, "all">;
  latestCommitHash: string;
  latestJob: PullRequestLatestJobSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type ListPullRequestsRequest = {
  repositoryPath: string;
  state?: PullRequestListState;
  baseBranch?: string;
  headBranch?: string;
};

export type ListPullRequestsResponse = {
  repositoryName: string;
  pullRequests: readonly PullRequestSummary[];
};

export type EditPullRequestRequest = {
  repositoryPath: string;
  branchName: string;
  title?: string;
  body?: string;
  baseBranch?: string;
  draft?: boolean;
};

export type EditPullRequestResponse = {
  pullRequest: PullRequestSummary;
  rerunQueued: boolean;
  jobId: string | null;
  queuePosition: number | null;
};

export type SynchronizePullRequestResponse = {
  pullRequestId: number;
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "merge_failed";
  queuePosition: number;
  repositoryName: string;
  branchName: string;
  baseBranch: string;
  latestCommitHash: string;
};

export const PULL_REQUESTS_PATH = "/api/pull-requests";
export const PULL_REQUEST_SYNC_PATH = `${PULL_REQUESTS_PATH}/sync`;
