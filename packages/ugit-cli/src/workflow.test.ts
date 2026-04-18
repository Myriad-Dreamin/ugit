import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedMachine } from "./config";
import type { CommandRunner } from "./git";
import { queueWorkflowRun, runLocalWorkflow, streamWorkflowLogs } from "./workflow";

const machine: ResolvedMachine = {
  name: "local",
  sshMachine: "localhost",
  path: "/srv/ugit",
  serverPort: 3001,
  isLocal: true,
  repositoriesRoot: "/srv/ugit/.data/repos",
};

const workspaces: string[] = [];

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("queueWorkflowRun", () => {
  it("pushes the current branch and posts the workflow-run request", async () => {
    const runCommand = createRunCommandStub({
      "git rev-parse --abbrev-ref HEAD": "feature/test",
      "git rev-parse HEAD": "abcdef1",
      "git remote get-url origin": "/srv/ugit/.data/repos/alpha",
      "git push origin HEAD:feature/test": "",
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          workflowId: "workflow-1",
          workflowName: "lint",
          status: "queued",
          queuePosition: 1,
          repositoryName: "alpha",
          branchName: "feature/test",
          commitHash: "abcdef1",
        }),
      ),
    );

    await expect(
      queueWorkflowRun({
        machine,
        repositoryPath: "/work/alpha",
        workflowName: "lint",
        runCommand,
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      payload: {
        workflowName: "lint",
        publishedBranch: {
          repositoryPath: "/srv/ugit/.data/repos/alpha",
          branchName: "feature/test",
          commitHash: "abcdef1",
        },
      },
      response: {
        workflowId: "workflow-1",
        queuePosition: 1,
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:3001/api/workflows/runs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: expect.any(String),
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      publishedBranch: {
        repositoryPath: "/srv/ugit/.data/repos/alpha",
        branchName: "feature/test",
        commitHash: "abcdef1",
        remoteName: "origin",
        pushedAt: expect.any(String),
      },
      workflowName: "lint",
    });
  });
});

describe("runLocalWorkflow", () => {
  it("runs install then ugit:ci in the foreground for the requested workflow", async () => {
    const { repositoryPath, workflowPath } = createWorkflowWorkspace("lint");
    const stdout = createWriter();
    const installChild = new MockForegroundChild();
    const runChild = new MockForegroundChild();
    const spawnCommand = vi.fn().mockReturnValueOnce(installChild).mockReturnValueOnce(runChild);

    const execution = runLocalWorkflow({
      repositoryPath,
      workflowName: "lint",
      spawnCommand,
      stdout,
      signalTarget: new EventEmitter(),
    });

    installChild.emitClose(0, null);
    await vi.waitFor(() => {
      expect(spawnCommand).toHaveBeenCalledTimes(2);
    });
    runChild.emitClose(0, null);

    await expect(execution).resolves.toBe(0);
    expect(spawnCommand).toHaveBeenNthCalledWith(
      1,
      "pnpm",
      ["install", "--dir", workflowPath, "--ignore-workspace", "--no-frozen-lockfile"],
      {
        cwd: repositoryPath,
        stdio: "inherit",
      },
    );
    expect(spawnCommand).toHaveBeenNthCalledWith(
      2,
      "pnpm",
      ["--dir", workflowPath, "run", "ugit:ci"],
      {
        cwd: repositoryPath,
        stdio: "inherit",
      },
    );
    expect(stdout.output).toContain(`==> lint: install`);
    expect(stdout.output).toContain(`pnpm --dir ${workflowPath} run ugit:ci`);
  });

  it("forwards terminal signals to the active child and returns a signal exit code", async () => {
    const { repositoryPath } = createWorkflowWorkspace("lint");
    const signalTarget = new EventEmitter();
    const installChild = new MockForegroundChild();
    const spawnCommand = vi.fn().mockReturnValue(installChild);

    const execution = runLocalWorkflow({
      repositoryPath,
      workflowName: "lint",
      spawnCommand,
      stdout: createWriter(),
      signalTarget,
    });

    signalTarget.emit("SIGTERM");
    installChild.emitClose(null, "SIGTERM");

    await expect(execution).resolves.toBe(143);
    expect(installChild.kill).toHaveBeenCalledWith("SIGTERM");
    expect(signalTarget.listenerCount("SIGINT")).toBe(0);
    expect(signalTarget.listenerCount("SIGTERM")).toBe(0);
    expect(signalTarget.listenerCount("SIGHUP")).toBe(0);
  });

  it("fails before spawning when the requested workflow package is missing", async () => {
    const repositoryPath = createWorkspace();
    const spawnCommand = vi.fn();

    await expect(
      runLocalWorkflow({
        repositoryPath,
        workflowName: "lint",
        spawnCommand,
        stdout: createWriter(),
        signalTarget: new EventEmitter(),
      }),
    ).rejects.toThrow("Workflow lint was not found under .ugit/workflows.");
    expect(spawnCommand).not.toHaveBeenCalled();
  });
});

describe("streamWorkflowLogs", () => {
  it("streams log output from the workflow-log API", async () => {
    let output = "";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("queued\nrunning\nsucceeded\n"));

    await streamWorkflowLogs({
      machine,
      workflowId: "workflow-1",
      fetchImpl,
      writer: {
        write(chunk) {
          output += String(chunk);
          return true;
        },
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/workflows/logs?workflowId=workflow-1",
      {
        method: "GET",
      },
    );
    expect(output).toBe("queued\nrunning\nsucceeded\n");
  });
});

function createRunCommandStub(
  responses: Readonly<Record<string, string>>,
): ReturnType<typeof vi.fn<CommandRunner>> {
  return vi.fn<CommandRunner>((command, args) => {
    const key = `${command} ${args.join(" ")}`;
    const response = responses[key];

    if (response === undefined) {
      throw new Error(`Unexpected command: ${key}`);
    }

    return response;
  });
}

function createWorkflowWorkspace(workflowName: string): {
  repositoryPath: string;
  workflowPath: string;
} {
  const repositoryPath = createWorkspace();
  const workflowPath = path.join(repositoryPath, ".ugit", "workflows", workflowName);

  mkdirSync(workflowPath, { recursive: true });
  writeFileSync(
    path.join(workflowPath, "package.json"),
    JSON.stringify({
      name: workflowName,
      scripts: {
        "ugit:ci": 'node -e "process.exit(0)"',
      },
    }),
    "utf8",
  );

  return {
    repositoryPath,
    workflowPath,
  };
}

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-cli-workflow-"));

  workspaces.push(workspace);

  return workspace;
}

function createWriter(): {
  output: string;
  write(chunk: string): boolean;
} {
  let output = "";

  return {
    get output() {
      return output;
    },
    write(chunk: string) {
      output += chunk;
      return true;
    },
  };
}

class MockForegroundChild extends EventEmitter {
  kill = vi.fn(() => true);

  emitClose(code: number | null, signal: NodeJS.Signals | null): void {
    this.emit("close", code, signal);
  }
}
