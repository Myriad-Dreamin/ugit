import { PassThrough } from "node:stream";
import { Cli } from "clipanion";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockedResolveConfiguredMachine } = vi.hoisted(() => ({
  mockedResolveConfiguredMachine: vi.fn(),
}));

const {
  mockedCreatePullRequest,
  mockedEditPullRequest,
  mockedListPullRequests,
  mockedSynchronizePullRequest,
} = vi.hoisted(() => ({
  mockedCreatePullRequest: vi.fn(),
  mockedEditPullRequest: vi.fn(),
  mockedListPullRequests: vi.fn(),
  mockedSynchronizePullRequest: vi.fn(),
}));

vi.mock("../machine", () => ({
  resolveConfiguredMachine: mockedResolveConfiguredMachine,
}));

vi.mock("../pr", () => ({
  createPullRequest: mockedCreatePullRequest,
  editPullRequest: mockedEditPullRequest,
  formatPullRequestTable: vi.fn(
    () =>
      "ID  State  CI      Base  Head          Title\n7   open   queued  main  feature/test  Add the runner",
  ),
  listPullRequests: mockedListPullRequests,
  synchronizePullRequest: mockedSynchronizePullRequest,
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
  mockedCreatePullRequest.mockReset();
  mockedEditPullRequest.mockReset();
  mockedListPullRequests.mockReset();
  mockedSynchronizePullRequest.mockReset();
  mockedResolveConfiguredMachine.mockReturnValue({
    machine,
    repositoryPath: "/work/alpha",
    source: "git-config",
  });
});

describe("pull-request commands", () => {
  it("parses pr list options and prints the formatted table", async () => {
    mockedListPullRequests.mockResolvedValue({
      repositoryName: "alpha",
      pullRequests: [
        {
          id: 7,
          repositoryName: "alpha",
          repositoryPath: "/srv/ugit/.data/repos/alpha",
          branchName: "feature/test",
          baseBranch: "main",
          title: "Add the runner",
          body: "",
          draft: false,
          status: "queued",
          state: "open",
          latestCommitHash: "abcdef1",
          latestJob: null,
          createdAt: "2026-04-14T00:00:00.000Z",
          updatedAt: "2026-04-14T00:00:00.000Z",
        },
      ],
    });

    const { exitCode, stdout } = await runCli([
      "pr",
      "list",
      "--state",
      "all",
      "--base",
      "main",
      "--head",
      "feature/test",
      ".",
    ]);

    expect(exitCode).toBe(0);
    expect(mockedListPullRequests).toHaveBeenCalledWith({
      machine,
      repositoryPath: "/work/alpha",
      state: "all",
      baseBranch: "main",
      headBranch: "feature/test",
    });
    expect(stdout).toContain("Pull requests for alpha:");
    expect(stdout).toContain("Add the runner");
  });

  it("parses pr create options and reports the created pull request", async () => {
    mockedCreatePullRequest.mockResolvedValue({
      response: {
        pullRequestId: 7,
        jobId: "job-1",
        status: "queued",
        queuePosition: 1,
        repositoryName: "alpha",
        branchName: "feature/test",
        baseBranch: "main",
        latestCommitHash: "abcdef1",
      },
    });

    const { exitCode, stdout } = await runCli([
      "pr",
      "create",
      "--base",
      "main",
      "--title",
      "Add the runner",
      "--body",
      "Initial body",
    ]);

    expect(exitCode).toBe(0);
    expect(mockedCreatePullRequest).toHaveBeenCalledWith({
      machine,
      repositoryPath: "/work/alpha",
      baseBranch: "main",
      title: "Add the runner",
      body: "Initial body",
      draft: false,
    });
    expect(stdout).toContain("Created pull request #7");
  });

  it("parses pr edit flags and reports metadata-only edits", async () => {
    mockedEditPullRequest.mockResolvedValue({
      pullRequest: {
        id: 7,
        repositoryName: "alpha",
        repositoryPath: "/srv/ugit/.data/repos/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        title: "Retitle the pull request",
        body: "",
        draft: false,
        status: "queued",
        state: "open",
        latestCommitHash: "abcdef1",
        latestJob: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:10.000Z",
      },
      rerunQueued: false,
      jobId: null,
      queuePosition: null,
    });

    const { exitCode, stdout } = await runCli([
      "pr",
      "edit",
      "--title",
      "Retitle the pull request",
      "--ready",
      "--body",
      "",
    ]);

    expect(exitCode).toBe(0);
    expect(mockedEditPullRequest).toHaveBeenCalledWith({
      machine,
      repositoryPath: "/work/alpha",
      title: "Retitle the pull request",
      body: "",
      baseBranch: undefined,
      draft: false,
    });
    expect(stdout).toContain("Metadata updated without queuing a new CI job.");
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
