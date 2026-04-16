import type { WorkflowRunSummary } from "@/packages/ugit-cli/src/workflow-contract";

export function isWorkflowRunActive(status: WorkflowRunSummary["status"]): boolean {
  return status === "queued" || status === "running";
}

export function formatWorkflowRunStatus(status: WorkflowRunSummary["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatWorkflowTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "Not available";
  }

  return new Date(timestamp).toISOString().replace("T", " ").replace(".000Z", " UTC");
}
