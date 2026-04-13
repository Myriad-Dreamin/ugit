import { describe, expect, it } from "vitest";
import { buildMachineServerUrl, buildSshPortForwardArgs } from "./transport";
import type { ResolvedMachine } from "./config";

describe("buildSshPortForwardArgs", () => {
  it("builds the SSH local port-forward arguments for remote machines", () => {
    const machine: ResolvedMachine = {
      name: "machine-x",
      sshMachine: "kamiya-machine-x",
      path: "/srv/ugit",
      serverPort: 3001,
      isLocal: false,
      repositoriesRoot: "/srv/ugit/.data/repos",
    };

    expect(buildSshPortForwardArgs(machine, 3301)).toEqual([
      "-N",
      "-T",
      "-o",
      "ExitOnForwardFailure=yes",
      "-L",
      "3301:127.0.0.1:3001",
      "kamiya-machine-x",
    ]);
    expect(buildMachineServerUrl(3301)).toBe("http://127.0.0.1:3301");
  });

  it("short-circuits for local machines", () => {
    const machine: ResolvedMachine = {
      name: "local",
      sshMachine: "localhost",
      path: "/srv/ugit",
      serverPort: 3001,
      isLocal: true,
      repositoriesRoot: "/srv/ugit/.data/repos",
    };

    expect(buildSshPortForwardArgs(machine, 3001)).toEqual([]);
  });
});
