import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import path from "node:path";

export type CommandRunnerOptions = Readonly<{
  cwd?: string;
}>;

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options?: CommandRunnerOptions,
) => string;

export function runLocalCommand(
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

export function runGit(
  repositoryPath: string,
  args: readonly string[],
  runCommand: CommandRunner,
): string {
  return runCommand("git", args, { cwd: repositoryPath });
}

export function resolveRepositoryRoot(targetPath: string, runCommand: CommandRunner): string {
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
      `Directory ${targetPath} is inside repository ${normalizedRepositoryRoot}. Run ugit from the repository root or pass the repository root directory explicitly.`,
    );
  }

  return normalizedRepositoryRoot;
}

export function readRequiredRemoteUrl(
  repositoryPath: string,
  remoteName: string,
  runCommand: CommandRunner,
): string {
  const remoteUrl = readOptionalRemoteUrl(repositoryPath, remoteName, runCommand);

  if (!remoteUrl) {
    throw new Error(
      `Repository ${repositoryPath} requires a local "${remoteName}" remote before this ugit command can run.`,
    );
  }

  return remoteUrl;
}

export function readOptionalRemoteUrl(
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

export function readGitConfig(
  repositoryPath: string,
  configKey: string,
  runCommand: CommandRunner,
): string | null {
  try {
    return runGit(repositoryPath, ["config", "--local", "--get", configKey], runCommand);
  } catch (error) {
    if (getProcessStatus(error) === 1) {
      return null;
    }

    throw new Error(`Failed to read Git config "${configKey}" in ${repositoryPath}.`, {
      cause: error,
    });
  }
}

export function readCurrentBranch(repositoryPath: string, runCommand: CommandRunner): string {
  const branchName = runGit(repositoryPath, ["rev-parse", "--abbrev-ref", "HEAD"], runCommand);

  if (branchName === "HEAD") {
    throw new Error(
      `Repository ${repositoryPath} is in a detached HEAD state. Check out a branch before using ugit.`,
    );
  }

  return branchName;
}

export function readHeadCommit(repositoryPath: string, runCommand: CommandRunner): string {
  return runGit(repositoryPath, ["rev-parse", "HEAD"], runCommand);
}

export function runRemoteShellCommand(
  sshMachine: string,
  command: string,
  runCommand: CommandRunner,
): string {
  return runCommand("ssh", [sshMachine, "sh", "-lc", shellQuote(command)]);
}

export function buildShellCommand(args: readonly string[]): string {
  return args.map(shellQuote).join(" ");
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

export function getProcessStream(error: unknown, streamName: "stderr" | "stdout"): string {
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

export function getProcessStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const status = (error as { status?: unknown }).status;

  return typeof status === "number" ? status : null;
}
