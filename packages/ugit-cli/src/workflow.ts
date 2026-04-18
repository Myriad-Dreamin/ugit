import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import path from "node:path";
import type { Writable } from "node:stream";
import type { ResolvedMachine } from "./config";
import { resolveRepositoryRoot, runLocalCommand, type CommandRunner } from "./git";
import { publishCurrentBranch } from "./pr";
import { buildWorkflowExecutionPlan, resolveWorkflowPackages } from "./workflow-package";
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

type ForwardedSignal = "SIGINT" | "SIGTERM" | "SIGHUP";

type SignalTarget = Pick<NodeJS.Process, "off" | "on">;

type ForegroundChildProcess = Pick<ChildProcess, "kill" | "once">;

export type ForegroundCommandRunner = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ForegroundChildProcess;

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

export type RunLocalWorkflowOptions = Readonly<{
  cwd?: string;
  directory?: string;
  repositoryPath?: string;
  signalTarget?: SignalTarget;
  spawnCommand?: ForegroundCommandRunner;
  stdout?: Pick<Writable, "write">;
  workflowName: string;
}>;

const FORWARDED_SIGNALS: readonly ForwardedSignal[] = ["SIGINT", "SIGTERM", "SIGHUP"];

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

export async function runLocalWorkflow(options: RunLocalWorkflowOptions): Promise<number> {
  const repositoryPath =
    options.repositoryPath ??
    resolveRepositoryRoot(
      path.resolve(options.cwd ?? process.cwd(), options.directory ?? "."),
      runLocalCommand,
    );
  const workflowSelection = resolveWorkflowPackages(repositoryPath, {
    workflowName: options.workflowName,
  });

  if (workflowSelection.workflows.length === 0) {
    throw new Error(
      workflowSelection.failureMessage ?? "No workflow packages were found under .ugit/workflows.",
    );
  }

  const executionPlan = buildWorkflowExecutionPlan(workflowSelection.workflows[0]);
  const writer = options.stdout ?? process.stdout;

  writer.write(`==> ${executionPlan.workflow.name}: install\n$ ${executionPlan.installCommand}\n`);

  const installExitCode = await runForegroundCommand("pnpm", executionPlan.installArgs, {
    cwd: repositoryPath,
    signalTarget: options.signalTarget ?? process,
    spawnCommand: options.spawnCommand ?? spawn,
  });

  if (installExitCode !== 0) {
    return installExitCode;
  }

  writer.write(`==> ${executionPlan.workflow.name}: run\n$ ${executionPlan.runCommand}\n`);

  return await runForegroundCommand("pnpm", executionPlan.runArgs, {
    cwd: repositoryPath,
    signalTarget: options.signalTarget ?? process,
    spawnCommand: options.spawnCommand ?? spawn,
  });
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

async function runForegroundCommand(
  command: string,
  args: readonly string[],
  options: Readonly<{
    cwd: string;
    signalTarget: SignalTarget;
    spawnCommand: ForegroundCommandRunner;
  }>,
): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    let child: ForegroundChildProcess;

    try {
      child = options.spawnCommand(command, [...args], {
        cwd: options.cwd,
        stdio: "inherit",
      });
    } catch (error) {
      reject(new Error(`Failed to start ${formatCommand(command, args)}.`, { cause: error }));
      return;
    }

    const signalHandlers = new Map<ForwardedSignal, () => void>();

    const cleanup = () => {
      for (const [signal, handler] of signalHandlers) {
        options.signalTarget.off(signal, handler);
      }
    };

    for (const signal of FORWARDED_SIGNALS) {
      const handler = () => {
        child.kill(signal);
      };

      signalHandlers.set(signal, handler);
      options.signalTarget.on(signal, handler);
    }

    child.once("error", (error) => {
      cleanup();
      reject(new Error(`Failed to start ${formatCommand(command, args)}.`, { cause: error }));
    });
    child.once("close", (code, signal) => {
      cleanup();
      resolve(signal ? signalToExitCode(signal) : (code ?? 1));
    });
  });
}

function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args].join(" ");
}

function signalToExitCode(signal: NodeJS.Signals): number {
  switch (signal) {
    case "SIGHUP":
      return 129;
    case "SIGINT":
      return 130;
    case "SIGTERM":
      return 143;
    default:
      return 1;
  }
}
