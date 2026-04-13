import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockedNudgePullRequestRunner } = vi.hoisted(() => ({
  mockedNudgePullRequestRunner: vi.fn(),
}));

vi.mock("@/lib/pr-runner/runner", () => ({
  nudgePullRequestRunner: mockedNudgePullRequestRunner,
}));

import { editPullRequest, listPullRequests, synchronizePullRequest } from "@/lib/pr-runner/service";
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
