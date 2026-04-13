import { describe, expect, it, vi } from "vitest";
import type { ResolvedMachine } from "./config";
import type { CommandRunner } from "./git";
import { queueWorkflowRun, streamWorkflowLogs } from "./workflow";

const machine: ResolvedMachine = {
  name: "local",
  sshMachine: "localhost",
  path: "/srv/ugit",
  serverPort: 3001,
  isLocal: true,
  repositoriesRoot: "/srv/ugit/.data/repos",
};

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
