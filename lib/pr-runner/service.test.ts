import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitCommandRunner } from "@/lib/pull-requests/github";

const { mockedEvictManagedWorkflowWorktreeForCommit, mockedNudgePullRequestRunner } = vi.hoisted(
  () => ({
    mockedEvictManagedWorkflowWorktreeForCommit: vi.fn(),
    mockedNudgePullRequestRunner: vi.fn(),
  }),
);

vi.mock("@/lib/pr-runner/worktrees", () => ({
  evictManagedWorkflowWorktreeForCommit: mockedEvictManagedWorkflowWorktreeForCommit,
}));

const mockedEvictManagedWorkflowWorktree = mockedEvictManagedWorkflowWorktreeForCommit;

vi.mock("@/lib/pr-runner/runner", () => ({
  nudgePullRequestRunner: mockedNudgePullRequestRunner,
}));

import {
  editPullRequest,
  getRepositoryPullRequest,
  listPullRequests,
  listRepositoryPullRequests,
  mergeRepositoryPullRequest,
  synchronizePullRequest,
} from "@/lib/pr-runner/service";
import { writeCiResultArtifact } from "@/lib/pr-runner/results";
import { completeCiJob, completePullRequestMerge, readPullRequest } from "@/lib/pr-runner/storage";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
const workspaces: string[] = [];

beforeEach(() => {
  mockedEvictManagedWorkflowWorktree.mockReset();
  mockedEvictManagedWorkflowWorktree.mockResolvedValue(undefined);
  mockedNudgePullRequestRunner.mockReset();
  mockedNudgePullRequestRunner.mockResolvedValue(undefined);
});

afterEach(() => {
  resetStorageCacheForTests();

  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("listPullRequests service", () => {
  it("returns repository-scoped pull-request summaries with latest CI state", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    synchronizePullRequest(createSyncPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    expect(
      listPullRequests(
        {
          repositoryPath,
          state: "all",
        },
        {
          cwd: workspace,
          storage,
        },
      ),
    ).toEqual({
      repositoryName: "alpha",
      pullRequests: [
        expect.objectContaining({
          id: 1,
          repositoryName: "alpha",
          branchName: "feature/test",
          baseBranch: "main",
          state: "open",
          latestJob: expect.objectContaining({
            id: "job-1",
            status: "queued",
          }),
        }),
      ],
    });
  });
});

describe("listRepositoryPullRequests service", () => {
  it("sanitizes CI job errors in browser-safe list responses", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const managedWorktreePath = path.join(repositoryPath, "workflow1");
    const internalErrorMessage = `Managed workflow worktree ${managedWorktreePath} does not belong to ${repositoryPath}.`;

    synchronizePullRequest(createSyncPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-20T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    completeCiJob({
      jobId: "job-1",
      status: "failed",
      resultPath: null,
      errorMessage: internalErrorMessage,
      mergeStatus: "failed",
      now: createNowFactory("2026-04-20T00:00:20.000Z"),
      storage,
    });

    const list = listRepositoryPullRequests(
      {
        repositoryName: "alpha",
      },
      {
        cwd: workspace,
        storage,
      },
    );

    expect(list.pullRequests[0]?.latestJob?.errorMessage).toBe(
      "The CI job failed with an internal error. Check server logs for details.",
    );
    expect(JSON.stringify(list)).not.toContain(workspace);
    expect(JSON.stringify(list)).not.toContain(repositoryPath);
    expect(JSON.stringify(list)).not.toContain(managedWorktreePath);
    expect(JSON.stringify(list)).not.toContain(internalErrorMessage);
  });
});

describe("getRepositoryPullRequest service", () => {
  it("returns repo-owned detail with readiness, CI history, and canonical GitHub delegation", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    synchronizePullRequest(createSyncPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-20T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    const artifactPath = writeCiResultArtifact(
      {
        jobId: "job-1",
        pullRequestId: 1,
        repositoryName: "alpha",
        branchName: "feature/test",
        baseBranch: "main",
        commitHash: "abcdef1",
        status: "succeeded",
        queuedAt: "2026-04-20T00:00:00.000Z",
        startedAt: "2026-04-20T00:00:05.000Z",
        finishedAt: "2026-04-20T00:00:20.000Z",
        errorMessage: null,
        workflows: [
          {
            name: "lint",
            status: "passed",
            installCommand: "pnpm install",
            runCommand: "pnpm lint",
            output: "ok",
          },
        ],
        merge: {
          status: "skipped",
          message: "Manual approval is required before this pull request can merge.",
        },
      },
      {
        cwd: workspace,
      },
    );

    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: artifactPath,
      mergeStatus: "skipped",
      now: createNowFactory("2026-04-20T00:00:20.000Z"),
      storage,
    });

    const detail = await getRepositoryPullRequest(
      {
        repositoryName: "alpha",
        pullRequestId: "1",
      },
      {
        cwd: workspace,
        storage,
        runGit: createRunGitStub({
          [`git -C ${repositoryPath} config --get-regexp ^remote\\..*\\.url$`]:
            "remote.upstream.url https://github.com/acme/alpha.git\n",
        }),
        runCommand: createRunCommandStub({
          [`git -C ${repositoryPath} fetch --quiet upstream main`]: successResult(),
          [`git -C ${repositoryPath} rev-parse --verify FETCH_HEAD`]: successResult("fedcba9\n"),
          [`git -C ${repositoryPath} rev-parse --verify refs/heads/main`]:
            successResult("fedcba9\n"),
        }),
        fetchImpl: createGitHubFetchSequence([
          Response.json([
            {
              number: 7,
              html_url: "https://github.com/acme/alpha/pull/7",
            },
          ]),
          Response.json({
            number: 7,
            html_url: "https://github.com/acme/alpha/pull/7",
            mergeable: true,
            head: {
              ref: "feature/test",
              sha: "abcdef1",
            },
            base: {
              ref: "main",
              sha: "fedcba9",
            },
          }),
        ]),
        githubToken: "token",
      },
    );

    expect(detail.pullRequest).toMatchObject({
      id: 1,
      repositoryName: "alpha",
      status: "passed",
      latestJob: expect.objectContaining({
        id: "job-1",
        status: "succeeded",
      }),
      github: expect.objectContaining({
        state: "pull_request",
        url: "https://github.com/acme/alpha/pull/7",
      }),
      mergeReadiness: expect.objectContaining({
        state: "ready",
        canMerge: true,
      }),
    });
    expect(detail.pullRequest.mergeReadiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "current_ci",
          state: "ready",
        }),
        expect.objectContaining({
          id: "base_parity",
          state: "ready",
        }),
        expect.objectContaining({
          id: "github_mergeability",
          state: "ready",
        }),
      ]),
    );
    expect(detail.pullRequest.ciJobs).toEqual([
      expect.objectContaining({
        id: "job-1",
        workflowResultStatus: "available",
      }),
    ]);
    expect(detail.pullRequest.activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "created",
        }),
        expect.objectContaining({
          type: "ci_finished",
        }),
      ]),
    );
    expect(detail.pullRequest).not.toHaveProperty("repositoryPath");
  });

  it("marks readiness blocked when the canonical GitHub head drifts past the passing CI commit", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const featureCommit = "abcdef1";
    const githubHeadCommit = "github-head-commit";

    synchronizePullRequest(
      createSyncPayload(repositoryPath, {
        commitHash: featureCommit,
        remoteName: "upstream",
      }),
      {
        cwd: workspace,
        storage,
        now: createNowFactory("2026-04-20T01:00:00.000Z"),
        jobIdFactory: createJobIdFactory("job-1"),
      },
    );

    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "skipped",
      now: createNowFactory("2026-04-20T01:00:20.000Z"),
      storage,
    });

    const detail = await getRepositoryPullRequest(
      {
        repositoryName: "alpha",
        pullRequestId: "1",
      },
      {
        cwd: workspace,
        storage,
        runGit: createRunGitStub({
          [`git -C ${repositoryPath} config --get-regexp ^remote\\..*\\.url$`]:
            "remote.upstream.url https://github.com/acme/alpha.git\n",
        }),
        runCommand: createRunCommandStub({
          [`git -C ${repositoryPath} fetch --quiet upstream main`]: successResult(),
          [`git -C ${repositoryPath} rev-parse --verify FETCH_HEAD`]: successResult("fedcba9\n"),
          [`git -C ${repositoryPath} rev-parse --verify refs/heads/main`]:
            successResult("fedcba9\n"),
        }),
        fetchImpl: createGitHubFetchSequence([
          Response.json([
            {
              number: 7,
              html_url: "https://github.com/acme/alpha/pull/7",
            },
          ]),
          Response.json({
            number: 7,
            html_url: "https://github.com/acme/alpha/pull/7",
            mergeable: true,
            head: {
              ref: "feature/test",
              sha: githubHeadCommit,
            },
            base: {
              ref: "main",
              sha: "fedcba9",
            },
          }),
        ]),
        githubToken: "token",
      },
    );

    expect(detail.pullRequest.mergeReadiness).toMatchObject({
      state: "blocked",
      canMerge: false,
      summary: expect.stringContaining(githubHeadCommit),
      blockingReasons: [expect.stringContaining(githubHeadCommit)],
    });
    expect(detail.pullRequest.mergeReadiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "current_ci",
          state: "blocked",
          message: expect.stringContaining(githubHeadCommit),
        }),
        expect.objectContaining({
          id: "base_parity",
          state: "ready",
        }),
        expect.objectContaining({
          id: "github_mergeability",
          state: "ready",
        }),
      ]),
    );
  });

  it("rejects pull requests that belong to a different repository", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    createRepositorySkeleton(workspace, "beta");

    synchronizePullRequest(createSyncPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-20T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    await expect(
      getRepositoryPullRequest(
        {
          repositoryName: "beta",
          pullRequestId: "1",
        },
        {
          cwd: workspace,
          storage,
        },
      ),
    ).rejects.toThrow("No ugit pull request exists for beta:1.");
  });
});

describe("mergeRepositoryPullRequest service", () => {
  it("squash-merges on GitHub, realigns the mirrored base branch, and persists merged state", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const featureCommit = "abcdef1";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json([
          {
            number: 7,
            html_url: "https://github.com/acme/alpha/pull/7",
          },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json({
          number: 7,
          html_url: "https://github.com/acme/alpha/pull/7",
          mergeable: true,
          head: {
            ref: "feature/test",
            sha: featureCommit,
          },
          base: {
            ref: "main",
            sha: "base-commit",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          merged: true,
          message: "Pull Request successfully merged",
          sha: "merged-commit",
        }),
      );

    synchronizePullRequest(
      createSyncPayload(repositoryPath, {
        commitHash: featureCommit,
        remoteName: "upstream",
      }),
      {
        cwd: workspace,
        storage,
        now: createNowFactory("2026-04-21T00:00:00.000Z"),
        jobIdFactory: createJobIdFactory("job-1"),
      },
    );

    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "skipped",
      now: createNowFactory("2026-04-21T00:00:20.000Z"),
      storage,
    });

    const response = await mergeRepositoryPullRequest(
      {
        repositoryName: "alpha",
        pullRequestId: "1",
      },
      {
        cwd: workspace,
        storage,
        runGit: createRunGitStub({
          [`git -C ${repositoryPath} config --get-regexp ^remote\\..*\\.url$`]:
            "remote.upstream.url https://github.com/acme/alpha.git\n",
        }),
        runCommand: createRunCommandStub({
          [`git -C ${repositoryPath} fetch --quiet upstream main`]: [
            successResult(),
            successResult(),
          ],
          [`git -C ${repositoryPath} rev-parse --verify FETCH_HEAD`]: [
            successResult("base-commit\n"),
            successResult("merged-commit\n"),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/heads/main`]: [
            successResult("base-commit\n"),
            successResult("base-commit\n"),
            successResult("base-commit\n"),
          ],
          [`git -C ${repositoryPath} merge-base --is-ancestor refs/heads/main ${featureCommit}`]:
            successResult(),
          [`git -C ${repositoryPath} merge-base --is-ancestor refs/heads/main merged-commit`]:
            successResult(),
          [`git -C ${repositoryPath} symbolic-ref --quiet --short HEAD`]:
            successResult("feature/test\n"),
          [`git -C ${repositoryPath} update-ref refs/heads/main merged-commit base-commit`]:
            successResult(),
        }),
        fetchImpl,
        githubToken: "token",
      },
    );

    expect(response.outcome).toBe("merged");
    expect(response.message).toContain("merged-commit");
    expect(response.pullRequest.status).toBe("merged");
    expect(response.pullRequest.state).toBe("merged");
    expect(response.pullRequest.activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "merged",
        }),
      ]),
    );
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      status: "merged",
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body))).toEqual({
      merge_method: "squash",
      sha: featureCommit,
    });
  });

  it("returns not_ready when GitHub rejects the squash merge because the head changed", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const featureCommit = "abcdef1";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json([
          {
            number: 7,
            html_url: "https://github.com/acme/alpha/pull/7",
          },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json({
          number: 7,
          html_url: "https://github.com/acme/alpha/pull/7",
          mergeable: true,
          head: {
            ref: "feature/test",
            sha: featureCommit,
          },
          base: {
            ref: "main",
            sha: "base-commit",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            message: "Head branch was modified. Review and try the merge again.",
          },
          {
            status: 409,
          },
        ),
      )
      .mockResolvedValueOnce(
        Response.json([
          {
            number: 7,
            html_url: "https://github.com/acme/alpha/pull/7",
          },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json({
          number: 7,
          html_url: "https://github.com/acme/alpha/pull/7",
          mergeable: true,
          head: {
            ref: "feature/test",
            sha: featureCommit,
          },
          base: {
            ref: "main",
            sha: "base-commit",
          },
        }),
      );

    synchronizePullRequest(
      createSyncPayload(repositoryPath, {
        commitHash: featureCommit,
        remoteName: "upstream",
      }),
      {
        cwd: workspace,
        storage,
        now: createNowFactory("2026-04-21T00:30:00.000Z"),
        jobIdFactory: createJobIdFactory("job-1"),
      },
    );

    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "skipped",
      now: createNowFactory("2026-04-21T00:30:20.000Z"),
      storage,
    });

    const response = await mergeRepositoryPullRequest(
      {
        repositoryName: "alpha",
        pullRequestId: "1",
      },
      {
        cwd: workspace,
        storage,
        runGit: createRunGitStub({
          [`git -C ${repositoryPath} config --get-regexp ^remote\\..*\\.url$`]:
            "remote.upstream.url https://github.com/acme/alpha.git\n",
        }),
        runCommand: createRunCommandStub({
          [`git -C ${repositoryPath} fetch --quiet upstream main`]: [
            successResult(),
            successResult(),
          ],
          [`git -C ${repositoryPath} rev-parse --verify FETCH_HEAD`]: [
            successResult("base-commit\n"),
            successResult("base-commit\n"),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/heads/main`]: [
            successResult("base-commit\n"),
            successResult("base-commit\n"),
            successResult("base-commit\n"),
          ],
          [`git -C ${repositoryPath} merge-base --is-ancestor refs/heads/main ${featureCommit}`]:
            successResult(),
        }),
        fetchImpl,
        githubToken: "token",
      },
    );

    expect(response.outcome).toBe("not_ready");
    expect(response.message).toContain("Head branch was modified");
    expect(response.pullRequest.status).toBe("passed");
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      status: "passed",
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body))).toEqual({
      merge_method: "squash",
      sha: featureCommit,
    });
  });

  it("blocks manual approval when the branch must be rebased", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const featureCommit = "abcdef1";
    const newBaseCommit = "fedcba9";

    synchronizePullRequest(
      createSyncPayload(repositoryPath, {
        commitHash: featureCommit,
        remoteName: "upstream",
      }),
      {
        cwd: workspace,
        storage,
        now: createNowFactory("2026-04-21T01:00:00.000Z"),
        jobIdFactory: createJobIdFactory("job-1"),
      },
    );

    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "skipped",
      now: createNowFactory("2026-04-21T01:00:20.000Z"),
      storage,
    });

    const response = await mergeRepositoryPullRequest(
      {
        repositoryName: "alpha",
        pullRequestId: "1",
      },
      {
        cwd: workspace,
        storage,
        runGit: createRunGitStub({
          [`git -C ${repositoryPath} config --get-regexp ^remote\\..*\\.url$`]:
            "remote.upstream.url https://github.com/acme/alpha.git\n",
        }),
        runCommand: createRunCommandStub({
          [`git -C ${repositoryPath} fetch --quiet upstream main`]: [
            successResult(),
            successResult(),
          ],
          [`git -C ${repositoryPath} rev-parse --verify FETCH_HEAD`]: [
            successResult(`${newBaseCommit}\n`),
            successResult(`${newBaseCommit}\n`),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/heads/main`]: [
            successResult(`${newBaseCommit}\n`),
            successResult(`${newBaseCommit}\n`),
            successResult(`${newBaseCommit}\n`),
          ],
          [`git -C ${repositoryPath} merge-base --is-ancestor refs/heads/main ${featureCommit}`]:
            failureResult(),
        }),
        fetchImpl: createGitHubFetchSequence([
          Response.json([
            {
              number: 7,
              html_url: "https://github.com/acme/alpha/pull/7",
            },
          ]),
          Response.json({
            number: 7,
            html_url: "https://github.com/acme/alpha/pull/7",
            mergeable: true,
            head: {
              ref: "feature/test",
              sha: featureCommit,
            },
            base: {
              ref: "main",
              sha: newBaseCommit,
            },
          }),
          Response.json([
            {
              number: 7,
              html_url: "https://github.com/acme/alpha/pull/7",
            },
          ]),
          Response.json({
            number: 7,
            html_url: "https://github.com/acme/alpha/pull/7",
            mergeable: true,
            head: {
              ref: "feature/test",
              sha: featureCommit,
            },
            base: {
              ref: "main",
              sha: newBaseCommit,
            },
          }),
        ]),
        githubToken: "token",
      },
    );

    expect(response.outcome).toBe("rebase_required");
    expect(response.message).toContain("rebase the pull request and rerun CI before merging");
    expect(response.pullRequest.status).toBe("passed");
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      status: "passed",
    });
  });

  it("refuses approval when the canonical GitHub pull request head differs from the passing CI commit", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const featureCommit = "abcdef1";
    const githubHeadCommit = "github-head-commit";
    const githubResponses = [
      Response.json([
        {
          number: 7,
          html_url: "https://github.com/acme/alpha/pull/7",
        },
      ]),
      Response.json({
        number: 7,
        html_url: "https://github.com/acme/alpha/pull/7",
        mergeable: true,
        head: {
          ref: "feature/test",
          sha: githubHeadCommit,
        },
        base: {
          ref: "main",
          sha: "base-commit",
        },
      }),
      Response.json([
        {
          number: 7,
          html_url: "https://github.com/acme/alpha/pull/7",
        },
      ]),
      Response.json({
        number: 7,
        html_url: "https://github.com/acme/alpha/pull/7",
        mergeable: true,
        head: {
          ref: "feature/test",
          sha: githubHeadCommit,
        },
        base: {
          ref: "main",
          sha: "base-commit",
        },
      }),
    ];
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      if ((init?.method ?? "GET") !== "GET") {
        throw new Error("GitHub merge should not run when the canonical head is stale.");
      }

      const response = githubResponses.shift();

      if (!response) {
        throw new Error("Unexpected extra GitHub request.");
      }

      return response;
    });

    synchronizePullRequest(
      createSyncPayload(repositoryPath, {
        commitHash: featureCommit,
        remoteName: "upstream",
      }),
      {
        cwd: workspace,
        storage,
        now: createNowFactory("2026-04-21T02:00:00.000Z"),
        jobIdFactory: createJobIdFactory("job-1"),
      },
    );

    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "skipped",
      now: createNowFactory("2026-04-21T02:00:20.000Z"),
      storage,
    });

    const response = await mergeRepositoryPullRequest(
      {
        repositoryName: "alpha",
        pullRequestId: "1",
      },
      {
        cwd: workspace,
        storage,
        runGit: createRunGitStub({
          [`git -C ${repositoryPath} config --get-regexp ^remote\\..*\\.url$`]:
            "remote.upstream.url https://github.com/acme/alpha.git\n",
        }),
        runCommand: createRunCommandStub({
          [`git -C ${repositoryPath} fetch --quiet upstream main`]: [
            successResult(),
            successResult(),
          ],
          [`git -C ${repositoryPath} rev-parse --verify FETCH_HEAD`]: [
            successResult("base-commit\n"),
            successResult("base-commit\n"),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/heads/main`]: [
            successResult("base-commit\n"),
            successResult("base-commit\n"),
          ],
        }),
        fetchImpl,
        githubToken: "token",
      },
    );

    expect(response.outcome).toBe("not_ready");
    expect(response.message).toContain(githubHeadCommit);
    expect(response.pullRequest.status).toBe("passed");
    expect(response.pullRequest.mergeReadiness).toMatchObject({
      state: "blocked",
      canMerge: false,
      summary: expect.stringContaining(githubHeadCommit),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      status: "passed",
    });
  });
});

describe("synchronizePullRequest service", () => {
  it("rejects syncing a merged pull request without nudging the runner", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    synchronizePullRequest(createSyncPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "skipped",
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
      storage,
    });
    completePullRequestMerge({
      pullRequestId: 1,
      jobId: "job-1",
      now: createNowFactory("2026-04-14T00:00:15.000Z"),
      storage,
    });
    mockedNudgePullRequestRunner.mockClear();

    expect(() =>
      synchronizePullRequest(
        createSyncPayload(repositoryPath, {
          commitHash: "abcdef2",
        }),
        {
          cwd: workspace,
          storage,
          now: createNowFactory("2026-04-14T00:00:20.000Z"),
          jobIdFactory: createJobIdFactory("job-2"),
        },
      ),
    ).toThrow("Merged pull requests cannot be synchronized.");

    expect(mockedNudgePullRequestRunner).not.toHaveBeenCalled();
  });
});

describe("editPullRequest service", () => {
  it("updates metadata without nudging the runner", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    synchronizePullRequest(createSyncPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });
    mockedNudgePullRequestRunner.mockClear();

    expect(
      editPullRequest(
        {
          repositoryPath,
          branchName: "feature/test",
          title: "Retitle the pull request",
          draft: true,
        },
        {
          cwd: workspace,
          storage,
          now: createNowFactory("2026-04-14T00:00:10.000Z"),
        },
      ),
    ).toEqual({
      pullRequest: expect.objectContaining({
        id: 1,
        title: "Retitle the pull request",
        draft: true,
        latestJob: expect.objectContaining({
          id: "job-1",
        }),
      }),
      rerunQueued: false,
      jobId: null,
      queuePosition: null,
    });
    expect(mockedNudgePullRequestRunner).not.toHaveBeenCalled();
  });

  it("queues a rerun when the base branch changes", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    synchronizePullRequest(createSyncPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });
    mockedNudgePullRequestRunner.mockClear();

    expect(
      editPullRequest(
        {
          repositoryPath,
          branchName: "feature/test",
          baseBranch: "release",
        },
        {
          cwd: workspace,
          storage,
          now: createNowFactory("2026-04-14T00:00:10.000Z"),
          jobIdFactory: createJobIdFactory("job-2"),
        },
      ),
    ).toEqual({
      pullRequest: expect.objectContaining({
        id: 1,
        baseBranch: "release",
        latestJob: expect.objectContaining({
          id: "job-2",
          status: "queued",
        }),
      }),
      rerunQueued: true,
      jobId: "job-2",
      queuePosition: 1,
    });
    expect(mockedNudgePullRequestRunner).toHaveBeenCalledWith({
      cwd: workspace,
      storage,
    });
  });

  it("rejects retargeting a merged pull request", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    synchronizePullRequest(createSyncPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "skipped",
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
      storage,
    });
    completePullRequestMerge({
      pullRequestId: 1,
      jobId: "job-1",
      now: createNowFactory("2026-04-14T00:00:15.000Z"),
      storage,
    });
    mockedNudgePullRequestRunner.mockClear();

    expect(() =>
      editPullRequest(
        {
          repositoryPath,
          branchName: "feature/test",
          baseBranch: "release",
        },
        {
          cwd: workspace,
          storage,
          now: createNowFactory("2026-04-14T00:00:20.000Z"),
          jobIdFactory: createJobIdFactory("job-2"),
        },
      ),
    ).toThrow("Merged pull requests cannot change base branches.");

    expect(mockedNudgePullRequestRunner).not.toHaveBeenCalled();
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-pr-service-"));

  workspaces.push(workspace);

  return workspace;
}

function createRepositorySkeleton(cwd: string, repositoryName: string): string {
  const repositoryPath = path.join(cwd, ".data", "repos", repositoryName);

  mkdirSync(path.join(repositoryPath, ".git"), { recursive: true });
  writeFileSync(
    path.join(repositoryPath, ".git", "config"),
    "[core]\n\trepositoryformatversion = 0\n",
  );

  return repositoryPath;
}

function createSyncPayload(
  repositoryPath: string,
  overrides: Readonly<{
    commitHash?: string;
    baseBranch?: string;
    title?: string;
    body?: string;
    draft?: boolean;
    remoteName?: string;
  }> = {},
): {
  publishedBranch: {
    repositoryPath: string;
    branchName: string;
    commitHash: string;
    remoteName: string;
  };
  pullRequest: {
    repositoryPath: string;
    branchName: string;
    baseBranch: string;
    title: string;
    body: string;
    draft: boolean;
    remoteName: string;
  };
} {
  return {
    publishedBranch: {
      repositoryPath,
      branchName: "feature/test",
      commitHash: overrides.commitHash ?? "abcdef1",
      remoteName: overrides.remoteName ?? "origin",
    },
    pullRequest: {
      repositoryPath,
      branchName: "feature/test",
      baseBranch: overrides.baseBranch ?? "main",
      title: overrides.title ?? "Add the runner",
      body: overrides.body ?? "Initial body.",
      draft: overrides.draft ?? false,
      remoteName: overrides.remoteName ?? "origin",
    },
  };
}

function createJobIdFactory(...jobIds: string[]): () => string {
  let index = 0;

  return () => {
    const jobId = jobIds[Math.min(index, jobIds.length - 1)];

    index += 1;

    return jobId;
  };
}

function createNowFactory(...timestamps: string[]): () => Date {
  let index = 0;

  return () => {
    const timestamp = timestamps[Math.min(index, timestamps.length - 1)];

    index += 1;

    return new Date(timestamp);
  };
}

function createRunGitStub(
  responses: Readonly<Record<string, string>>,
): ReturnType<typeof vi.fn<GitCommandRunner>> {
  return vi.fn<GitCommandRunner>((command, args) => {
    const key = `${command} ${args.join(" ")}`;
    const response = responses[key];

    if (response === undefined) {
      throw new Error(`Unexpected command: ${key}`);
    }

    return response;
  });
}

function createRunCommandStub(
  responses: Readonly<
    Record<
      string,
      | Readonly<{
          exitCode: number;
          stdout: string;
          stderr: string;
        }>
      | readonly Readonly<{
          exitCode: number;
          stdout: string;
          stderr: string;
        }>[]
    >
  >,
): ReturnType<typeof vi.fn> {
  return vi.fn(async (command: string, args: readonly string[]) => {
    const key = `${command} ${args.join(" ")}`;
    const configuredResponse = responses[key];

    if (!configuredResponse) {
      throw new Error(`Unexpected command: ${key}`);
    }

    const response = Array.isArray(configuredResponse)
      ? (
          configuredResponse as Array<
            Readonly<{
              exitCode: number;
              stdout: string;
              stderr: string;
            }>
          >
        ).shift()
      : configuredResponse;

    if (!response) {
      throw new Error(`Unexpected command: ${key}`);
    }

    return response;
  });
}

function successResult(
  stdout: string = "",
  stderr: string = "",
): Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return {
    exitCode: 0,
    stdout,
    stderr,
  };
}

function failureResult(
  stdout: string = "",
  stderr: string = "",
): Readonly<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return {
    exitCode: 1,
    stdout,
    stderr,
  };
}

function createGitHubFetchSequence(responses: readonly Response[]): typeof fetch {
  const fetchImpl = vi.fn<typeof fetch>();

  responses.forEach((response) => {
    fetchImpl.mockResolvedValueOnce(response);
  });

  return fetchImpl;
}
