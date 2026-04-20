import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitCommandRunner } from "@/lib/pull-requests/github";

const { mockedNudgePullRequestRunner } = vi.hoisted(() => ({
  mockedNudgePullRequestRunner: vi.fn(),
}));

vi.mock("@/lib/pr-runner/runner", () => ({
  nudgePullRequestRunner: mockedNudgePullRequestRunner,
}));

import {
  editPullRequest,
  getRepositoryPullRequest,
  listPullRequests,
  listRepositoryPullRequests,
  synchronizePullRequest,
} from "@/lib/pr-runner/service";
import { writeCiResultArtifact } from "@/lib/pr-runner/results";
import { completeCiJob, readPullRequest } from "@/lib/pr-runner/storage";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
import { PullRequestRequestError } from "@/lib/pr-runner/validation";

const workspaces: string[] = [];

beforeEach(() => {
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
  it("returns browser-safe repo-scoped summaries without repository paths", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    synchronizePullRequest(createSyncPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-20T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    const response = listRepositoryPullRequests(
      {
        repositoryName: "alpha",
      },
      {
        cwd: workspace,
        storage,
      },
    );

    expect(response.pullRequests[0]).toMatchObject({
      id: 1,
      repositoryName: "alpha",
      branchName: "feature/test",
    });
    expect(response.pullRequests[0]).not.toHaveProperty("repositoryPath");
    expect(response.pullRequests[0]?.latestJob).not.toHaveProperty("resultPath");
  });

  it("sanitizes CI job errors in browser-safe list and detail responses", () => {
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
    const detail = getRepositoryPullRequest(
      {
        repositoryName: "alpha",
        pullRequestId: "1",
      },
      {
        cwd: workspace,
        storage,
      },
    );

    expect(list.pullRequests[0]?.latestJob?.errorMessage).toBe(
      "The CI job failed with an internal error. Check server logs for details.",
    );
    expect(detail.pullRequest.latestJob?.errorMessage).toBe(
      "The CI job failed with an internal error. Check server logs for details.",
    );
    expect(detail.pullRequest.ciJobs[0]?.errorMessage).toBe(
      "The CI job failed with an internal error. Check server logs for details.",
    );
    expect(JSON.stringify({ detail, list })).not.toContain(workspace);
    expect(JSON.stringify({ detail, list })).not.toContain(repositoryPath);
    expect(JSON.stringify({ detail, list })).not.toContain(managedWorktreePath);
    expect(JSON.stringify({ detail, list })).not.toContain(internalErrorMessage);
  });
});

describe("getRepositoryPullRequest service", () => {
  it("returns repo-owned detail with activity, CI history, and GitHub delegation", () => {
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
          status: "succeeded",
          message: "Fast-forwarded main to abcdef1.",
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
      mergeStatus: "succeeded",
      now: createNowFactory("2026-04-20T00:00:20.000Z"),
      storage,
    });

    const detail = getRepositoryPullRequest(
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
      },
    );

    expect(detail.pullRequest).toMatchObject({
      id: 1,
      repositoryName: "alpha",
      latestJob: expect.objectContaining({
        id: "job-1",
        status: "succeeded",
      }),
      github: expect.objectContaining({
        state: "compare",
        remoteName: "upstream",
      }),
    });
    expect(detail.pullRequest.activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "created",
        }),
        expect.objectContaining({
          type: "merged",
        }),
      ]),
    );
    expect(detail.pullRequest.ciJobs).toEqual([
      expect.objectContaining({
        id: "job-1",
        workflowResultStatus: "available",
        workflowExecutions: [
          expect.objectContaining({
            name: "lint",
            status: "passed",
          }),
        ],
      }),
    ]);
    expect(detail.pullRequest).not.toHaveProperty("repositoryPath");
  });

  it("sanitizes missing workflow artifact errors for browser-safe detail responses", () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const missingArtifactPath = path.join(
      workspace,
      ".data",
      "ci-results",
      "alpha",
      "feature",
      "test.json",
    );

    synchronizePullRequest(createSyncPayload(repositoryPath), {
      cwd: workspace,
      storage,
      now: createNowFactory("2026-04-20T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    completeCiJob({
      jobId: "job-1",
      status: "failed",
      resultPath: missingArtifactPath,
      mergeStatus: "failed",
      now: createNowFactory("2026-04-20T00:00:20.000Z"),
      storage,
    });

    const detail = getRepositoryPullRequest(
      {
        repositoryName: "alpha",
        pullRequestId: "1",
      },
      {
        cwd: workspace,
        storage,
      },
    );

    expect(detail.pullRequest.ciJobs).toEqual([
      expect.objectContaining({
        id: "job-1",
        workflowResultStatus: "missing",
        workflowResultError: "The CI result artifact is unavailable for this job.",
        workflowExecutions: [],
      }),
    ]);
    expect(detail.pullRequest.ciJobs[0]?.workflowResultError).not.toContain(workspace);
    expect(detail.pullRequest.ciJobs[0]?.workflowResultError).not.toContain(missingArtifactPath);
  });

  it("rejects pull requests that belong to a different repository", () => {
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

    expect(() =>
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
    ).toThrow("No ugit pull request exists for beta:1.");
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
      mergeStatus: "succeeded",
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
      storage,
    });
    mockedNudgePullRequestRunner.mockClear();

    try {
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
      );

      throw new Error("Expected merged PR sync to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(PullRequestRequestError);
      expect((error as PullRequestRequestError).statusCode).toBe(409);
      expect((error as Error).message).toBe("Merged pull requests cannot be synchronized.");
    }

    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      headCommitHash: "abcdef1",
      latestJobId: "job-1",
      status: "merged",
    });
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
      mergeStatus: "succeeded",
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
      storage,
    });
    mockedNudgePullRequestRunner.mockClear();

    try {
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
      );

      throw new Error("Expected merged PR retarget to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(PullRequestRequestError);
      expect((error as PullRequestRequestError).statusCode).toBe(409);
      expect((error as Error).message).toBe("Merged pull requests cannot change base branches.");
    }

    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      baseBranch: "main",
      latestJobId: "job-1",
      status: "merged",
    });
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
      remoteName: "origin",
    },
    pullRequest: {
      repositoryPath,
      branchName: "feature/test",
      baseBranch: overrides.baseBranch ?? "main",
      title: overrides.title ?? "Add the runner",
      body: overrides.body ?? "Initial body.",
      draft: overrides.draft ?? false,
      remoteName: "origin",
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
