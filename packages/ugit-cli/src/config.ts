import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const LOCAL_MACHINE_NAMES = new Set(["local", "localhost"]);
const CONFIG_RELATIVE_PATH = path.join(".local", "share", "ugit", "config.json");

type ConfigRecord = Record<string, unknown>;
type ReadConfigFile = (path: string, encoding: BufferEncoding) => string;

export type UgitMachineConfig = Readonly<{
  sshMachine: string;
  path: string;
  serverPort: number;
}>;

export type UgitConfig = Readonly<{
  machines: Readonly<Record<string, UgitMachineConfig>>;
}>;

export type ResolvedMachine = Readonly<{
  name: string;
  sshMachine: string;
  path: string;
  serverPort: number;
  isLocal: boolean;
  repositoriesRoot: string;
}>;

type LoadConfigOptions = Readonly<{
  configPath?: string;
  homeDirectory?: string;
  readFile?: ReadConfigFile;
}>;

export function getDefaultConfigPath(homeDirectory: string = os.homedir()): string {
  return path.join(homeDirectory, CONFIG_RELATIVE_PATH);
}

export function loadConfig(options: LoadConfigOptions = {}): UgitConfig {
  const configPath = options.configPath ?? getDefaultConfigPath(options.homeDirectory);
  const readFile = options.readFile ?? readFileSync;
  let rawConfig: string;

  try {
    rawConfig = readFile(configPath, "utf8");
  } catch (error) {
    throw new Error(`Failed to read ugit config at ${configPath}.`, { cause: error });
  }

  let parsedConfig: unknown;

  try {
    parsedConfig = JSON.parse(rawConfig);
  } catch (error) {
    throw new Error(`Failed to parse ugit config JSON at ${configPath}.`, { cause: error });
  }

  return normalizeConfig(parsedConfig, configPath);
}

export function resolveMachine(config: UgitConfig, machineName: string): ResolvedMachine {
  const machine = config.machines[machineName];

  if (!machine) {
    throw new Error(`Unknown ugit machine "${machineName}". Add it to your ugit config first.`);
  }

  if (!path.isAbsolute(machine.path)) {
    throw new Error(
      `Configured path for machine "${machineName}" must be absolute. Received "${machine.path}".`,
    );
  }

  const normalizedPath = path.normalize(machine.path);

  return {
    name: machineName,
    sshMachine: machine.sshMachine,
    path: normalizedPath,
    serverPort: machine.serverPort,
    isLocal: isLocalMachineName(machineName) || isLocalMachineName(machine.sshMachine),
    repositoriesRoot: path.join(normalizedPath, ".data", "repos"),
  };
}

export function getRemoteRepositoryPath(machine: ResolvedMachine, repositoryName: string): string {
  return path.join(machine.repositoriesRoot, repositoryName);
}

export function getRemoteRepositoryUrl(machine: ResolvedMachine, repositoryName: string): string {
  const repositoryPath = getRemoteRepositoryPath(machine, repositoryName);

  if (machine.isLocal) {
    return repositoryPath;
  }

  const repositoryUrl = new URL(`ssh://${machine.sshMachine}`);

  repositoryUrl.pathname = repositoryPath;

  return repositoryUrl.toString();
}

export function isLocalMachineName(value: string): boolean {
  return LOCAL_MACHINE_NAMES.has(value);
}

function normalizeConfig(config: unknown, configPath: string): UgitConfig {
  const configRecord = asConfigRecord(config, `Config at ${configPath}`);
  const machines = asConfigRecord(configRecord.machines, `Config "machines" at ${configPath}`);
  const normalizedMachines = Object.fromEntries(
    Object.entries(machines).map(([machineName, machineConfig]) => [
      machineName,
      normalizeMachineConfig(machineName, machineConfig, configPath),
    ]),
  );

  return {
    machines: normalizedMachines,
  };
}

function normalizeMachineConfig(
  machineName: string,
  machineConfig: unknown,
  configPath: string,
): UgitMachineConfig {
  const configRecord = asConfigRecord(machineConfig, `Machine "${machineName}" in ${configPath}`);
  const sshMachine = readString(
    configRecord["ssh-machine"],
    `Machine "${machineName}" field "ssh-machine" in ${configPath}`,
  );
  const machinePath = readString(configRecord.path, `Machine "${machineName}" field "path"`);
  const serverPort = readServerPort(
    configRecord.serverPort,
    `Machine "${machineName}" field "serverPort" in ${configPath}`,
  );

  return {
    sshMachine,
    path: machinePath,
    serverPort,
  };
}

function asConfigRecord(value: unknown, label: string): ConfigRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return value as ConfigRecord;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function readServerPort(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return Number(value);
}
