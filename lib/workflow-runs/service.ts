import "server-only";

import { setTimeout as delay } from "node:timers/promises";
import type { StorageOptions } from "@/lib/storage/sqlite";
import {
  appendWorkflowRunLog,
  ensureWorkflowRunLogFile,
  readWorkflowRunLogChunk,
  readWorkflowRunLogSnapshot,
} from "@/lib/workflow-runs/log-storage";
import {
  WorkflowRunRequestError,
  validateWorkflowLogsRequest,
  validateWorkflowRunDetailRequest,
  validateWorkflowRunListRequest,
  validateWorkflowRunRequest,
} from "@/lib/workflow-runs/validation";
import type {
  ListWorkflowRunsResponse,
  QueueWorkflowRunResponse,
  WorkflowRunDetailResponse,
  WorkflowRunSummary,
} from "@/packages/ugit-cli/src/workflow-contract";
import { nudgePullRequestRunner } from "@/lib/pr-runner/runner";
import {
  listWorkflowRuns as listStoredWorkflowRuns,
  queueWorkflowRun as queueStoredWorkflowRun,
  readWorkflowRun as readStoredWorkflowRun,
  readWorkflowRunForRepository,
  type WorkflowRunRecord,
} from "@/lib/pr-runner/storage";

export type WorkflowRunServiceOptions = Readonly<{
  cwd?: string;
  storage?: StorageOptions | string;
  now?: () => Date;
  workflowIdFactory?: () => string;
  nudgeRunner?: typeof nudgePullRequestRunner;
  logPollIntervalMs?: number;
}>;

export type WorkflowRunPageData = Readonly<{
  repositoryName: string;
  workflowRun: WorkflowRunSummary;
  initialLog: Readonly<{
    nextOffset: number;
    text: string;
  }>;
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

export function listWorkflowRuns(
  payload: unknown,
  options: WorkflowRunServiceOptions = {},
): ListWorkflowRunsResponse {
  const request = validateWorkflowRunListRequest(payload, {
    cwd: options.cwd,
  });

  return {
    repositoryName: request.repositoryName,
    workflowRuns: listStoredWorkflowRuns(request.repositoryPath, {
      storage: options.storage,
    }).map(toWorkflowRunSummary),
  };
}

export function getWorkflowRun(
  payload: unknown,
  options: WorkflowRunServiceOptions = {},
): WorkflowRunDetailResponse {
  const { repositoryName, workflowRun } = readRepositoryWorkflowRun(payload, options);

  return {
    repositoryName,
    workflowRun: toWorkflowRunSummary(workflowRun),
  };
}

export function getWorkflowRunPageData(
  payload: unknown,
  options: WorkflowRunServiceOptions = {},
): WorkflowRunPageData {
  const { repositoryName, workflowRun } = readRepositoryWorkflowRun(payload, options);

  return {
    repositoryName,
    workflowRun: toWorkflowRunSummary(workflowRun),
    initialLog: readWorkflowRunLogSnapshot(workflowRun.logPath),
  };
}

export function streamWorkflowRunLogs(
  payload: unknown,
  options: WorkflowRunServiceOptions = {},
): ReadableStream<Uint8Array> {
  const request = validateWorkflowLogsRequest(payload, {
    cwd: options.cwd,
  });
  const workflowRun = readWorkflowRunByContext(
    request.workflowId,
    request.repositoryPath,
    options.storage,
  );

  if (!workflowRun) {
    throw new WorkflowRunRequestError(buildWorkflowRunNotFoundMessage(request), 404);
  }

  const encoder = new TextEncoder();
  const pollIntervalMs = options.logPollIntervalMs ?? 200;
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      void pumpLogStream();

      async function pumpLogStream(): Promise<void> {
        let offset = request.offset;

        try {
          while (!cancelled) {
            const currentRun = readWorkflowRunByContext(
              request.workflowId,
              request.repositoryPath,
              options.storage,
            );

            if (!currentRun) {
              throw new WorkflowRunRequestError(buildWorkflowRunNotFoundMessage(request), 404);
            }

            const logChunk = readWorkflowRunLogChunk(currentRun.logPath, offset);

            offset = logChunk.nextOffset;

            if (logChunk.text.length > 0) {
              controller.enqueue(encoder.encode(logChunk.text));
            }

            if (!isWorkflowRunActive(currentRun.status)) {
              const finalChunk = readWorkflowRunLogChunk(currentRun.logPath, offset);

              if (finalChunk.text.length > 0) {
                controller.enqueue(encoder.encode(finalChunk.text));
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

function readRepositoryWorkflowRun(
  payload: unknown,
  options: WorkflowRunServiceOptions,
): Readonly<{
  repositoryName: string;
  workflowRun: WorkflowRunRecord;
}> {
  const request = validateWorkflowRunDetailRequest(payload, {
    cwd: options.cwd,
  });
  const workflowRun = readWorkflowRunForRepository(
    request.repositoryPath,
    request.workflowId,
    options.storage,
  );

  if (!workflowRun) {
    throw new WorkflowRunRequestError(buildWorkflowRunNotFoundMessage(request), 404);
  }

  return {
    repositoryName: request.repositoryName,
    workflowRun,
  };
}

function readWorkflowRunByContext(
  workflowId: string,
  repositoryPath: string | null,
  storage: StorageOptions | string | undefined,
): WorkflowRunRecord | null {
  if (repositoryPath) {
    return readWorkflowRunForRepository(repositoryPath, workflowId, storage);
  }

  return readStoredWorkflowRun(workflowId, storage);
}

function buildWorkflowRunNotFoundMessage(request: {
  workflowId: string;
  repositoryName: string | null | undefined;
}): string {
  if (request.repositoryName) {
    return `No workflow run exists for ${request.repositoryName}:${request.workflowId}.`;
  }

  return `No workflow run exists for ${request.workflowId}.`;
}

function isWorkflowRunActive(status: WorkflowRunSummary["status"]): boolean {
  return status === "queued" || status === "running";
}

function toWorkflowRunSummary(record: WorkflowRunRecord): WorkflowRunSummary {
  return {
    id: record.id,
    repositoryName: record.repositoryName,
    repositoryPath: record.repositoryPath,
    branchName: record.branchName,
    commitHash: record.commitHash,
    workflowName: record.workflowName,
    status: record.status,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  };
}
