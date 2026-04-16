"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useState } from "react";
import { getWorkflowRunHref } from "@/lib/owner";
import {
  formatWorkflowRunStatus,
  formatWorkflowTimestamp,
  isWorkflowRunActive,
} from "@/lib/workflow-runs/presentation";
import type {
  ListWorkflowRunsResponse,
  WorkflowRunSummary,
} from "@/packages/ugit-cli/src/workflow-contract";

const WORKFLOW_RUN_POLL_INTERVAL_MS = 3_000;

type WorkflowRunsListClientProps = Readonly<{
  initialWorkflowRuns: readonly WorkflowRunSummary[];
  repositoryName: string;
}>;

export function WorkflowRunsListClient({
  initialWorkflowRuns,
  repositoryName,
}: WorkflowRunsListClientProps) {
  const [workflowRuns, setWorkflowRuns] = useState(initialWorkflowRuns);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshWorkflowRuns = useEffectEvent(async () => {
    const searchParams = new URLSearchParams({
      repositoryName,
    });
    const response = await fetch(`/api/workflows/runs?${searchParams.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Workflow list refresh failed with status ${response.status}.`);
    }

    const nextPayload = (await response.json()) as ListWorkflowRunsResponse;

    startTransition(() => {
      setWorkflowRuns(nextPayload.workflowRuns);
      setRefreshError(null);
    });
  });

  useEffect(() => {
    let cancelled = false;

    const intervalId = window.setInterval(() => {
      void refreshWorkflowRuns().catch((error) => {
        if (cancelled) {
          return;
        }

        console.error("Failed to refresh workflow runs.", error);
        startTransition(() => {
          setRefreshError("Live updates are temporarily unavailable.");
        });
      });
    }, WORKFLOW_RUN_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [repositoryName]);

  const activeRunCount = workflowRuns.filter((workflowRun) =>
    isWorkflowRunActive(workflowRun.status),
  ).length;

  return (
    <div className="repositories-panel">
      <div className="repositories-header">
        <h2>Workflow runs</h2>
        <p>
          {workflowRuns.length} {workflowRuns.length === 1 ? "run" : "runs"}
        </p>
      </div>
      <p className="workflow-live-note">
        Polling every 3 seconds. {activeRunCount} {activeRunCount === 1 ? "run is" : "runs are"}{" "}
        currently active.
      </p>
      {refreshError ? <p className="workflow-error-note">{refreshError}</p> : null}
      {workflowRuns.length === 0 ? (
        <p className="empty-state">
          No workflow runs have been recorded for <code>{repositoryName}</code> yet.
        </p>
      ) : (
        <ul className="workflow-run-list">
          {workflowRuns.map((workflowRun) => (
            <li key={workflowRun.id}>
              <Link
                href={getWorkflowRunHref(repositoryName, workflowRun.id)}
                className="workflow-run-card"
              >
                <div className="workflow-run-heading">
                  <div>
                    <p className="workflow-run-name">{workflowRun.workflowName}</p>
                    <p className="workflow-run-id">{workflowRun.id}</p>
                  </div>
                  <span className="workflow-run-status" data-status={workflowRun.status}>
                    {formatWorkflowRunStatus(workflowRun.status)}
                  </span>
                </div>
                <dl className="workflow-run-meta">
                  <div>
                    <dt>Branch</dt>
                    <dd>{workflowRun.branchName}</dd>
                  </div>
                  <div>
                    <dt>Commit</dt>
                    <dd>
                      <code>{workflowRun.commitHash}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatWorkflowTimestamp(workflowRun.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt>Finished</dt>
                    <dd>{formatWorkflowTimestamp(workflowRun.finishedAt)}</dd>
                  </div>
                </dl>
                {workflowRun.errorMessage ? (
                  <p className="workflow-run-error">{workflowRun.errorMessage}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
