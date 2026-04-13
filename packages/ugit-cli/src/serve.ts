import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { loadConfig, resolveMachine, type UgitConfig } from "./config";

type Writable = Pick<NodeJS.WriteStream, "write">;

export type SshPortForwardOptions = Readonly<{
  sshMachine: string;
  localPort: number;
  remotePort: number;
}>;

export type SpawnProcess = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;

export type ServeMachineOptions = Readonly<{
  machineName: string;
  localPort?: number;
  config?: UgitConfig;
  loadConfig?: () => UgitConfig;
  runPortForward?: (options: SshPortForwardOptions) => Promise<void>;
  stdout?: Writable;
}>;

export type ServeMachineResult = Readonly<{
  machineName: string;
  sshMachine: string;
  localPort: number;
  remotePort: number;
  url: string;
}>;

export async function serveMachine(options: ServeMachineOptions): Promise<ServeMachineResult> {
  const config = options.config ?? options.loadConfig?.() ?? loadConfig();
  const machine = resolveMachine(config, options.machineName);
  const localPort = validatePort(
    options.localPort ?? machine.serverPort,
    options.localPort === undefined
      ? `Configured serverPort for machine "${machine.name}"`
      : "Local port",
  );
  const remotePort = validatePort(
    machine.serverPort,
    `Configured serverPort for machine "${machine.name}"`,
  );
  const url = `http://127.0.0.1:${localPort}`;

  options.stdout?.write(
    `Forwarding ${url} to machine "${machine.name}" via SSH host "${machine.sshMachine}" (remote port ${remotePort}). Press Ctrl+C to stop.\n`,
  );

  await (options.runPortForward ?? runSshPortForward)({
    sshMachine: machine.sshMachine,
    localPort,
    remotePort,
  });

  return {
    machineName: machine.name,
    sshMachine: machine.sshMachine,
    localPort,
    remotePort,
    url,
  };
}

export function parsePort(value: string, label: string = "Port"): number {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error(`${label} must be an integer between 1 and 65535.`);
  }

  return validatePort(Number.parseInt(value, 10), label);
}

export function buildSshPortForwardArgs(options: SshPortForwardOptions): string[] {
  return [
    "-N",
    "-o",
    "ExitOnForwardFailure=yes",
    "-L",
    `${options.localPort}:127.0.0.1:${options.remotePort}`,
    options.sshMachine,
  ];
}

export function runSshPortForward(
  options: SshPortForwardOptions,
  dependencies: Readonly<{
    spawnProcess?: SpawnProcess;
  }> = {},
): Promise<void> {
  const spawnProcess = dependencies.spawnProcess ?? spawn;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };
    const rejectWithMessage = (message: string, cause?: unknown): void => {
      finish(() => reject(new Error(message, { cause })));
    };

    let child: ChildProcess;

    try {
      child = spawnProcess("ssh", buildSshPortForwardArgs(options), {
        stdio: "inherit",
      });
    } catch (error) {
      rejectWithMessage(
        `Failed to start SSH port forwarding to "${options.sshMachine}". Verify SSH access and that local port ${options.localPort} is available.`,
        error,
      );
      return;
    }

    child.once("error", (error) => {
      rejectWithMessage(
        `Failed to start SSH port forwarding to "${options.sshMachine}". Verify SSH access and that local port ${options.localPort} is available.`,
        error,
      );
    });

    child.once("exit", (code, signal) => {
      if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") {
        finish(resolve);
        return;
      }

      if (signal) {
        rejectWithMessage(
          `SSH port forwarding to "${options.sshMachine}" was interrupted by ${signal}.`,
        );
        return;
      }

      rejectWithMessage(
        `SSH port forwarding to "${options.sshMachine}" exited with code ${code ?? "unknown"}. Verify SSH access and that local port ${options.localPort} is available.`,
      );
    });
  });
}

function validatePort(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${label} must be an integer between 1 and 65535.`);
  }

  return value;
}
