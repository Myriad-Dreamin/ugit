import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SUPERSEDED_CI_JOB_MESSAGE,
  claimRunnableJobs,
  completeCiJob,
  queuePullRequestSynchronization,
  readCiJob,
  readPullRequest,
  requeueRunningJobs,
  selectRunnableJobs,
} from "@/lib/pr-runner/storage";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";
import type { ValidatedPullRequestSyncRequest } from "@/lib/pr-runner/validation";

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
