import path from "node:path";
import { PassThrough } from "node:stream";
import { Cli } from "clipanion";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockedResolveConfiguredMachine } = vi.hoisted(() => ({
  mockedResolveConfiguredMachine: vi.fn(),
}));

const { mockedResolveRepositoryRoot } = vi.hoisted(() => ({
  mockedResolveRepositoryRoot: vi.fn(),
}));

const { mockedQueueWorkflowRun, mockedRunLocalWorkflow, mockedStreamWorkflowLogs } = vi.hoisted(
  () => ({
    mockedQueueWorkflowRun: vi.fn(),
    mockedRunLocalWorkflow: vi.fn(),
    mockedStreamWorkflowLogs: vi.fn(),
  }),
);

vi.mock("../machine", () => ({
  resolveConfiguredMachine: mockedResolveConfiguredMachine,
}));

vi.mock("../git", () => ({
  resolveRepositoryRoot: mockedResolveRepositoryRoot,
  runLocalCommand: vi.fn(),
}));

vi.mock("../workflow", () => ({
  queueWorkflowRun: mockedQueueWorkflowRun,
  runLocalWorkflow: mockedRunLocalWorkflow,
  streamWorkflowLogs: mockedStreamWorkflowLogs,
}));

import { createCli } from "../cli";

const machine = {
  name: "machine-x",
  sshMachine: "machine-x",
  path: "/srv/ugit",
  serverPort: 3001,
  isLocal: false,
  repositoriesRoot: "/srv/ugit/.data/repos",
};

beforeEach(() => {
  mockedResolveConfiguredMachine.mockReset();
  mockedResolveRepositoryRoot.mockReset();
  mockedQueueWorkflowRun.mockReset();
  mockedRunLocalWorkflow.mockReset();
  mockedStreamWorkflowLogs.mockReset();
  mockedResolveConfiguredMachine.mockReturnValue({
    machine,
    repositoryPath: "/work/alpha",
    source: "git-config",
  });
  mockedResolveRepositoryRoot.mockReturnValue("/work/alpha");
  mockedRunLocalWorkflow.mockResolvedValue(0);
});

describe("workflow commands", () => {
  it("parses workflow run options and reports the queued workflow id", async () => {
    mockedQueueWorkflowRun.mockResolvedValue({
      response: {
        workflowId: "workflow-1",
        workflowName: "lint",
        status: "queued",
        queuePosition: 2,
        repositoryName: "alpha",
        branchName: "feature/test",
        commitHash: "abcdef1",
      },
    });

    const { exitCode, stdout } = await runCli(["workflow", "run", "--port", "4301", "lint", "."]);

    expect(exitCode).toBe(0);
    expect(mockedQueueWorkflowRun).toHaveBeenCalledWith({
      machine,
      repositoryPath: "/work/alpha",
      workflowName: "lint",
      localPort: 4301,
    });
    expect(stdout).toContain("Queued workflow workflow-1");
    expect(stdout).toContain("queue position 2");
  });

  it("parses --local workflow runs without resolving a machine", async () => {
    const { exitCode, stdout } = await runCli(["workflow", "run", "--local", "lint", "."]);

    expect(exitCode).toBe(0);
    expect(mockedResolveConfiguredMachine).not.toHaveBeenCalled();
    expect(mockedQueueWorkflowRun).not.toHaveBeenCalled();
    expect(mockedResolveRepositoryRoot).toHaveBeenCalledWith(
      path.resolve("."),
      expect.any(Function),
    );
    expect(mockedRunLocalWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        repositoryPath: "/work/alpha",
        workflowName: "lint",
      }),
    );
    expect(stdout).not.toContain("Queued workflow");
  });

  it("rejects remote-only flags when --local is provided", async () => {
    const { exitCode, stderr } = await runCli([
      "workflow",
      "run",
      "--local",
      "--machine",
      "machine-x",
      "lint",
    ]);

    expect(exitCode).toBe(1);
    expect(mockedResolveConfiguredMachine).not.toHaveBeenCalled();
    expect(mockedResolveRepositoryRoot).not.toHaveBeenCalled();
    expect(mockedRunLocalWorkflow).not.toHaveBeenCalled();
    expect(mockedQueueWorkflowRun).not.toHaveBeenCalled();
    expect(stderr).toContain("--machine");
    expect(stderr).toContain("--port");
  });

  it("parses workflow logs options and streams output", async () => {
    const { exitCode } = await runCli([
      "workflow",
      "logs",
      "-m",
      "machine-x",
      "--port",
      "4301",
      "workflow-1",
    ]);

    expect(exitCode).toBe(0);
    expect(mockedStreamWorkflowLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        machine,
        workflowId: "workflow-1",
        localPort: 4301,
      }),
    );
  });

  it("documents the local workflow mode in help output", async () => {
    const { exitCode, stdout } = await runCli(["workflow", "run", "--help"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("--local");
    expect(stdout).toContain("workflow logs");
    expect(stdout).toContain("current working tree");
  });
});

async function runCli(argv: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let stdoutText = "";
  let stderrText = "";

  stdout.on("data", (chunk) => {
    stdoutText += chunk.toString();
  });
  stderr.on("data", (chunk) => {
    stderrText += chunk.toString();
  });

  const exitCode = await createCli().run(argv, {
    ...Cli.defaultContext,
    stdout,
    stderr,
  });

  return {
    exitCode,
    stdout: stdoutText,
    stderr: stderrText,
  };
}
