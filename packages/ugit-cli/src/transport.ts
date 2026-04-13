import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import type { ResolvedMachine } from "./config";

export type SpawnCommand = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess;

export type MachineServerAccess = Readonly<{
  baseUrl: string;
  localPort: number;
}>;

export type WithMachineServerOptions = Readonly<{
  localPort?: number;
  spawnCommand?: SpawnCommand;
  fetchTimeoutMs?: number;
}>;

export function buildMachineServerUrl(port: number): string {
  return `http://127.0.0.1:${port}`;
}

export function buildSshPortForwardArgs(
  machine: ResolvedMachine,
  localPort: number,
): readonly string[] {
  if (machine.isLocal) {
    return [];
  }

  return [
    "-N",
    "-T",
    "-o",
    "ExitOnForwardFailure=yes",
    "-L",
    `${localPort}:127.0.0.1:${machine.serverPort}`,
    machine.sshMachine,
  ];
}

export async function withMachineServer<T>(
  machine: ResolvedMachine,
  options: WithMachineServerOptions,
  callback: (access: MachineServerAccess) => Promise<T>,
): Promise<T> {
  const localPort = machine.isLocal
    ? machine.serverPort
    : (options.localPort ?? (await findOpenPort()));

  if (machine.isLocal) {
    return callback({
      baseUrl: buildMachineServerUrl(localPort),
      localPort,
    });
  }

  const spawnCommand = options.spawnCommand ?? spawn;
  const child = spawnCommand("ssh", buildSshPortForwardArgs(machine, localPort), {
    stdio: "ignore",
  });

  try {
    await waitForLocalPort(localPort, child, options.fetchTimeoutMs ?? 5000);

    return await callback({
      baseUrl: buildMachineServerUrl(localPort),
      localPort,
    });
  } finally {
    await stopChildProcess(child);
  }
}

async function findOpenPort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Failed to resolve an open local port."));
        return;
      }

      const { port } = address;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function waitForLocalPort(
  localPort: number,
  child: ChildProcess,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`SSH port forward exited with code ${child.exitCode}.`);
    }

    const isOpen = await canConnect(localPort);

    if (isOpen) {
      return;
    }

    await delay(50);
  }

  throw new Error(`Timed out while waiting for an SSH tunnel on local port ${localPort}.`);
}

async function canConnect(port: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = net.connect({
      host: "127.0.0.1",
      port,
    });

    const finalize = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.once("connect", () => finalize(true));
    socket.once("error", () => finalize(false));
  });
}

async function stopChildProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  child.kill("SIGTERM");

  const exited = await Promise.race([onceExit(child), delay(1000).then(() => false)]);

  if (!exited && child.exitCode === null) {
    child.kill("SIGKILL");
    await onceExit(child);
  }
}

async function onceExit(child: ChildProcess): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    child.once("exit", () => resolve(true));
    child.once("error", () => resolve(true));
  });
}
