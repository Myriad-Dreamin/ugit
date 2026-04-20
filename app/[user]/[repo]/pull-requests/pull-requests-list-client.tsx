"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useState } from "react";
import { getPullRequestHref } from "@/lib/owner";
import {
  formatPullRequestStatus,
  formatPullRequestTimestamp,
  hasActivePullRequestSummaries,
} from "@/lib/pull-requests/presentation";
import { buildRepositoryPullRequestsPath } from "@/lib/pull-requests/rest-paths";
import type {
  BrowserPullRequestSummary,
  ListRepositoryPullRequestsResponse,
} from "@/packages/ugit-cli/src/pull-request-contract";

const PULL_REQUEST_POLL_INTERVAL_MS = 3_000;

type PullRequestsListClientProps = Readonly<{
  initialPullRequests: readonly BrowserPullRequestSummary[];
  repositoryName: string;
}>;

export function PullRequestsListClient({
  initialPullRequests,
  repositoryName,
}: PullRequestsListClientProps) {
  const [pullRequests, setPullRequests] = useState(initialPullRequests);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshPullRequests = useEffectEvent(async () => {
    const response = await fetch(buildRepositoryPullRequestsPath(repositoryName), {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Pull-request list refresh failed with status ${response.status}.`);
    }

    const nextPayload = (await response.json()) as ListRepositoryPullRequestsResponse;

    startTransition(() => {
      setPullRequests(nextPayload.pullRequests);
      setRefreshError(null);
    });
  });

  useEffect(() => {
    if (!hasActivePullRequestSummaries(pullRequests)) {
      return;
    }

    let cancelled = false;

    const intervalId = window.setInterval(() => {
      void refreshPullRequests().catch((error) => {
        if (cancelled) {
          return;
        }

        console.error("Failed to refresh pull requests.", error);
        startTransition(() => {
          setRefreshError("Live updates are temporarily unavailable.");
        });
      });
    }, PULL_REQUEST_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pullRequests, repositoryName]);

  const activePullRequestCount = pullRequests.filter((pullRequest) =>
    pullRequest.latestJob ? ["queued", "running"].includes(pullRequest.latestJob.status) : false,
  ).length;

  return (
    <div className="repositories-panel">
      <div className="repositories-header">
        <h2>Pull requests</h2>
        <p>
          {pullRequests.length} {pullRequests.length === 1 ? "pull request" : "pull requests"}
        </p>
      </div>
      <p className="workflow-live-note">
        {activePullRequestCount > 0
          ? `Polling every 3 seconds. ${activePullRequestCount} active pull request${activePullRequestCount === 1 ? "" : "s"} remaining.`
          : "Polling pauses when no pull request has an active CI job."}
      </p>
      {refreshError ? <p className="workflow-error-note">{refreshError}</p> : null}
      {pullRequests.length === 0 ? (
        <p className="empty-state">
          No pull requests have been recorded for <code>{repositoryName}</code> yet.
        </p>
      ) : (
        <ul className="workflow-run-list">
          {pullRequests.map((pullRequest) => (
            <li key={pullRequest.id}>
              <Link
                href={getPullRequestHref(repositoryName, pullRequest.id)}
                className="workflow-run-card"
              >
                <div className="workflow-run-heading">
                  <div>
                    <p className="workflow-run-name">{pullRequest.title}</p>
                    <p className="workflow-run-id">
                      #{pullRequest.id} · {pullRequest.branchName}
                    </p>
                  </div>
                  <span className="workflow-run-status" data-status={pullRequest.status}>
                    {formatPullRequestStatus(pullRequest.status)}
                  </span>
                </div>
                <dl className="workflow-run-meta">
                  <div>
                    <dt>Base</dt>
                    <dd>{pullRequest.baseBranch}</dd>
                  </div>
                  <div>
                    <dt>State</dt>
                    <dd>{formatPullRequestStatus(pullRequest.state)}</dd>
                  </div>
                  <div>
                    <dt>Latest commit</dt>
                    <dd>
                      <code>{pullRequest.latestCommitHash}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatPullRequestTimestamp(pullRequest.updatedAt)}</dd>
                  </div>
                </dl>
                {pullRequest.latestJob ? (
                  <p className="workflow-live-note">
                    Latest CI job {pullRequest.latestJob.id}:{" "}
                    {formatPullRequestStatus(pullRequest.latestJob.status)}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
