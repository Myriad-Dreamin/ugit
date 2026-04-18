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

export type CreateRepositoryOriginConflictResolution = "reject" | "replace";

export type CreateRepositoryOptions = Readonly<{
  machineName: string;
  directory?: string;
  cwd?: string;
  config?: UgitConfig;
  loadConfig?: () => UgitConfig;
  runCommand?: CommandRunner;
  createDirectory?: CreateDirectory;
  pathExists?: PathExists;
  originConflictResolution?: CreateRepositoryOriginConflictResolution;
}>;

export type CreateRepositoryResult = Readonly<{
  machineName: string;
  repositoryName: string;
  repositoryPath: string;
  remoteRepositoryPath: string;
  originUrl: string;
}>;

export type CreateRepositoryOriginConflict = Readonly<{
  repositoryPath: string;
  existingOriginUrl: string;
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

type PreparedCreateRepository = Readonly<{
  runCommand: CommandRunner;
  createDirectory: CreateDirectory;
  pathExists: PathExists;
  repositoryPath: string;
  repositoryName: string;
  upstreamUrl: string;
  machine: ResolvedMachine;
  remoteRepositoryPath: string;
  originUrl: string;
  existingOriginUrl: string | null;
}>;

type LocalOriginMutation = "added" | "updated" | null;

export function inspectCreateRepositoryOriginConflict(
  options: CreateRepositoryOptions,
): CreateRepositoryOriginConflict | null {
  return getCreateRepositoryOriginConflict(prepareCreateRepository(options));
}

export function createRepository(options: CreateRepositoryOptions): CreateRepositoryResult {
  const prepared = prepareCreateRepository(options);
  const originConflict = getCreateRepositoryOriginConflict(prepared);
  const originConflictResolution = options.originConflictResolution ?? "reject";

  if (originConflict && originConflictResolution !== "replace") {
    throw new Error(
      `Repository ${originConflict.repositoryPath} already has an "${ORIGIN_REMOTE_NAME}" remote (${originConflict.existingOriginUrl}). Re-run ugit create with explicit origin replacement approval before pointing it at ${originConflict.originUrl}.`,
    );
  }

  const machineHost = createMachineHost(prepared.machine, {
    runCommand: prepared.runCommand,
    createDirectory: prepared.createDirectory,
    pathExists: prepared.pathExists,
  });

  if (machineHost.pathExists(prepared.remoteRepositoryPath)) {
    throw new Error(
      `Remote repository path ${prepared.remoteRepositoryPath} already exists on machine "${prepared.machine.name}".`,
    );
  }

  try {
    machineHost.ensureDirectoryExists(path.dirname(prepared.remoteRepositoryPath));
    machineHost.initializeRepository(prepared.remoteRepositoryPath);
    machineHost.configureReceiveUpdates(prepared.remoteRepositoryPath);
    machineHost.addRemote(
      prepared.remoteRepositoryPath,
      UPSTREAM_REMOTE_NAME,
      prepared.upstreamUrl,
    );
  } catch (error) {
    throw new Error(
      `Failed to initialize ugit repository ${prepared.remoteRepositoryPath} on machine "${prepared.machine.name}".`,
      { cause: error },
    );
  }

  const localOriginMutation = configureLocalOrigin(prepared, originConflict);
  configureLocalMachine(prepared, localOriginMutation);

  return {
    machineName: prepared.machine.name,
    repositoryName: prepared.repositoryName,
    repositoryPath: prepared.repositoryPath,
    remoteRepositoryPath: prepared.remoteRepositoryPath,
    originUrl: prepared.originUrl,
  };
}

function prepareCreateRepository(options: CreateRepositoryOptions): PreparedCreateRepository {
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

  return {
    runCommand,
    createDirectory,
    pathExists,
    repositoryPath,
    repositoryName,
    upstreamUrl,
    machine,
    remoteRepositoryPath: getRemoteRepositoryPath(machine, repositoryName),
    originUrl: getRemoteRepositoryUrl(machine, repositoryName),
    existingOriginUrl: readOptionalRemoteUrl(repositoryPath, ORIGIN_REMOTE_NAME, runCommand),
  };
}

function getCreateRepositoryOriginConflict(
  prepared: PreparedCreateRepository,
): CreateRepositoryOriginConflict | null {
  if (!prepared.existingOriginUrl || prepared.existingOriginUrl === prepared.originUrl) {
    return null;
  }

  return {
    repositoryPath: prepared.repositoryPath,
    existingOriginUrl: prepared.existingOriginUrl,
    originUrl: prepared.originUrl,
  };
}

function configureLocalOrigin(
  prepared: PreparedCreateRepository,
  originConflict: CreateRepositoryOriginConflict | null,
): LocalOriginMutation {
  const recordMachineCommand = createLocalGitCommand(prepared.repositoryPath, [
    "config",
    "--local",
    MACHINE_CONFIG_KEY,
    prepared.machine.name,
  ]);

  if (!prepared.existingOriginUrl) {
    const addOriginArgs = ["remote", "add", ORIGIN_REMOTE_NAME, prepared.originUrl];

    try {
      runGit(prepared.repositoryPath, addOriginArgs, prepared.runCommand);
    } catch (error) {
      throw createLocalSetupError(
        prepared,
        `, but failed to add local "${ORIGIN_REMOTE_NAME}" in ${prepared.repositoryPath}.`,
        [createLocalGitCommand(prepared.repositoryPath, addOriginArgs), recordMachineCommand],
        error,
      );
    }

    return "added";
  }

  if (!originConflict) {
    return null;
  }

  const replaceOriginArgs = ["remote", "set-url", ORIGIN_REMOTE_NAME, prepared.originUrl];

  try {
    runGit(prepared.repositoryPath, replaceOriginArgs, prepared.runCommand);
  } catch (error) {
    throw createLocalSetupError(
      prepared,
      `, but failed to replace local "${ORIGIN_REMOTE_NAME}" in ${prepared.repositoryPath}.`,
      [createLocalGitCommand(prepared.repositoryPath, replaceOriginArgs), recordMachineCommand],
      error,
    );
  }

  return "updated";
}

function configureLocalMachine(
  prepared: PreparedCreateRepository,
  localOriginMutation: LocalOriginMutation,
): void {
  const recordMachineArgs = ["config", "--local", MACHINE_CONFIG_KEY, prepared.machine.name];

  try {
    runGit(prepared.repositoryPath, recordMachineArgs, prepared.runCommand);
  } catch (error) {
    const localSetupPrefix = getLocalMachineFailurePrefix(localOriginMutation);

    throw createLocalSetupError(
      prepared,
      `${localSetupPrefix} failed to record machine "${prepared.machine.name}" in ${prepared.repositoryPath}.`,
      [createLocalGitCommand(prepared.repositoryPath, recordMachineArgs)],
      error,
    );
  }
}

function getLocalMachineFailurePrefix(localOriginMutation: LocalOriginMutation): string {
  if (localOriginMutation === "added") {
    return ` and added local "${ORIGIN_REMOTE_NAME}", but`;
  }

  if (localOriginMutation === "updated") {
    return ` and updated local "${ORIGIN_REMOTE_NAME}", but`;
  }

  return ", but";
}

function createLocalSetupError(
  prepared: PreparedCreateRepository,
  failureDetail: string,
  recoveryCommands: readonly string[],
  cause: unknown,
): Error {
  return new Error(
    `Created ugit repository ${prepared.remoteRepositoryPath} on machine "${prepared.machine.name}"${failureDetail} The remote repository now exists at ${prepared.remoteRepositoryPath}, so rerunning ugit create will fail until you remove it or finish the remaining local setup manually. Finish setup with:\n${recoveryCommands.map((command) => `  ${command}`).join("\n")}`,
    { cause },
  );
}

function createLocalGitCommand(repositoryPath: string, args: readonly string[]): string {
  return ["git", "-C", repositoryPath, ...args].join(" ");
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
