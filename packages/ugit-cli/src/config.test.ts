import { describe, expect, it } from "vitest";
import {
  getDefaultConfigPath,
  getRemoteRepositoryPath,
  getRemoteRepositoryUrl,
  loadConfig,
  resolveMachine,
  type UgitConfig,
} from "./config";

describe("loadConfig", () => {
  it("reads and normalizes machine entries from config.json", () => {
    const config = loadConfig({
      homeDirectory: "/home/example",
      readFile: () =>
        JSON.stringify({
          machines: {
            local: {
              "ssh-machine": "localhost",
              path: "/srv/ugit",
              serverPort: 3001,
            },
            "machine-x": {
              "ssh-machine": "kamiya-machine-x",
              path: "/srv/ugit",
              serverPort: 3010,
            },
          },
        }),
    });

    expect(getDefaultConfigPath("/home/example")).toBe(
      "/home/example/.local/share/ugit/config.json",
    );
    expect(config).toEqual({
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
    });
  });

  it("rejects invalid machine definitions", () => {
    expect(() =>
      loadConfig({
        configPath: "/tmp/ugit-config.json",
        readFile: () =>
          JSON.stringify({
            machines: {
              broken: {
                "ssh-machine": "",
                path: "/srv/ugit",
                serverPort: 3001,
              },
            },
          }),
      }),
    ).toThrow(
      'Machine "broken" field "ssh-machine" in /tmp/ugit-config.json must be a non-empty string.',
    );
  });
});

describe("resolveMachine", () => {
  it("treats local and localhost targets as filesystem-backed machines", () => {
    const config: UgitConfig = {
      machines: {
        local: {
          sshMachine: "localhost",
          path: "/srv/ugit",
          serverPort: 3001,
        },
        "machine-x": {
          sshMachine: "kamiya-machine-x",
          path: "/srv/ugit",
          serverPort: 3001,
        },
      },
    };
    const localMachine = resolveMachine(config, "local");
    const remoteMachine = resolveMachine(config, "machine-x");

    expect(localMachine.isLocal).toBe(true);
    expect(getRemoteRepositoryPath(localMachine, "alpha")).toBe("/srv/ugit/.data/repos/alpha");
    expect(getRemoteRepositoryUrl(localMachine, "alpha")).toBe("/srv/ugit/.data/repos/alpha");

    expect(remoteMachine.isLocal).toBe(false);
    expect(getRemoteRepositoryPath(remoteMachine, "alpha")).toBe("/srv/ugit/.data/repos/alpha");
    expect(getRemoteRepositoryUrl(remoteMachine, "alpha")).toBe(
      "ssh://kamiya-machine-x/srv/ugit/.data/repos/alpha",
    );
  });

  it("requires absolute machine paths", () => {
    const config: UgitConfig = {
      machines: {
        "machine-x": {
          sshMachine: "kamiya-machine-x",
          path: "relative/path",
          serverPort: 3001,
        },
      },
    };

    expect(() => resolveMachine(config, "machine-x")).toThrow(
      'Configured path for machine "machine-x" must be absolute. Received "relative/path".',
    );
  });
});
