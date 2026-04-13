import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  getRemoteRepositoryPath,
  getRemoteRepositoryUrl,
  loadConfig,
  resolveMachine,
  type ResolvedMachine,
  type UgitConfig,
} from "./config";

const ORIGIN_REMOTE_NAME = "origin";
const UPSTREAM_REMOTE_NAME = "upstream";
const MACHINE_CONFIG_KEY = "ugit.machine";

export type CommandRunnerOptions = Readonly<{
  cwd?: string;
}>;

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: CommandRunnerOptions,
) => string;

type CreateDirectory = (targetPath: string) => void;
type PathExists = (targetPath: string) => boolean;

export type CreateRepositoryOptions = Readonly<{
  machineName: string;
  directory?: string;
  cwd?: string;
  config?: UgitConfig;
  loadConfig?: () => UgitConfig;
  runCommand?: CommandRunner;
  createDirectory?: CreateDirectory;
  pathExists?: PathExists;
}>;

export type CreateRepositoryResult = Readonly<{
  machineName: string;
  repositoryName: string;
  repositoryPath: string;
  remoteRepositoryPath: string;
  originUrl: string;
}>;

type MachineHostDependencies = Readonly<{
  runCommand: CommandRunner;
  createDirectory: CreateDirectory;
  pathExists: PathExists;
}>;

type MachineHost = Readonly<{
  pathExists: PathExists;
  ensureDirectoryExists: CreateDirectory;
  initializeRepository: CreateDirectory;
  configureReceiveUpdates: CreateDirectory;
  addRemote: (repositoryPath: string, remoteName: string, remoteUrl: string) => void;
}>;

export function createRepository(options: CreateRepositoryOptions): CreateRepositoryResult {
  const cwd = options.cwd ?? process.cwd();
  const runCommand = options.runCommand ?? runLocalCommand;
  const createDirectory = options.createDirectory ?? createLocalDirectory;
  const pathExists = options.pathExists ?? existsSync;
  const config = options.config ?? options.loadConfig?.() ?? loadConfig();
  const requestedDirectory = path.resolve(cwd, options.directory ?? ".");

  if (!pathExists(requestedDirectory)) {
    throw new Error(`Directory ${requestedDirectory} does not exist.`);
  }

  const repositoryPath = resolveRepositoryRoot(requestedDirectory, runCommand);
  const repositoryName = path.basename(repositoryPath);

  if (repositoryName.length === 0) {
    throw new Error(`Unable to derive a repository name from ${repositoryPath}.`);
  }

  const upstreamUrl = readRequiredRemoteUrl(repositoryPath, UPSTREAM_REMOTE_NAME, runCommand);
  const machine = resolveMachine(config, options.machineName);
  const remoteRepositoryPath = getRemoteRepositoryPath(machine, repositoryName);
  const originUrl = getRemoteRepositoryUrl(machine, repositoryName);
  const existingOriginUrl = readOptionalRemoteUrl(repositoryPath, ORIGIN_REMOTE_NAME, runCommand);

  if (existingOriginUrl && existingOriginUrl !== originUrl) {
    throw new Error(
      `Repository ${repositoryPath} already has an "${ORIGIN_REMOTE_NAME}" remote (${existingOriginUrl}). Remove it or point it at ${originUrl} before running ugit create.`,
    );
  }

  const machineHost = createMachineHost(machine, {
    runCommand,
    createDirectory,
    pathExists,
  });

  if (machineHost.pathExists(remoteRepositoryPath)) {
    throw new Error(
      `Remote repository path ${remoteRepositoryPath} already exists on machine "${machine.name}".`,
    );
  }

  try {
    machineHost.ensureDirectoryExists(path.dirname(remoteRepositoryPath));
    machineHost.initializeRepository(remoteRepositoryPath);
    machineHost.configureReceiveUpdates(remoteRepositoryPath);
    machineHost.addRemote(remoteRepositoryPath, UPSTREAM_REMOTE_NAME, upstreamUrl);
  } catch (error) {
    throw new Error(
      `Failed to initialize ugit repository ${remoteRepositoryPath} on machine "${machine.name}".`,
      { cause: error },
    );
  }

  if (!existingOriginUrl) {
    runGit(repositoryPath, ["remote", "add", ORIGIN_REMOTE_NAME, originUrl], runCommand);
  }

  runGit(repositoryPath, ["config", "--local", MACHINE_CONFIG_KEY, machine.name], runCommand);

  return {
    machineName: machine.name,
    repositoryName,
    repositoryPath,
    remoteRepositoryPath,
    originUrl,
  };
}

function createMachineHost(
  machine: ResolvedMachine,
  dependencies: MachineHostDependencies,
): MachineHost {
  if (machine.isLocal) {
    return {
      pathExists: dependencies.pathExists,
      ensureDirectoryExists: dependencies.createDirectory,
      initializeRepository(repositoryPath) {
        dependencies.runCommand("git", [
          "-c",
          "init.defaultBranch=main",
          "init",
          "--quiet",
          repositoryPath,
        ]);
      },
      configureReceiveUpdates(repositoryPath) {
        dependencies.runCommand(
          "git",
          ["config", "--local", "receive.denyCurrentBranch", "updateInstead"],
          {
            cwd: repositoryPath,
          },
        );
      },
      addRemote(repositoryPath, remoteName, remoteUrl) {
        dependencies.runCommand("git", ["remote", "add", remoteName, remoteUrl], {
          cwd: repositoryPath,
        });
      },
    };
  }

  return {
    pathExists(repositoryPath) {
      return remotePathExists(machine.sshMachine, repositoryPath, dependencies.runCommand);
    },
    ensureDirectoryExists(targetPath) {
      runRemoteShellCommand(
        machine.sshMachine,
        buildShellCommand(["mkdir", "-p", targetPath]),
        dependencies.runCommand,
      );
    },
    initializeRepository(repositoryPath) {
      runRemoteShellCommand(
        machine.sshMachine,
        buildShellCommand([
          "git",
          "-c",
          "init.defaultBranch=main",
          "init",
          "--quiet",
          repositoryPath,
        ]),
        dependencies.runCommand,
      );
    },
    configureReceiveUpdates(repositoryPath) {
      runRemoteShellCommand(
        machine.sshMachine,
        buildShellCommand([
          "git",
          "-C",
          repositoryPath,
          "config",
          "--local",
          "receive.denyCurrentBranch",
          "updateInstead",
        ]),
        dependencies.runCommand,
      );
    },
    addRemote(repositoryPath, remoteName, remoteUrl) {
      runRemoteShellCommand(
        machine.sshMachine,
        buildShellCommand(["git", "-C", repositoryPath, "remote", "add", remoteName, remoteUrl]),
        dependencies.runCommand,
      );
    },
  };
}

function resolveRepositoryRoot(targetPath: string, runCommand: CommandRunner): string {
  let repositoryRoot: string;

  try {
    repositoryRoot = runGit(targetPath, ["rev-parse", "--show-toplevel"], runCommand);
  } catch (error) {
    throw new Error(`Directory ${targetPath} is not an existing Git repository root.`, {
      cause: error,
    });
  }

  const normalizedRepositoryRoot = path.resolve(repositoryRoot);
  const normalizedTargetPath = path.resolve(targetPath);

  if (normalizedRepositoryRoot !== normalizedTargetPath) {
    throw new Error(
      `Directory ${targetPath} is inside repository ${normalizedRepositoryRoot}. Run ugit create from the repository root or pass the repository root directory explicitly.`,
    );
  }

  return normalizedRepositoryRoot;
}

function readRequiredRemoteUrl(
  repositoryPath: string,
  remoteName: string,
  runCommand: CommandRunner,
): string {
  const remoteUrl = readOptionalRemoteUrl(repositoryPath, remoteName, runCommand);

  if (!remoteUrl) {
    throw new Error(
      `Repository ${repositoryPath} requires a local "${remoteName}" remote before ugit create can run.`,
    );
  }

  return remoteUrl;
}

function readOptionalRemoteUrl(
  repositoryPath: string,
  remoteName: string,
  runCommand: CommandRunner,
): string | null {
  try {
    return runGit(repositoryPath, ["remote", "get-url", remoteName], runCommand);
  } catch (error) {
    const stderr = getProcessStream(error, "stderr");

    if (
      stderr.includes(`No such remote '${remoteName}'`) ||
      stderr.includes(`No such remote: '${remoteName}'`)
    ) {
      return null;
    }

    throw new Error(`Failed to read Git remote "${remoteName}" in ${repositoryPath}.`, {
      cause: error,
    });
  }
}

function remotePathExists(
  sshMachine: string,
  repositoryPath: string,
  runCommand: CommandRunner,
): boolean {
  try {
    runRemoteShellCommand(
      sshMachine,
      buildShellCommand(["test", "-e", repositoryPath]),
      runCommand,
    );

    return true;
  } catch (error) {
    if (getProcessStatus(error) === 1) {
      return false;
    }

    throw new Error(`Failed to inspect ${repositoryPath} on ${sshMachine}.`, { cause: error });
  }
}

function runGit(
  repositoryPath: string,
  args: readonly string[],
  runCommand: CommandRunner,
): string {
  return runCommand("git", args, { cwd: repositoryPath });
}

function runLocalCommand(
  command: string,
  args: readonly string[],
  options: CommandRunnerOptions = {},
): string {
  const execOptions: ExecFileSyncOptions = {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  };

  return execFileSync(command, [...args], execOptions)
    .toString()
    .trim();
}

function createLocalDirectory(targetPath: string): void {
  mkdirSync(targetPath, { recursive: true });
}

function runRemoteShellCommand(
  sshMachine: string,
  command: string,
  runCommand: CommandRunner,
): string {
  return runCommand("ssh", [sshMachine, "sh", "-lc", shellQuote(command)]);
}

function buildShellCommand(args: readonly string[]): string {
  return args.map(shellQuote).join(" ");
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function getProcessStream(error: unknown, streamName: "stderr" | "stdout"): string {
  if (!error || typeof error !== "object") {
    return "";
  }

  const stream = (error as { [key: string]: unknown })[streamName];

  if (typeof stream === "string") {
    return stream;
  }

  if (Buffer.isBuffer(stream)) {
    return stream.toString("utf8");
  }

  return "";
}

function getProcessStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const status = (error as { status?: unknown }).status;

  return typeof status === "number" ? status : null;
}
