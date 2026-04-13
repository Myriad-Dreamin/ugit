import { describe, expect, it, vi } from "vitest";
import { createPullRequest, editPullRequest, formatPullRequestTable, listPullRequests } from "./pr";
import type { CommandRunner } from "./git";
import type { ResolvedMachine } from "./config";

const machine: ResolvedMachine = {
  name: "local",
  sshMachine: "localhost",
  path: "/srv/ugit",
  serverPort: 3001,
  isLocal: true,
  repositoriesRoot: "/srv/ugit/.data/repos",
};

describe("listPullRequests", () => {
  it("queries the repository-scoped pull-request API with filters", async () => {
    const runCommand = createRunCommandStub({
      "git remote get-url origin": "/srv/ugit/.data/repos/alpha",
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          repositoryName: "alpha",
          pullRequests: [],
        }),
      ),
    );

    await expect(
      listPullRequests({
        machine,
        repositoryPath: "/work/alpha",
        state: "merged",
        baseBranch: "release",
        headBranch: "feature/test",
        runCommand,
        fetchImpl,
      }),
    ).resolves.toEqual({
      repositoryName: "alpha",
      pullRequests: [],
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/pull-requests?repositoryPath=%2Fsrv%2Fugit%2F.data%2Frepos%2Falpha&state=merged&baseBranch=release&headBranch=feature%2Ftest",
      {
        method: "GET",
      },
    );
  });
});

describe("createPullRequest", () => {
  it("rejects duplicate pull requests before pushing", async () => {
    const runCommand = createRunCommandStub({
      "git rev-parse --abbrev-ref HEAD": "feature/test",
      "git remote get-url origin": "/srv/ugit/.data/repos/alpha",
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          repositoryName: "alpha",
          pullRequests: [
            {
              id: 7,
              repositoryName: "alpha",
              repositoryPath: "/srv/ugit/.data/repos/alpha",
              branchName: "feature/test",
              baseBranch: "main",
              title: "Existing",
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
        }),
      ),
    );

    await expect(
      createPullRequest({
        machine,
        repositoryPath: "/work/alpha",
        baseBranch: "main",
        title: "Add the runner",
        body: "",
        runCommand,
        fetchImpl,
      }),
    ).rejects.toThrow(
      'Pull request #7 already exists for alpha:feature/test. Use "ugit pr edit" to update metadata or "ugit pr sync" after new commits.',
    );
    expect(runCommand).not.toHaveBeenCalledWith("git", ["push", "origin", "HEAD:feature/test"], {
      cwd: "/work/alpha",
    });
  });
});

describe("editPullRequest", () => {
  it("updates metadata without pushing the branch again", async () => {
    const runCommand = createRunCommandStub({
      "git rev-parse --abbrev-ref HEAD": "feature/test",
      "git remote get-url origin": "/srv/ugit/.data/repos/alpha",
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          pullRequest: {
            id: 7,
            repositoryName: "alpha",
            repositoryPath: "/srv/ugit/.data/repos/alpha",
            branchName: "feature/test",
            baseBranch: "main",
            title: "Retitle the pull request",
            body: "",
            draft: true,
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
        }),
      ),
    );

    await expect(
      editPullRequest({
        machine,
        repositoryPath: "/work/alpha",
        title: "Retitle the pull request",
        body: "",
        draft: true,
        runCommand,
        fetchImpl,
      }),
    ).resolves.toEqual({
      pullRequest: {
        id: 7,
        repositoryName: "alpha",
        repositoryPath: "/srv/ugit/.data/repos/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        title: "Retitle the pull request",
        body: "",
        draft: true,
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
    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:3001/api/pull-requests", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        repositoryPath: "/srv/ugit/.data/repos/alpha",
        branchName: "feature/test",
        title: "Retitle the pull request",
        body: "",
        baseBranch: undefined,
        draft: true,
      }),
    });
    expect(runCommand).not.toHaveBeenCalledWith("git", ["push", "origin", "HEAD:feature/test"], {
      cwd: "/work/alpha",
    });
  });
});

describe("formatPullRequestTable", () => {
  it("renders a human-readable pull-request table", () => {
    expect(
      formatPullRequestTable([
        {
          id: 7,
          repositoryName: "alpha",
          repositoryPath: "/srv/ugit/.data/repos/alpha",
          branchName: "feature/test",
          baseBranch: "main",
          title: "Add the runner",
          body: "",
          draft: true,
          status: "queued",
          state: "open",
          latestCommitHash: "abcdef1",
          latestJob: {
            id: "job-1",
            status: "queued",
            resultPath: null,
            errorMessage: null,
            mergeStatus: null,
            createdAt: "2026-04-14T00:00:00.000Z",
            updatedAt: "2026-04-14T00:00:00.000Z",
            startedAt: null,
            finishedAt: null,
          },
          createdAt: "2026-04-14T00:00:00.000Z",
          updatedAt: "2026-04-14T00:00:00.000Z",
        },
      ]),
    ).toContain("[draft] Add the runner");
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
