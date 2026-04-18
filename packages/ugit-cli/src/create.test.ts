import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRepository, type CommandRunner, type CommandRunnerOptions } from "./create";
import type { UgitConfig } from "./config";

const workspaces: string[] = [];

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("createRepository preconditions", () => {
  it("fails when the target directory is not a Git repository root", () => {
    const directory = createWorkspace();

    expect(() =>
      createRepository({
        config: createLocalConfig(createWorkspace()),
        machineName: "local",
        directory,
      }),
    ).toThrow(`Directory ${directory} is not an existing Git repository root.`);
  });

  it("fails when the local repository has no upstream remote", () => {
    const repositoryPath = createGitRepository();

    expect(() =>
      createRepository({
        config: createLocalConfig(createWorkspace()),
        machineName: "local",
        directory: repositoryPath,
      }),
    ).toThrow(
      `Repository ${repositoryPath} requires a local "upstream" remote before ugit create can run.`,
    );
  });

  it("fails before remote setup when origin points somewhere else without replacement approval", () => {
    const repositoryPath = createGitRepository();
    const createDirectory = vi.fn();

    git(repositoryPath, ["remote", "add", "upstream", "https://github.com/example/upstream.git"]);
    git(repositoryPath, ["remote", "add", "origin", "ssh://elsewhere/example.git"]);

    expect(() =>
      createRepository({
        config: createLocalConfig(createWorkspace()),
        machineName: "local",
        directory: repositoryPath,
        createDirectory,
      }),
    ).toThrow(
      `Repository ${repositoryPath} already has an "origin" remote (ssh://elsewhere/example.git). Re-run ugit create with explicit origin replacement approval before pointing it at`,
    );
    expect(createDirectory).not.toHaveBeenCalled();
  });
});

describe("createRepository", () => {
  it("replaces a conflicting local origin when replacement is approved", () => {
    const repositoryPath = createGitRepository();
    const machineRoot = createWorkspace();
    const upstreamUrl = "https://github.com/example/upstream.git";

    git(repositoryPath, ["remote", "add", "upstream", upstreamUrl]);
    git(repositoryPath, ["remote", "add", "origin", "ssh://elsewhere/example.git"]);

    const result = createRepository({
      config: createLocalConfig(machineRoot),
      machineName: "local",
      directory: repositoryPath,
      originConflictResolution: "replace",
    });

    expect(git(repositoryPath, ["remote", "get-url", "origin"])).toBe(result.originUrl);
    expect(existsSync(path.join(result.remoteRepositoryPath, ".git", "HEAD"))).toBe(true);
  });

  it("initializes a local ugit repository and records the selected machine", () => {
    const repositoryPath = createGitRepository();
    const machineRoot = createWorkspace();
    const upstreamUrl = "https://github.com/example/upstream.git";

    git(repositoryPath, ["remote", "add", "upstream", upstreamUrl]);
    writeFileSync(path.join(repositoryPath, "README.md"), "# example\n", "utf8");

    const result = createRepository({
      config: createLocalConfig(machineRoot),
      machineName: "local",
      directory: repositoryPath,
    });

    expect(result).toEqual({
      machineName: "local",
      repositoryName: path.basename(repositoryPath),
      repositoryPath,
      remoteRepositoryPath: path.join(machineRoot, ".data", "repos", path.basename(repositoryPath)),
      originUrl: path.join(machineRoot, ".data", "repos", path.basename(repositoryPath)),
    });
    expect(git(repositoryPath, ["remote", "get-url", "origin"])).toBe(result.originUrl);
    expect(git(repositoryPath, ["config", "--local", "--get", "ugit.machine"])).toBe("local");
    expect(existsSync(path.join(result.remoteRepositoryPath, ".git", "HEAD"))).toBe(true);
    expect(git(result.remoteRepositoryPath, ["remote", "get-url", "upstream"])).toBe(upstreamUrl);
    expect(
      git(result.remoteRepositoryPath, ["config", "--local", "--get", "receive.denyCurrentBranch"]),
    ).toBe("updateInstead");
    expect(readFileSync(path.join(result.remoteRepositoryPath, ".git", "HEAD"), "utf8")).toContain(
      "refs/heads/main",
    );
  });

  it("orchestrates ssh-backed repository setup with mocked child processes", () => {
    const repositoryPath = "/workspace/example-repo";
    const recordedCalls: Array<{
      command: string;
      args: string[];
      cwd?: string;
    }> = [];

    const runCommand: CommandRunner = vi.fn(
      (command: string, args: readonly string[], options: CommandRunnerOptions = {}): string => {
        recordedCalls.push({
          command,
          args: [...args],
          cwd: options.cwd,
        });

        if (
          command === "git" &&
          options.cwd === repositoryPath &&
          args[0] === "rev-parse" &&
          args[1] === "--show-toplevel"
        ) {
          return repositoryPath;
        }

        if (
          command === "git" &&
          options.cwd === repositoryPath &&
          args[0] === "remote" &&
          args[1] === "get-url" &&
          args[2] === "upstream"
        ) {
          return "https://github.com/example/upstream.git";
        }

        if (
          command === "git" &&
          options.cwd === repositoryPath &&
          args[0] === "remote" &&
          args[1] === "get-url" &&
          args[2] === "origin"
        ) {
          throw createExecError("error: No such remote 'origin'\n", 2);
        }

        if (command === "ssh") {
          const remoteCommand = args.at(-1) ?? "";

          if (
            remoteCommand.includes("test") &&
            remoteCommand.includes("/srv/ugit/.data/repos/example-repo")
          ) {
            throw createExecError("", 1);
          }

          return "";
        }

        if (
          command === "git" &&
          options.cwd === repositoryPath &&
          args[0] === "remote" &&
          args[1] === "add" &&
          args[2] === "origin"
        ) {
          return "";
        }

        if (
          command === "git" &&
          options.cwd === repositoryPath &&
          args[0] === "config" &&
          args[1] === "--local" &&
          args[2] === "ugit.machine"
        ) {
          return "";
        }

        throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
      },
    );

    const result = createRepository({
      config: createRemoteConfig("/srv/ugit"),
      machineName: "machine-x",
      directory: repositoryPath,
      cwd: "/",
      runCommand,
      pathExists: () => true,
    });

    expect(result).toEqual({
      machineName: "machine-x",
      repositoryName: "example-repo",
      repositoryPath,
      remoteRepositoryPath: "/srv/ugit/.data/repos/example-repo",
      originUrl: "ssh://kamiya-machine-x/srv/ugit/.data/repos/example-repo",
    });
    expect(
      recordedCalls.some(
        (call) =>
          call.command === "ssh" &&
          (call.args.at(-1) ?? "").includes("init.defaultBranch") &&
          (call.args.at(-1) ?? "").includes("/srv/ugit/.data/repos/example-repo"),
      ),
    ).toBe(true);
    expect(
      recordedCalls.some(
        (call) =>
          call.command === "ssh" &&
          (call.args.at(-1) ?? "").includes("receive.denyCurrentBranch") &&
          (call.args.at(-1) ?? "").includes("updateInstead"),
      ),
    ).toBe(true);
    expect(
      recordedCalls.some(
        (call) =>
          call.command === "ssh" &&
          (call.args.at(-1) ?? "").includes("remote") &&
          (call.args.at(-1) ?? "").includes("upstream") &&
          (call.args.at(-1) ?? "").includes("https://github.com/example/upstream.git"),
      ),
    ).toBe(true);
    expect(recordedCalls).toContainEqual({
      command: "git",
      args: ["remote", "add", "origin", "ssh://kamiya-machine-x/srv/ugit/.data/repos/example-repo"],
      cwd: repositoryPath,
    });
    expect(recordedCalls).toContainEqual({
      command: "git",
      args: ["config", "--local", "ugit.machine", "machine-x"],
      cwd: repositoryPath,
    });
  });

  it("uses git remote set-url when ssh-backed setup replaces a conflicting origin", () => {
    const repositoryPath = "/workspace/example-repo";
    const recordedCalls: Array<{
      command: string;
      args: string[];
      cwd?: string;
    }> = [];

    const runCommand: CommandRunner = vi.fn(
      (command: string, args: readonly string[], options: CommandRunnerOptions = {}): string => {
        recordedCalls.push({
          command,
          args: [...args],
          cwd: options.cwd,
        });

        if (
          command === "git" &&
          options.cwd === repositoryPath &&
          args[0] === "rev-parse" &&
          args[1] === "--show-toplevel"
        ) {
          return repositoryPath;
        }

        if (
          command === "git" &&
          options.cwd === repositoryPath &&
          args[0] === "remote" &&
          args[1] === "get-url" &&
          args[2] === "upstream"
        ) {
          return "https://github.com/example/upstream.git";
        }

        if (
          command === "git" &&
          options.cwd === repositoryPath &&
          args[0] === "remote" &&
          args[1] === "get-url" &&
          args[2] === "origin"
        ) {
          return "ssh://elsewhere/example.git";
        }

        if (command === "ssh") {
          const remoteCommand = args.at(-1) ?? "";

          if (
            remoteCommand.includes("test") &&
            remoteCommand.includes("/srv/ugit/.data/repos/example-repo")
          ) {
            throw createExecError("", 1);
          }

          return "";
        }

        if (
          command === "git" &&
          options.cwd === repositoryPath &&
          args[0] === "remote" &&
          args[1] === "set-url" &&
          args[2] === "origin"
        ) {
          return "";
        }

        if (
          command === "git" &&
          options.cwd === repositoryPath &&
          args[0] === "config" &&
          args[1] === "--local" &&
          args[2] === "ugit.machine"
        ) {
          return "";
        }

        throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
      },
    );

    createRepository({
      config: createRemoteConfig("/srv/ugit"),
      machineName: "machine-x",
      directory: repositoryPath,
      cwd: "/",
      runCommand,
      pathExists: () => true,
      originConflictResolution: "replace",
    });

    expect(recordedCalls).toContainEqual({
      command: "git",
      args: [
        "remote",
        "set-url",
        "origin",
        "ssh://kamiya-machine-x/srv/ugit/.data/repos/example-repo",
      ],
      cwd: repositoryPath,
    });
    expect(
      recordedCalls.find(
        (call) =>
          call.command === "git" &&
          call.cwd === repositoryPath &&
          call.args[0] === "remote" &&
          call.args[1] === "add" &&
          call.args[2] === "origin",
      ),
    ).toBeUndefined();
  });

  it("passes the full ssh setup payload to remote sh -lc as one argument", () => {
    const repositoryPath = createGitRepository();
    const machineRoot = createWorkspace();
    const upstreamUrl = "https://github.com/example/upstream.git";

    git(repositoryPath, ["remote", "add", "upstream", upstreamUrl]);

    const result = createRepository({
      config: createRemoteConfig(machineRoot),
      machineName: "machine-x",
      directory: repositoryPath,
      runCommand: runCommandWithLocalSsh,
    });

    expect(result).toEqual({
      machineName: "machine-x",
      repositoryName: path.basename(repositoryPath),
      repositoryPath,
      remoteRepositoryPath: path.join(machineRoot, ".data", "repos", path.basename(repositoryPath)),
      originUrl: `ssh://kamiya-machine-x${path.join(machineRoot, ".data", "repos", path.basename(repositoryPath))}`,
    });
    expect(git(repositoryPath, ["remote", "get-url", "origin"])).toBe(result.originUrl);
    expect(git(repositoryPath, ["config", "--local", "--get", "ugit.machine"])).toBe("machine-x");
    expect(existsSync(path.join(result.remoteRepositoryPath, ".git", "HEAD"))).toBe(true);
    expect(git(result.remoteRepositoryPath, ["remote", "get-url", "upstream"])).toBe(upstreamUrl);
    expect(
      git(result.remoteRepositoryPath, ["config", "--local", "--get", "receive.denyCurrentBranch"]),
    ).toBe("updateInstead");
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-cli-"));

  workspaces.push(workspace);

  return workspace;
}

function createGitRepository(): string {
  const repositoryPath = createWorkspace();

  git(path.dirname(repositoryPath), [
    "-c",
    "init.defaultBranch=main",
    "init",
    "--quiet",
    repositoryPath,
  ]);

  return repositoryPath;
}

function git(repositoryPath: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: repositoryPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runCommandWithLocalSsh(
  command: string,
  args: readonly string[],
  options: CommandRunnerOptions = {},
): string {
  const execOptions: ExecFileSyncOptions = {
    cwd: options.cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  };

  if (command === "ssh") {
    const remoteCommand = args.slice(1).join(" ");

    return execFileSync("sh", ["-lc", remoteCommand], execOptions).toString().trim();
  }

  return execFileSync(command, [...args], execOptions)
    .toString()
    .trim();
}

function createLocalConfig(machinePath: string): UgitConfig {
  return {
    machines: {
      local: {
        sshMachine: "localhost",
        path: machinePath,
        serverPort: 3001,
      },
    },
  };
}

function createRemoteConfig(machinePath: string): UgitConfig {
  return {
    machines: {
      "machine-x": {
        sshMachine: "kamiya-machine-x",
        path: machinePath,
        serverPort: 3001,
      },
    },
  };
}

function createExecError(stderr: string, status: number): Error {
  const error = new Error("Command failed") as Error & {
    status: number;
    stderr: string;
  };

  error.status = status;
  error.stderr = stderr;

  return error;
}
