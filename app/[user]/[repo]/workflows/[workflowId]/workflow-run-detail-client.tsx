"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  formatWorkflowRunStatus,
  formatWorkflowTimestamp,
  isWorkflowRunActive,
} from "@/lib/workflow-runs/presentation";
import type {
  WorkflowRunDetailResponse,
  WorkflowRunSummary,
} from "@/packages/ugit-cli/src/workflow-contract";

const WORKFLOW_DETAIL_POLL_INTERVAL_MS = 2_000;

type WorkflowRunDetailClientProps = Readonly<{
  initialLogOffset: number;
  initialLogText: string;
  initialWorkflowRun: WorkflowRunSummary;
  repositoryPath: string;
}>;

export function WorkflowRunDetailClient({
  initialLogOffset,
  initialLogText,
  initialWorkflowRun,
  repositoryPath,
}: WorkflowRunDetailClientProps) {
  const [workflowRun, setWorkflowRun] = useState(initialWorkflowRun);
  const [logText, setLogText] = useState(initialLogText);
  const [liveError, setLiveError] = useState<string | null>(null);
  const logOffsetRef = useRef(initialLogOffset);

  const refreshWorkflowRun = useEffectEvent(async () => {
    const searchParams = new URLSearchParams({
      repositoryPath,
    });
    const response = await fetch(
      `/api/workflows/runs/${encodeURIComponent(workflowRun.id)}?${searchParams.toString()}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(`Workflow detail refresh failed with status ${response.status}.`);
    }

    const nextPayload = (await response.json()) as WorkflowRunDetailResponse;

    startTransition(() => {
      setWorkflowRun(nextPayload.workflowRun);
      setLiveError(null);
    });
  });

  const appendLogChunk = useEffectEvent((chunk: string, byteLength: number) => {
    if (chunk.length === 0) {
      logOffsetRef.current += byteLength;
      return;
    }

    startTransition(() => {
      setLogText((currentLogText) => currentLogText + chunk);
      setLiveError(null);
    });

    logOffsetRef.current += byteLength;
  });

  useEffect(() => {
    if (!isWorkflowRunActive(workflowRun.status)) {
      return;
    }

    let cancelled = false;

    const refresh = () =>
      refreshWorkflowRun().catch((error) => {
        if (cancelled) {
          return;
        }

        console.error("Failed to refresh workflow detail.", error);
        startTransition(() => {
          setLiveError("Live status updates are temporarily unavailable.");
        });
      });

    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, WORKFLOW_DETAIL_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [repositoryPath, workflowRun.id, workflowRun.status]);

  useEffect(() => {
    if (!isWorkflowRunActive(workflowRun.status)) {
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    const streamLogs = async () => {
      const searchParams = new URLSearchParams({
        workflowId: workflowRun.id,
        repositoryPath,
        offset: String(logOffsetRef.current),
      });
      const response = await fetch(`/api/workflows/logs?${searchParams.toString()}`, {
        cache: "no-store",
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Workflow log stream failed with status ${response.status}.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          const finalChunk = decoder.decode();

          appendLogChunk(finalChunk, 0);
          void refreshWorkflowRun().catch(() => undefined);
          return;
        }

        const decodedChunk = decoder.decode(value, { stream: true });
        appendLogChunk(decodedChunk, value.byteLength);
      }
    };

    void streamLogs().catch((error) => {
      if (cancelled || isAbortError(error)) {
        return;
      }

      console.error("Failed to stream workflow logs.", error);
      startTransition(() => {
        setLiveError("Live log streaming is temporarily unavailable.");
      });
    });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [repositoryPath, workflowRun.id, workflowRun.status]);

  return (
    <>
      <div className="repositories-panel">
        <div className="repositories-header">
          <h2>Workflow status</h2>
          <p>{workflowRun.id}</p>
        </div>
        <div className="workflow-detail-grid">
          <DetailCard label="Status">
            <span className="workflow-run-status" data-status={workflowRun.status}>
              {formatWorkflowRunStatus(workflowRun.status)}
            </span>
          </DetailCard>
          <DetailCard label="Workflow">{workflowRun.workflowName}</DetailCard>
          <DetailCard label="Branch">{workflowRun.branchName}</DetailCard>
          <DetailCard label="Commit">
            <code>{workflowRun.commitHash}</code>
          </DetailCard>
          <DetailCard label="Created">{formatWorkflowTimestamp(workflowRun.createdAt)}</DetailCard>
          <DetailCard label="Updated">{formatWorkflowTimestamp(workflowRun.updatedAt)}</DetailCard>
          <DetailCard label="Started">{formatWorkflowTimestamp(workflowRun.startedAt)}</DetailCard>
          <DetailCard label="Finished">
            {formatWorkflowTimestamp(workflowRun.finishedAt)}
          </DetailCard>
        </div>
        {workflowRun.errorMessage ? (
          <p className="workflow-run-error">{workflowRun.errorMessage}</p>
        ) : null}
        {liveError ? <p className="workflow-error-note">{liveError}</p> : null}
      </div>
      <div className="repositories-panel workflow-log-panel">
        <div className="repositories-header">
          <h2>Logs</h2>
          <p>{isWorkflowRunActive(workflowRun.status) ? "Streaming live" : "Complete"}</p>
        </div>
        <pre className="workflow-log-output">
          {logText.length > 0 ? logText : "No workflow logs have been recorded yet."}
        </pre>
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
