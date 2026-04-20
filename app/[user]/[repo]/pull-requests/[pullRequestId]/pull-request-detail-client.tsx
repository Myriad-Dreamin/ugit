"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import {
  formatPullRequestStatus,
  formatPullRequestTimestamp,
  isPullRequestCiJobActive,
} from "@/lib/pull-requests/presentation";
import { buildRepositoryPullRequestPath } from "@/lib/pull-requests/rest-paths";
import type {
  BrowserPullRequestDetail,
  GetRepositoryPullRequestResponse,
} from "@/packages/ugit-cli/src/pull-request-contract";

const PULL_REQUEST_DETAIL_POLL_INTERVAL_MS = 2_000;

type PullRequestDetailClientProps = Readonly<{
  initialPullRequest: BrowserPullRequestDetail;
}>;

export function PullRequestDetailClient({ initialPullRequest }: PullRequestDetailClientProps) {
  const [pullRequest, setPullRequest] = useState(initialPullRequest);
  const [liveError, setLiveError] = useState<string | null>(null);

  const refreshPullRequest = useEffectEvent(async () => {
    const response = await fetch(
      buildRepositoryPullRequestPath(pullRequest.repositoryName, pullRequest.id),
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Pull-request detail refresh failed with status ${response.status}.`);
    }

    const nextPayload = (await response.json()) as GetRepositoryPullRequestResponse;

    startTransition(() => {
      setPullRequest(nextPayload.pullRequest);
      setLiveError(null);
    });
  });

  useEffect(() => {
    if (!pullRequest.latestJob || !isPullRequestCiJobActive(pullRequest.latestJob.status)) {
      return;
    }

    let cancelled = false;

    const intervalId = window.setInterval(() => {
      void refreshPullRequest().catch((error) => {
        if (cancelled) {
          return;
        }

        console.error("Failed to refresh pull-request detail.", error);
        startTransition(() => {
          setLiveError("Live status updates are temporarily unavailable.");
        });
      });
    }, PULL_REQUEST_DETAIL_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    pullRequest.id,
    pullRequest.latestJob,
    pullRequest.latestJob?.status,
    pullRequest.repositoryName,
  ]);

  return (
    <>
      <div className="repositories-panel">
        <div className="repositories-header">
          <h2>{pullRequest.title}</h2>
          <p>#{pullRequest.id}</p>
        </div>
        <div className="workflow-detail-grid">
          <DetailCard label="Status">
            <span className="workflow-run-status" data-status={pullRequest.status}>
              {formatPullRequestStatus(pullRequest.status)}
            </span>
          </DetailCard>
          <DetailCard label="State">{formatPullRequestStatus(pullRequest.state)}</DetailCard>
          <DetailCard label="Branch">{pullRequest.branchName}</DetailCard>
          <DetailCard label="Base">{pullRequest.baseBranch}</DetailCard>
          <DetailCard label="Latest commit">
            <code>{pullRequest.latestCommitHash}</code>
          </DetailCard>
          <DetailCard label="Draft">{pullRequest.draft ? "Yes" : "No"}</DetailCard>
          <DetailCard label="Created">
            {formatPullRequestTimestamp(pullRequest.createdAt)}
          </DetailCard>
          <DetailCard label="Updated">
            {formatPullRequestTimestamp(pullRequest.updatedAt)}
          </DetailCard>
        </div>
        {pullRequest.body.length > 0 ? (
          <p className="workflow-live-note">{pullRequest.body}</p>
        ) : null}
        {liveError ? <p className="workflow-error-note">{liveError}</p> : null}
      </div>
      <div className="repositories-panel">
        <div className="repositories-header">
          <h2>GitHub delegation</h2>
          <p>{formatPullRequestStatus(pullRequest.github.state)}</p>
        </div>
        <p className="workflow-live-note">{pullRequest.github.message}</p>
        {pullRequest.github.url ? (
          <p className="page-link-row">
            <Link
              href={pullRequest.github.url}
              className="page-link"
              target="_blank"
              rel="noreferrer"
            >
              {pullRequest.github.actionLabel}
            </Link>
          </p>
        ) : (
          <p className="empty-state">Open on GitHub is unavailable for this repository.</p>
        )}
      </div>
      <div className="repositories-panel">
        <div className="repositories-header">
          <h2>Activity</h2>
          <p>
            {pullRequest.activity.length} {pullRequest.activity.length === 1 ? "event" : "events"}
          </p>
        </div>
        {pullRequest.activity.length === 0 ? (
          <p className="empty-state">No pull-request activity has been recorded yet.</p>
        ) : (
          <ol className="activity-list">
            {pullRequest.activity.map((activityEntry) => (
              <li key={activityEntry.id} className="activity-item">
                <div className="workflow-run-heading">
                  <p className="workflow-run-name">{activityEntry.title}</p>
                  <span className="workflow-run-status" data-status={activityEntry.type}>
                    {formatPullRequestStatus(activityEntry.type)}
                  </span>
                </div>
                <p className="workflow-live-note">{activityEntry.description}</p>
                <p className="workflow-run-id">
                  {formatPullRequestTimestamp(activityEntry.occurredAt)}
                  {activityEntry.jobId ? ` · ${activityEntry.jobId}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="repositories-panel">
        <div className="repositories-header">
          <h2>CI history</h2>
          <p>{pullRequest.ciJobs.length} jobs</p>
        </div>
        {pullRequest.ciJobs.length === 0 ? (
          <p className="empty-state">No CI jobs have been recorded for this pull request.</p>
        ) : (
          <ul className="workflow-run-list">
            {pullRequest.ciJobs.map((job) => (
              <li key={job.id} className="workflow-run-card">
                <div className="workflow-run-heading">
                  <div>
                    <p className="workflow-run-name">{job.branchName}</p>
                    <p className="workflow-run-id">{job.id}</p>
                  </div>
                  <span className="workflow-run-status" data-status={job.status}>
                    {formatPullRequestStatus(job.status)}
                  </span>
                </div>
                <dl className="workflow-run-meta">
                  <div>
                    <dt>Base</dt>
                    <dd>{job.baseBranch}</dd>
                  </div>
                  <div>
                    <dt>Commit</dt>
                    <dd>
                      <code>{job.commitHash}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Started</dt>
                    <dd>{formatPullRequestTimestamp(job.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>Finished</dt>
                    <dd>{formatPullRequestTimestamp(job.finishedAt)}</dd>
                  </div>
                </dl>
                {job.errorMessage ? <p className="workflow-run-error">{job.errorMessage}</p> : null}
                <div className="workflow-subsection">
                  <div className="repositories-header">
                    <h3>Workflow executions</h3>
                    <p>{formatPullRequestStatus(job.workflowResultStatus)}</p>
                  </div>
                  {job.workflowResultError ? (
                    <p className="workflow-error-note">{job.workflowResultError}</p>
                  ) : null}
                  {job.workflowExecutions.length === 0 ? (
                    <p className="empty-state">No workflow summaries are available for this job.</p>
                  ) : (
                    <ul className="workflow-execution-list">
                      {job.workflowExecutions.map((workflow) => (
                        <li key={`${job.id}-${workflow.name}`} className="workflow-execution-item">
                          <div className="workflow-run-heading">
                            <p className="workflow-run-name">{workflow.name}</p>
                            <span className="workflow-run-status" data-status={workflow.status}>
                              {formatPullRequestStatus(workflow.status)}
                            </span>
                          </div>
                          <p className="workflow-live-note">
                            Install: <code>{workflow.installCommand}</code>
                          </p>
                          {workflow.runCommand ? (
                            <p className="workflow-live-note">
                              Run: <code>{workflow.runCommand}</code>
                            </p>
                          ) : null}
                          <pre className="workflow-log-output workflow-execution-output">
                            {workflow.output}
                          </pre>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function DetailCard({
  children,
  label,
}: Readonly<{
  children: ReactNode;
  label: string;
}>) {
  return (
    <div className="workflow-detail-card">
      <p className="workflow-detail-label">{label}</p>
      <p className="workflow-detail-value">{children}</p>
    </div>
  );
}
