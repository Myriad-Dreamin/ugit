export type GitPlatformPublishedBranch = {
  repositoryPath: string;
  branchName: string;
  commitHash: string;
  remoteName?: string;
  pushedAt?: string;
};

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

export const PULL_REQUEST_SYNC_PATH = "/api/pull-requests/sync";
