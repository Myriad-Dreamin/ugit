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
import {
  buildShellCommand,
  getProcessStatus,
  readOptionalRemoteUrl,
  resolveRepositoryRoot,
  runGit,
  runLocalCommand,
  runRemoteShellCommand,
  type CommandRunner,
} from "./git";
import { MACHINE_CONFIG_KEY } from "./machine";

export type { CommandRunner, CommandRunnerOptions } from "./git";

const ORIGIN_REMOTE_NAME = "origin";
const UPSTREAM_REMOTE_NAME = "upstream";

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

  const upstreamUrl = readOptionalRemoteUrl(repositoryPath, UPSTREAM_REMOTE_NAME, runCommand);

  if (!upstreamUrl) {
    throw new Error(
      `Repository ${repositoryPath} requires a local "${UPSTREAM_REMOTE_NAME}" remote before ugit create can run.`,
    );
  }
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

function createLocalDirectory(targetPath: string): void {
  mkdirSync(targetPath, { recursive: true });
}
