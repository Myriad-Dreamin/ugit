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

export type WorkflowRunSummary = {
  id: string;
  repositoryName: string;
  repositoryPath: string;
  branchName: string;
  commitHash: string;
  workflowName: string;
  status: "queued" | "running" | "succeeded" | "failed";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ListWorkflowRunsResponse = {
  repositoryName: string;
  workflowRuns: readonly WorkflowRunSummary[];
};

export type WorkflowRunDetailResponse = {
  repositoryName: string;
  workflowRun: WorkflowRunSummary;
};

export const WORKFLOW_RUNS_PATH = "/api/workflows/runs";
export const WORKFLOW_LOGS_PATH = "/api/workflows/logs";
