import "server-only";

import { setTimeout as delay } from "node:timers/promises";
import type { StorageOptions } from "@/lib/storage/sqlite";
import {
  appendWorkflowRunLog,
  ensureWorkflowRunLogFile,
  readWorkflowRunLogChunk,
} from "@/lib/workflow-runs/log-storage";
import {
  WorkflowRunRequestError,
  validateWorkflowLogsRequest,
  validateWorkflowRunRequest,
} from "@/lib/workflow-runs/validation";
import type { QueueWorkflowRunResponse } from "@/packages/ugit-cli/src/workflow-contract";
import { nudgePullRequestRunner } from "@/lib/pr-runner/runner";
import {
  queueWorkflowRun as queueStoredWorkflowRun,
  readWorkflowRun,
} from "@/lib/pr-runner/storage";

export type WorkflowRunServiceOptions = Readonly<{
  cwd?: string;
  storage?: StorageOptions | string;
  now?: () => Date;
  workflowIdFactory?: () => string;
  nudgeRunner?: typeof nudgePullRequestRunner;
  logPollIntervalMs?: number;
}>;

export function queueWorkflowRun(
  payload: unknown,
  options: WorkflowRunServiceOptions = {},
): QueueWorkflowRunResponse {
  const request = validateWorkflowRunRequest(payload, {
    cwd: options.cwd,
  });
  const queued = queueStoredWorkflowRun(request, {
    cwd: options.cwd,
    now: options.now,
    storage: options.storage,
    workflowIdFactory: options.workflowIdFactory,
  });

  ensureWorkflowRunLogFile(queued.workflowRun.logPath);
  appendWorkflowRunLog(
    queued.workflowRun.logPath,
    `Queued workflow ${queued.workflowRun.id} for ${queued.workflowRun.repositoryName}:${queued.workflowRun.branchName} (${queued.workflowRun.workflowName} @ ${queued.workflowRun.commitHash}).\n`,
  );

  void (options.nudgeRunner ?? nudgePullRequestRunner)({
    cwd: options.cwd,
    storage: options.storage,
  });

  return {
    workflowId: queued.workflowRun.id,
    workflowName: queued.workflowRun.workflowName,
    status: "queued",
    queuePosition: queued.queuePosition,
    repositoryName: queued.workflowRun.repositoryName,
    branchName: queued.workflowRun.branchName,
    commitHash: queued.workflowRun.commitHash,
  };
}

export function streamWorkflowRunLogs(
  workflowId: unknown,
  options: WorkflowRunServiceOptions = {},
): ReadableStream<Uint8Array> {
  const request = validateWorkflowLogsRequest(workflowId);
  const workflowRun = readWorkflowRun(request.workflowId, options.storage);

  if (!workflowRun) {
    throw new WorkflowRunRequestError(`No workflow run exists for ${request.workflowId}.`, 404);
  }

  const encoder = new TextEncoder();
  const pollIntervalMs = options.logPollIntervalMs ?? 200;
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      void pumpLogStream();

      async function pumpLogStream(): Promise<void> {
        let offset = 0;

        try {
          while (!cancelled) {
            const currentRun = readWorkflowRun(request.workflowId, options.storage);

            if (!currentRun) {
              throw new WorkflowRunRequestError(
                `No workflow run exists for ${request.workflowId}.`,
                404,
              );
            }

            const logChunk = readWorkflowRunLogChunk(currentRun.logPath, offset);

            offset = logChunk.nextOffset;

            if (logChunk.text.length > 0) {
              controller.enqueue(encoder.encode(logChunk.text));
            }

            if (currentRun.status !== "queued" && currentRun.status !== "running") {
              const finalChunk = readWorkflowRunLogChunk(currentRun.logPath, offset);

              if (finalChunk.text.length > 0) {
                controller.enqueue(encoder.encode(finalChunk.text));
                offset = finalChunk.nextOffset;
              }

              controller.close();
              return;
            }

            await delay(pollIntervalMs);
          }
        } catch (error) {
          controller.error(error);
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });
}
