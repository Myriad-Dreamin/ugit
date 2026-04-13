import path from "node:path";
import { loadConfig, resolveMachine, type ResolvedMachine, type UgitConfig } from "./config";
import { readGitConfig, resolveRepositoryRoot, runLocalCommand, type CommandRunner } from "./git";

export const MACHINE_CONFIG_KEY = "ugit.machine";

export type ResolveConfiguredMachineOptions = Readonly<{
  machineName?: string;
  directory?: string;
  cwd?: string;
  requireRepository?: boolean;
  config?: UgitConfig;
  loadConfig?: () => UgitConfig;
  runCommand?: CommandRunner;
}>;

export type ResolvedConfiguredMachine = Readonly<{
  machine: ResolvedMachine;
  repositoryPath: string | null;
  source: "flag" | "git-config";
}>;

export function resolveConfiguredMachine(
  options: ResolveConfiguredMachineOptions,
): ResolvedConfiguredMachine {
  const cwd = options.cwd ?? process.cwd();
  const runCommand = options.runCommand ?? runLocalCommand;
  const requestedDirectory = path.resolve(cwd, options.directory ?? ".");
  const repositoryPath = shouldResolveRepository(options)
    ? resolveRepositoryRoot(requestedDirectory, runCommand)
    : tryResolveRepositoryRoot(requestedDirectory, runCommand);

  const machineName = options.machineName ?? readConfiguredMachineName(repositoryPath, runCommand);

  if (!machineName) {
    throw new Error(
      `Repository ${requestedDirectory} is not connected to a ugit machine. Run ugit create first or pass -m, --machine.`,
    );
  }

  const config = options.config ?? options.loadConfig?.() ?? loadConfig();

  return {
    machine: resolveMachine(config, machineName),
    repositoryPath,
    source: options.machineName ? "flag" : "git-config",
  };
}

function shouldResolveRepository(options: ResolveConfiguredMachineOptions): boolean {
  if (options.requireRepository) {
    return true;
  }

  return !options.machineName || options.directory !== undefined;
}

function tryResolveRepositoryRoot(targetPath: string, runCommand: CommandRunner): string | null {
  try {
    return resolveRepositoryRoot(targetPath, runCommand);
  } catch {
    return null;
  }
}

function readConfiguredMachineName(
  repositoryPath: string | null,
  runCommand: CommandRunner,
): string | null {
  if (!repositoryPath) {
    return null;
  }

  return readGitConfig(repositoryPath, MACHINE_CONFIG_KEY, runCommand);
}
