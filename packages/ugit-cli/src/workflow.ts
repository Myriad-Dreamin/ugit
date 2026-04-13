import type { Writable } from "node:stream";
import type { ResolvedMachine } from "./config";
import { runLocalCommand, type CommandRunner } from "./git";
import { publishCurrentBranch } from "./pr";
import {
  WORKFLOW_LOGS_PATH,
  WORKFLOW_RUNS_PATH,
  type QueueWorkflowRunRequest,
  type QueueWorkflowRunResponse,
} from "./workflow-contract";
import { withMachineServer, type SpawnCommand } from "./transport";

type WorkflowServerOptions = Readonly<{
  machine: ResolvedMachine;
  localPort?: number;
  spawnCommand?: SpawnCommand;
  fetchImpl?: typeof fetch;
}>;

export type QueueWorkflowRunOptions = WorkflowServerOptions &
  Readonly<{
    repositoryPath: string;
    workflowName: string;
    remoteName?: string;
    runCommand?: CommandRunner;
    now?: () => Date;
  }>;

export type QueueWorkflowRunResult = Readonly<{
  payload: QueueWorkflowRunRequest;
  publishedBranch: ReturnType<typeof publishCurrentBranch>;
  response: QueueWorkflowRunResponse;
}>;

export type StreamWorkflowLogsOptions = WorkflowServerOptions &
  Readonly<{
    workflowId: string;
    writer?: Pick<Writable, "write">;
  }>;

export async function queueWorkflowRun(
  options: QueueWorkflowRunOptions,
): Promise<QueueWorkflowRunResult> {
  const publishedBranch = publishCurrentBranch({
    repositoryPath: options.repositoryPath,
    remoteName: options.remoteName,
    runCommand: options.runCommand ?? runLocalCommand,
    now: options.now,
  });
  const payload: QueueWorkflowRunRequest = {
    publishedBranch,
    workflowName: options.workflowName,
  };
  const response = await requestWorkflowApi<QueueWorkflowRunResponse>(
    WORKFLOW_RUNS_PATH,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    options,
  );

  return {
    payload,
    publishedBranch,
    response,
  };
}

export async function streamWorkflowLogs(options: StreamWorkflowLogsOptions): Promise<void> {
  const writer = options.writer ?? process.stdout;
  const fetchImpl = options.fetchImpl ?? fetch;

  await withMachineServer(
    options.machine,
    {
      localPort: options.localPort,
      spawnCommand: options.spawnCommand,
    },
    async ({ baseUrl }) => {
      const searchParams = new URLSearchParams({
        workflowId: options.workflowId,
      });
      const response = await fetchImpl(
        `${baseUrl}${WORKFLOW_LOGS_PATH}?${searchParams.toString()}`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          `Workflow-log request failed with status ${response.status}: ${responseText}`,
        );
      }

      if (!response.body) {
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          writer.write(decoder.decode());
          return;
        }

        writer.write(decoder.decode(value, { stream: true }));
      }
    },
  );
}

async function requestWorkflowApi<TResponse>(
  requestPath: string,
  requestInit: RequestInit,
  options: WorkflowServerOptions,
): Promise<TResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;

  return await withMachineServer(
    options.machine,
    {
      localPort: options.localPort,
      spawnCommand: options.spawnCommand,
    },
    async ({ baseUrl }) => {
      const response = await fetchImpl(`${baseUrl}${requestPath}`, requestInit);

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Workflow request failed with status ${response.status}: ${responseText}`);
      }

      return (await response.json()) as TResponse;
    },
  );
}
