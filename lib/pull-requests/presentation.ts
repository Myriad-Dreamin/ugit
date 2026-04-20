import type {
  BrowserPullRequestLatestJobSummary,
  BrowserPullRequestSummary,
  PullRequestCiStatus,
} from "@/packages/ugit-cli/src/pull-request-contract";

export function isPullRequestCiJobActive(
  status: PullRequestCiStatus | BrowserPullRequestLatestJobSummary["status"],
): boolean {
  return status === "queued" || status === "running";
}

export function hasActivePullRequestSummaries(
  pullRequests: readonly BrowserPullRequestSummary[],
): boolean {
  return pullRequests.some((pullRequest) =>
    pullRequest.latestJob ? isPullRequestCiJobActive(pullRequest.latestJob.status) : false,
  );
}

export function formatPullRequestStatus(status: string): string {
  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function formatPullRequestTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return "Not available";
  }

  return new Date(timestamp).toISOString().replace("T", " ").replace(".000Z", " UTC");
}
