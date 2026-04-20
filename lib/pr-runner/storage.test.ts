import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SUPERSEDED_CI_JOB_MESSAGE,
  claimRunnableJobs,
  completeCiJob,
  listPullRequestActivityEvents,
  listPullRequests,
  listPullRequestsForRepository,
  queuePullRequestSynchronization,
  readCiJob,
  readPullRequest,
  readPullRequestForRepository,
  requeueRunningJobs,
  selectRunnableJobs,
  updatePullRequest,
} from "@/lib/pr-runner/storage";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
import {
  PullRequestRequestError,
  type ValidatedPullRequestEditRequest,
  type ValidatedPullRequestSyncRequest,
} from "@/lib/pr-runner/validation";

const workspaces: string[] = [];

afterEach(() => {
  resetStorageCacheForTests();

  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("selectRunnableJobs", () => {
  it("limits active jobs to one per repository and four globally", () => {
    const selected = selectRunnableJobs(
      [
        { id: "job-1", repository_path: "/repos/a" },
        { id: "job-2", repository_path: "/repos/a" },
        { id: "job-3", repository_path: "/repos/b" },
        { id: "job-4", repository_path: "/repos/c" },
        { id: "job-5", repository_path: "/repos/d" },
        { id: "job-6", repository_path: "/repos/e" },
      ],
      new Set<string>(["/repos/running"]),
      4,
    );

    expect(selected).toEqual([
      { id: "job-1", repository_path: "/repos/a" },
      { id: "job-3", repository_path: "/repos/b" },
      { id: "job-4", repository_path: "/repos/c" },
      { id: "job-5", repository_path: "/repos/d" },
    ]);
  });

  it("skips repositories that already have a running job", () => {
    const selected = selectRunnableJobs(
      [
        { id: "job-1", repository_path: "/repos/a" },
        { id: "job-2", repository_path: "/repos/b" },
      ],
      new Set<string>(["/repos/a"]),
      4,
    );

    expect(selected).toEqual([{ id: "job-2", repository_path: "/repos/b" }]);
  });
});

describe("stale job handling", () => {
  it("supersedes an older running job when a newer sync already owns the pull request", () => {
    const workspace = createWorkspace();
    const repositoryPath = path.join(workspace, "repos", "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef1"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    const [runningJob] = claimRunnableJobs({
      storage,
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
    });

    expect(runningJob?.id).toBe("job-1");

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef2"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      jobIdFactory: createJobIdFactory("job-2"),
    });

    const completedJob = completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "succeeded",
      now: createNowFactory("2026-04-14T00:00:30.000Z"),
      storage,
    });

    expect(completedJob).toMatchObject({
      id: "job-1",
      status: "superseded",
      resultPath: null,
      mergeStatus: "skipped",
      errorMessage: SUPERSEDED_CI_JOB_MESSAGE,
    });
    expect(readCiJob("job-2", storage)).toMatchObject({
      id: "job-2",
      status: "queued",
      commitHash: "abcdef2",
    });
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      latestJobId: "job-2",
      headCommitHash: "abcdef2",
      status: "queued",
    });
  });

  it("does not reclaim a requeued stale job after runner recovery", () => {
    const workspace = createWorkspace();
    const repositoryPath = path.join(workspace, "repos", "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef1"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    claimRunnableJobs({
      storage,
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
    });

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef2"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      jobIdFactory: createJobIdFactory("job-2"),
    });

    expect(requeueRunningJobs(storage, createNowFactory("2026-04-14T00:00:30.000Z"))).toBe(1);

    expect(
      claimRunnableJobs({
        storage,
        now: createNowFactory("2026-04-14T00:00:40.000Z"),
      }),
    ).toEqual([
      expect.objectContaining({
        id: "job-2",
        commitHash: "abcdef2",
      }),
    ]);
    expect(readCiJob("job-1", storage)).toMatchObject({
      id: "job-1",
      status: "superseded",
    });
    expect(readCiJob("job-1", storage)?.errorMessage).toContain(SUPERSEDED_CI_JOB_MESSAGE);
  });
});

describe("listPullRequests", () => {
  it("filters repository pull requests by state, base branch, and head branch", () => {
    const workspace = createWorkspace();
    const repositoryPath = path.join(workspace, "repos", "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef1", "feature/open"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef2", "feature/merged"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:10.000Z"),
      jobIdFactory: createJobIdFactory("job-2"),
    });

    completeCiJob({
      jobId: "job-2",
      status: "succeeded",
      resultPath: "/tmp/job-2-result.json",
      mergeStatus: "succeeded",
      now: createNowFactory("2026-04-14T00:00:20.000Z"),
      storage,
    });

    expect(listPullRequests(repositoryPath, { storage, state: "open" })).toEqual([
      expect.objectContaining({
        pullRequest: expect.objectContaining({
          branchName: "feature/open",
          status: "queued",
        }),
        latestJob: expect.objectContaining({
          id: "job-1",
          status: "queued",
        }),
        state: "open",
      }),
    ]);
    expect(
      listPullRequests(repositoryPath, {
        storage,
        state: "merged",
        baseBranch: "main",
      }),
    ).toEqual([
      expect.objectContaining({
        pullRequest: expect.objectContaining({
          branchName: "feature/merged",
          status: "merged",
        }),
        latestJob: expect.objectContaining({
          id: "job-2",
          status: "succeeded",
        }),
        state: "merged",
      }),
    ]);
    expect(
      listPullRequests(repositoryPath, {
        storage,
        state: "all",
        headBranch: "feature/open",
      }),
    ).toEqual([
      expect.objectContaining({
        pullRequest: expect.objectContaining({
          branchName: "feature/open",
        }),
      }),
    ]);
  });
});

describe("repo-scoped pull-request reads", () => {
  it("lists and reads pull requests by repository name", () => {
    const workspace = createWorkspace();
    const alphaRepositoryPath = path.join(workspace, "repos", "alpha");
    const betaRepositoryPath = path.join(workspace, "repos", "beta");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createRequest(alphaRepositoryPath, "abcdef1"), {
      storage,
      now: createNowFactory("2026-04-20T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });
    queuePullRequestSynchronization(createRequest(betaRepositoryPath, "abcdef2"), {
      storage,
      now: createNowFactory("2026-04-20T00:00:10.000Z"),
      jobIdFactory: createJobIdFactory("job-2"),
    });

    expect(listPullRequestsForRepository("alpha", { storage })).toEqual([
      expect.objectContaining({
        pullRequest: expect.objectContaining({
          repositoryName: "alpha",
        }),
      }),
    ]);
    expect(readPullRequestForRepository("alpha", 1, storage)).toMatchObject({
      id: 1,
      repositoryName: "alpha",
    });
    expect(readPullRequestForRepository("beta", 1, storage)).toBeNull();
  });
});

describe("pull-request activity events", () => {
  it("records ordered create, start, finish, and merge transitions", () => {
    const workspace = createWorkspace();
    const repositoryPath = path.join(workspace, "repos", "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef1"), {
      storage,
      now: createNowFactory("2026-04-20T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });
    claimRunnableJobs({
      storage,
      now: createNowFactory("2026-04-20T00:00:05.000Z"),
    });
    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "succeeded",
      now: createNowFactory("2026-04-20T00:00:20.000Z"),
      storage,
    });

    expect(listPullRequestActivityEvents(1, { repositoryName: "alpha", storage })).toEqual([
      expect.objectContaining({
        eventType: "created",
      }),
      expect.objectContaining({
        eventType: "ci_started",
      }),
      expect.objectContaining({
        eventType: "ci_finished",
      }),
      expect.objectContaining({
        eventType: "merged",
      }),
    ]);
  });
});

describe("updatePullRequest", () => {
  it("updates pull-request metadata without queuing a new CI job", () => {
    const workspace = createWorkspace();
    const repositoryPath = path.join(workspace, "repos", "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef1"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    const updated = updatePullRequest(
      createEditRequest(repositoryPath, {
        title: "Retitle the pull request",
        body: "",
        draft: true,
      }),
      {
        storage,
        now: createNowFactory("2026-04-14T00:00:10.000Z"),
      },
    );

    expect(updated).toEqual({
      pullRequest: expect.objectContaining({
        title: "Retitle the pull request",
        body: "",
        draft: true,
        latestJobId: "job-1",
      }),
      latestJob: expect.objectContaining({
        id: "job-1",
        status: "queued",
      }),
      rerunJob: null,
      queuePosition: null,
    });
    expect(readCiJob("job-1", storage)).toMatchObject({
      id: "job-1",
      status: "queued",
    });
  });

  it("reuses the sync queue when the base branch changes", () => {
    const workspace = createWorkspace();
    const repositoryPath = path.join(workspace, "repos", "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef1"), {
      storage,
      now: createNowFactory("2026-04-14T00:00:00.000Z"),
      jobIdFactory: createJobIdFactory("job-1"),
    });

    const updated = updatePullRequest(
      createEditRequest(repositoryPath, {
        baseBranch: "release",
        title: "Retarget the pull request",
      }),
      {
        storage,
        now: createNowFactory("2026-04-14T00:00:10.000Z"),
        jobIdFactory: createJobIdFactory("job-2"),
      },
    );

    expect(updated).toEqual({
      pullRequest: expect.objectContaining({
        baseBranch: "release",
        title: "Retarget the pull request",
        latestJobId: "job-2",
        status: "queued",
      }),
      latestJob: expect.objectContaining({
        id: "job-2",
        status: "queued",
        commitHash: "abcdef1",
      }),
      rerunJob: expect.objectContaining({
        id: "job-2",
        status: "queued",
      }),
      queuePosition: 1,
    });
    expect(readCiJob("job-1", storage)).toMatchObject({
      id: "job-1",
      status: "superseded",
    });
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      baseBranch: "release",
      latestJobId: "job-2",
    });
  });

  it("rejects retargeting a merged pull request", () => {
    const workspace = createWorkspace();
    const repositoryPath = path.join(workspace, "repos", "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef1"), {
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

    try {
      updatePullRequest(
        createEditRequest(repositoryPath, {
          baseBranch: "release",
          title: "Do not reopen this merged PR",
        }),
        {
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
      title: "Sync feature/test",
    });
    expect(readCiJob("job-1", storage)).toMatchObject({
      id: "job-1",
      status: "succeeded",
    });
    expect(readCiJob("job-2", storage)).toBeNull();
  });

  it("rejects synchronizing a merged pull request", () => {
    const workspace = createWorkspace();
    const repositoryPath = path.join(workspace, "repos", "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");

    queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef1"), {
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

    try {
      queuePullRequestSynchronization(createRequest(repositoryPath, "abcdef2"), {
        storage,
        now: createNowFactory("2026-04-14T00:00:20.000Z"),
        jobIdFactory: createJobIdFactory("job-2"),
      });

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
    expect(readCiJob("job-1", storage)).toMatchObject({
      id: "job-1",
      status: "succeeded",
    });
    expect(readCiJob("job-2", storage)).toBeNull();
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-pr-storage-"));

  workspaces.push(workspace);

  return workspace;
}

function createRequest(
  repositoryPath: string,
  commitHash: string,
  branchName: string = "feature/test",
): ValidatedPullRequestSyncRequest {
  return {
    repositoryName: path.basename(repositoryPath),
    repositoryPath,
    publishedBranch: {
      repositoryPath,
      branchName,
      commitHash,
      remoteName: "origin",
    },
    pullRequest: {
      repositoryPath,
      branchName,
      baseBranch: "main",
      title: `Sync ${branchName}`,
      body: "Synchronize the pull request.",
      draft: false,
      remoteName: "origin",
    },
  };
}

function createEditRequest(
  repositoryPath: string,
  updates: Readonly<{
    title?: string;
    body?: string;
    baseBranch?: string;
    draft?: boolean;
  }>,
  branchName: string = "feature/test",
): ValidatedPullRequestEditRequest {
  return {
    repositoryName: path.basename(repositoryPath),
    repositoryPath,
    branchName,
    title: updates.title,
    body: updates.body,
    baseBranch: updates.baseBranch,
    draft: updates.draft,
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
