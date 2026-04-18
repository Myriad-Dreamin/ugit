import { PassThrough } from "node:stream";
import { Cli } from "clipanion";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockedCreateRepository, mockedInspectCreateRepositoryOriginConflict } = vi.hoisted(() => ({
  mockedCreateRepository: vi.fn(),
  mockedInspectCreateRepositoryOriginConflict: vi.fn(),
}));

vi.mock("../create", () => ({
  createRepository: mockedCreateRepository,
  inspectCreateRepositoryOriginConflict: mockedInspectCreateRepositoryOriginConflict,
}));

import { createCli } from "../cli";

const createResult = {
  machineName: "machine-x",
  repositoryName: "canonical-repo",
  repositoryPath: "/work/alpha",
  remoteRepositoryPath: "/srv/ugit/.data/repos/canonical-repo",
  originUrl: "ssh://machine-x/srv/ugit/.data/repos/canonical-repo",
};

const originConflict = {
  repositoryPath: "/work/alpha",
  existingOriginUrl: "ssh://elsewhere/alpha.git",
  originUrl: createResult.originUrl,
};

beforeEach(() => {
  mockedCreateRepository.mockReset();
  mockedInspectCreateRepositoryOriginConflict.mockReset();
  mockedCreateRepository.mockReturnValue(createResult);
  mockedInspectCreateRepositoryOriginConflict.mockReturnValue(null);
});

describe("create command", () => {
  it("requires --name before running the create flow", async () => {
    const { exitCode, stdout, stderr } = await runCli(["create", "-m", "machine-x"]);

    expect(exitCode).toBe(1);
    expect(mockedInspectCreateRepositoryOriginConflict).not.toHaveBeenCalled();
    expect(mockedCreateRepository).not.toHaveBeenCalled();
    expect(`${stdout}${stderr}`).toContain("--name");
  });

  it("prompts before replacing a conflicting origin and continues when approved", async () => {
    mockedInspectCreateRepositoryOriginConflict.mockReturnValue(originConflict);

    const { exitCode, stdout, stderr } = await runCli(
      ["create", "-m", "machine-x", "--name", "canonical-repo"],
      {
        interactive: true,
        stdinText: "yes\n",
      },
    );

    expect(exitCode).toBe(0);
    expect(mockedInspectCreateRepositoryOriginConflict).toHaveBeenCalledWith({
      machineName: "machine-x",
      repositoryName: "canonical-repo",
      directory: undefined,
    });
    expect(mockedCreateRepository).toHaveBeenCalledWith({
      machineName: "machine-x",
      repositoryName: "canonical-repo",
      directory: undefined,
      originConflictResolution: "replace",
    });
    expect(stdout).toContain(`Local "origin" points to ${originConflict.existingOriginUrl}.`);
    expect(stdout).toContain("Created ugit repository canonical-repo on machine machine-x.");
    expect(stderr).toBe("");
  });

  it("aborts cleanly when the user declines origin replacement", async () => {
    mockedInspectCreateRepositoryOriginConflict.mockReturnValue(originConflict);

    const { exitCode, stderr } = await runCli(
      ["create", "-m", "machine-x", "--name", "canonical-repo"],
      {
        interactive: true,
        stdinText: "n\n",
      },
    );

    expect(exitCode).toBe(1);
    expect(mockedCreateRepository).not.toHaveBeenCalled();
    expect(stderr).toContain(
      `Aborted ugit create. Kept local "origin" at ${originConflict.existingOriginUrl}.`,
    );
  });

  it("skips prompting when --override-origin is provided", async () => {
    mockedInspectCreateRepositoryOriginConflict.mockReturnValue(originConflict);

    const { exitCode, stdout, stderr } = await runCli([
      "create",
      "-m",
      "machine-x",
      "--name",
      "canonical-repo",
      "--override-origin",
    ]);

    expect(exitCode).toBe(0);
    expect(mockedCreateRepository).toHaveBeenCalledWith({
      machineName: "machine-x",
      repositoryName: "canonical-repo",
      directory: undefined,
      originConflictResolution: "replace",
    });
    expect(stdout).not.toContain(`Local "origin" points to ${originConflict.existingOriginUrl}.`);
    expect(stderr).toBe("");
  });

  it("fails with guidance when non-interactive runs omit --override-origin", async () => {
    mockedInspectCreateRepositoryOriginConflict.mockReturnValue(originConflict);

    const { exitCode, stderr } = await runCli([
      "create",
      "-m",
      "machine-x",
      "--name",
      "canonical-repo",
    ]);

    expect(exitCode).toBe(1);
    expect(mockedCreateRepository).not.toHaveBeenCalled();
    expect(stderr).toContain(
      `Repository ${originConflict.repositoryPath} already has an "origin" remote (${originConflict.existingOriginUrl}).`,
    );
    expect(stderr).toContain("--override-origin");
  });

  it("documents the required name and override flag in create help output", async () => {
    const { exitCode, stdout } = await runCli(["create", "--help"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("--name");
    expect(stdout).toContain("canonical-repo");
    expect(stdout).toContain("--override-origin");
    expect(stdout).toContain("Required in non-interactive runs.");
  });
});

async function runCli(
  argv: string[],
  options: {
    interactive?: boolean;
    stdinText?: string;
  } = {},
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  let stdoutText = "";
  let stderrText = "";

  stdout.on("data", (chunk) => {
    stdoutText += chunk.toString();
  });
  stderr.on("data", (chunk) => {
    stderrText += chunk.toString();
  });

  if (options.interactive) {
    Object.assign(stdin, { isTTY: true });
    Object.assign(stdout, { isTTY: true });
  }

  stdin.end(options.stdinText ?? "");

  const exitCode = await createCli().run(argv, {
    ...Cli.defaultContext,
    stdin,
    stdout,
    stderr,
  });

  return {
    exitCode,
    stdout: stdoutText,
    stderr: stderrText,
  };
}
