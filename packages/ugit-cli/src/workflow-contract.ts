import type { GitPlatformPublishedBranch } from "./pull-request-contract";

export type QueueWorkflowRunRequest = {
  publishedBranch: GitPlatformPublishedBranch;
  workflowName: string;
};

export type QueueWorkflowRunResponse = {
  workflowId: string;
  workflowName: string;
  status: "queued";
  queuePosition: number;
  repositoryName: string;
  branchName: string;
  commitHash: string;
};

export const WORKFLOW_RUNS_PATH = "/api/workflows/runs";
export const WORKFLOW_LOGS_PATH = "/api/workflows/logs";
