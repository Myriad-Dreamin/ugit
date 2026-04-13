import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UgitConfig } from "./config";
import {
  buildSshPortForwardArgs,
  runSshPortForward,
  serveMachine,
  type ServeMachineResult,
  type SpawnProcess,
} from "./serve";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("serveMachine", () => {
  it("defaults the local port to the machine serverPort and prints the forwarded URL", async () => {
    const stdout = createRecorder();
    const runPortForward = vi.fn().mockResolvedValue(undefined);

    const result = await serveMachine({
      config: createConfig(),
      machineName: "machine-x",
      stdout: stdout.stream,
      runPortForward,
    });

    expect(runPortForward).toHaveBeenCalledWith({
      sshMachine: "kamiya-machine-x",
      localPort: 3001,
      remotePort: 3001,
    });
    expect(stdout.output).toContain("Forwarding http://127.0.0.1:3001");
    const expectedResult: ServeMachineResult = {
      machineName: "machine-x",
      sshMachine: "kamiya-machine-x",
      localPort: 3001,
      remotePort: 3001,
      url: "http://127.0.0.1:3001",
    };

    expect(result).toEqual(expectedResult);
  });

  it("rejects unknown machines from the ugit config", async () => {
    await expect(
      serveMachine({
        config: createConfig(),
        machineName: "missing",
      }),
    ).rejects.toThrow('Unknown ugit machine "missing". Add it to your ugit config first.');
  });

  it("rejects invalid configured server ports", async () => {
    await expect(
      serveMachine({
        config: createConfig(70000),
        machineName: "machine-x",
      }),
    ).rejects.toThrow(
      'Configured serverPort for machine "machine-x" must be an integer between 1 and 65535.',
    );
  });
});

describe("runSshPortForward", () => {
  it("builds the ssh local forwarding arguments", () => {
    expect(
      buildSshPortForwardArgs({
        sshMachine: "kamiya-machine-x",
        localPort: 4301,
        remotePort: 3001,
      }),
    ).toEqual([
      "-N",
      "-o",
      "ExitOnForwardFailure=yes",
      "-L",
      "4301:127.0.0.1:3001",
      "kamiya-machine-x",
    ]);
  });

  it("surfaces ssh forwarding failures with an actionable message", async () => {
    const child = new EventEmitter();
    const spawnProcessMock = vi.fn(() => {
      queueMicrotask(() => {
        child.emit("exit", 255, null);
      });

      return child as unknown as ReturnType<SpawnProcess>;
    });

    await expect(
      runSshPortForward(
        {
          sshMachine: "kamiya-machine-x",
          localPort: 4301,
          remotePort: 3001,
        },
        {
          spawnProcess: spawnProcessMock as unknown as SpawnProcess,
        },
      ),
    ).rejects.toThrow(
      'SSH port forwarding to "kamiya-machine-x" exited with code 255. Verify SSH access and that local port 4301 is available.',
    );

    expect(spawnProcessMock).toHaveBeenCalledWith(
      "ssh",
      ["-N", "-o", "ExitOnForwardFailure=yes", "-L", "4301:127.0.0.1:3001", "kamiya-machine-x"],
      {
        stdio: "inherit",
      },
    );
  });
});

function createConfig(serverPort: number = 3001): UgitConfig {
  return {
    machines: {
      "machine-x": {
        sshMachine: "kamiya-machine-x",
        path: "/srv/ugit",
        serverPort,
      },
    },
  };
}

function createRecorder(): {
  output: string;
  stream: Pick<NodeJS.WriteStream, "write">;
} {
  let output = "";

  return {
    get output() {
      return output;
    },
    stream: {
      write(chunk: string | Uint8Array) {
        output += chunk.toString();

        return true;
      },
    },
  };
}
