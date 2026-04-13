import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../serve", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../serve")>();

  return {
    ...actual,
    serveMachine: vi.fn(),
  };
});

import { createCli } from "../cli";
import { serveMachine } from "../serve";

afterEach(() => {
  vi.mocked(serveMachine).mockReset();
});

describe("ServeCommand", () => {
  it("registers the serve command and delegates to the serve runtime", async () => {
    vi.mocked(serveMachine).mockResolvedValue({
      machineName: "machine-x",
      sshMachine: "kamiya-machine-x",
      localPort: 3001,
      remotePort: 3001,
      url: "http://127.0.0.1:3001",
    });

    const stdout = createRecorder();
    const stderr = createRecorder();
    const exitCode = await createCli().run(["serve", "-m", "machine-x"], {
      colorDepth: 1,
      stderr: stderr.stream as NodeJS.WriteStream,
      stdout: stdout.stream as NodeJS.WriteStream,
    });

    expect(exitCode).toBe(0);
    expect(serveMachine).toHaveBeenCalledWith({
      machineName: "machine-x",
      localPort: undefined,
      stdout: stdout.stream,
    });
    expect(stderr.output).toBe("");
  });

  it("prints actionable runtime failures without a stack trace", async () => {
    vi.mocked(serveMachine).mockRejectedValue(
      new Error('Unknown ugit machine "missing". Add it to your ugit config first.'),
    );

    const stdout = createRecorder();
    const stderr = createRecorder();
    const exitCode = await createCli().run(["serve", "-m", "missing"], {
      colorDepth: 1,
      stderr: stderr.stream as NodeJS.WriteStream,
      stdout: stdout.stream as NodeJS.WriteStream,
    });

    expect(exitCode).toBe(1);
    expect(stderr.output).toBe(
      'Error: Unknown ugit machine "missing". Add it to your ugit config first.\n',
    );
  });

  it("rejects invalid local ports before invoking the runtime", async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();
    const exitCode = await createCli().run(["serve", "-m", "machine-x", "-p", "0"], {
      colorDepth: 1,
      stderr: stderr.stream as NodeJS.WriteStream,
      stdout: stdout.stream as NodeJS.WriteStream,
    });

    expect(exitCode).toBe(1);
    expect(serveMachine).not.toHaveBeenCalled();
    expect(stderr.output).toBe("Error: Local port must be an integer between 1 and 65535.\n");
  });
});

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
