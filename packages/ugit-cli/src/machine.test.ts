import { describe, expect, it } from "vitest";
import { resolveConfiguredMachine } from "./machine";
import type { UgitConfig } from "./config";
import type { CommandRunner } from "./git";

const CONFIG: UgitConfig = {
  machines: {
    local: {
      sshMachine: "localhost",
      path: "/srv/ugit",
      serverPort: 3001,
    },
    "machine-x": {
      sshMachine: "kamiya-machine-x",
      path: "/srv/ugit",
      serverPort: 3010,
    },
  },
};

describe("resolveConfiguredMachine", () => {
  it("infers the machine from the local Git config when no flag is provided", () => {
    const runCommand: CommandRunner = (command, args, options = {}) => {
      if (
        command === "git" &&
        options.cwd === "/workspace/repo" &&
        args[0] === "rev-parse" &&
        args[1] === "--show-toplevel"
      ) {
        return "/workspace/repo";
      }

      if (
        command === "git" &&
        options.cwd === "/workspace/repo" &&
        args[0] === "config" &&
        args[1] === "--local" &&
        args[2] === "--get" &&
        args[3] === "ugit.machine"
      ) {
        return "machine-x";
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    };

    expect(
      resolveConfiguredMachine({
        config: CONFIG,
        cwd: "/workspace/repo",
        runCommand,
      }),
    ).toEqual({
      machine: {
        name: "machine-x",
        sshMachine: "kamiya-machine-x",
        path: "/srv/ugit",
        serverPort: 3010,
        isLocal: false,
        repositoriesRoot: "/srv/ugit/.data/repos",
      },
      repositoryPath: "/workspace/repo",
      source: "git-config",
    });
  });

  it("allows explicit machine overrides outside a Git repository", () => {
    const runCommand: CommandRunner = () => {
      throw new Error("not a git repository");
    };

    expect(
      resolveConfiguredMachine({
        config: CONFIG,
        cwd: "/workspace/not-a-repo",
        machineName: "local",
        runCommand,
      }),
    ).toEqual({
      machine: {
        name: "local",
        sshMachine: "localhost",
        path: "/srv/ugit",
        serverPort: 3001,
        isLocal: true,
        repositoriesRoot: "/srv/ugit/.data/repos",
      },
      repositoryPath: null,
      source: "flag",
    });
  });
});
