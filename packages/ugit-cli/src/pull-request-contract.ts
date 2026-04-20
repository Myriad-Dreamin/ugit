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

export type BrowserPullRequestLatestJobSummary = Omit<PullRequestLatestJobSummary, "resultPath"> & {
  commitHash: string;
};

export type BrowserPullRequestSummary = {
  id: number;
  repositoryName: string;
  branchName: string;
  baseBranch: string;
  title: string;
  body: string;
  draft: boolean;
  status: PullRequestStatus;
  state: Exclude<PullRequestListState, "all">;
  latestCommitHash: string;
  latestJob: BrowserPullRequestLatestJobSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type PullRequestActivityType =
  | "created"
  | "synchronized"
  | "edited"
  | "ci_started"
  | "ci_finished"
  | "merged";

export type PullRequestActivityEntry = {
  id: string;
  type: PullRequestActivityType;
  title: string;
  description: string;
  jobId: string | null;
  occurredAt: string;
};

export type PullRequestWorkflowExecutionSummary = {
  name: string;
  status: "passed" | "failed";
  installCommand: string;
  runCommand?: string;
  output: string;
};

export type PullRequestWorkflowResultStatus =
  | "available"
  | "missing"
  | "malformed"
  | "not_recorded";

export type BrowserPullRequestCiJobSummary = {
  id: string;
  status: PullRequestCiStatus;
  branchName: string;
  baseBranch: string;
  commitHash: string;
  errorMessage: string | null;
  mergeStatus: string | null;
  workflowResultStatus: PullRequestWorkflowResultStatus;
  workflowResultError: string | null;
  workflowExecutions: readonly PullRequestWorkflowExecutionSummary[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type PullRequestGitHubDelegation =
  | {
      state: "pull_request" | "compare";
      url: string;
      remoteName: string;
      repositoryUrl: string;
      actionLabel: "Open on GitHub";
      message: string;
    }
  | {
      state: "unavailable";
      url: null;
      remoteName: null;
      repositoryUrl: null;
      actionLabel: "Open on GitHub";
      message: string;
    };

export type PullRequestMergeReadinessState = "ready" | "blocked" | "pending";

export type PullRequestMergeReadinessCheck = {
  id: "current_ci" | "base_parity" | "github_mergeability";
  label: string;
  state: PullRequestMergeReadinessState;
  message: string;
};

export type PullRequestMergeReadiness = {
  state: PullRequestMergeReadinessState;
  canMerge: boolean;
  summary: string;
  blockingReasons: readonly string[];
  checks: readonly PullRequestMergeReadinessCheck[];
  checkedAt: string;
};

export type BrowserPullRequestDetail = BrowserPullRequestSummary & {
  activity: readonly PullRequestActivityEntry[];
  ciJobs: readonly BrowserPullRequestCiJobSummary[];
  github: PullRequestGitHubDelegation;
  mergeReadiness: PullRequestMergeReadiness;
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

export type ListRepositoryPullRequestsResponse = {
  repositoryName: string;
  pullRequests: readonly BrowserPullRequestSummary[];
};

export type GetRepositoryPullRequestResponse = {
  repositoryName: string;
  pullRequest: BrowserPullRequestDetail;
};

export type MergeRepositoryPullRequestResponse = {
  outcome: "merged" | "not_ready" | "rebase_required";
  message: string;
  pullRequest: BrowserPullRequestDetail;
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
