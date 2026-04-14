import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { synchronizePullRequest } from "@/lib/pr-runner/service";
import { claimRunnableJobs } from "@/lib/pr-runner/storage";
import { writeCiResultArtifact } from "@/lib/pr-runner/results";
import { getRepositoriesRoot, getRepositoryByName, type Repository } from "@/lib/repositories";
import { getRepositoryWorkflowPanelSummary } from "@/lib/repository-workflow-summary";
import { resetStorageCacheForTests } from "@/lib/storage/sqlite";

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

describe("getRepositoryWorkflowPanelSummary", () => {
  it("discovers nested artifact files, skips malformed and foreign payloads, and sorts deterministically", () => {
    const cwd = createWorkspace();
    const repository = createRepository(cwd, "alpha");
    const storage = path.join(cwd, "storage", "pull-requests");

    writeCiResultArtifact(
      createArtifact({
        repositoryName: "alpha",
        branchName: "feature/test",
        commitHash: "1111111aaaaaaa",
        finishedAt: "2026-04-14T00:10:00.000Z",
      }),
      { cwd },
    );
    writeCiResultArtifact(
      createArtifact({
        repositoryName: "alpha",
        branchName: "stable",
        commitHash: "2222222bbbbbbb",
        finishedAt: "2026-04-14T00:20:00.000Z",
        workflows: [{ name: "lint", status: "passed" }],
      }),
      { cwd },
    );
    writeCiResultArtifact(
      createArtifact({
        repositoryName: "alpha",
        branchName: "zeta",
        commitHash: "3333333ccccccc",
        finishedAt: "2026-04-14T00:20:00.000Z",
      }),
      { cwd },
    );
    writeCiResultArtifact(
      createArtifact({
        repositoryName: "beta",
        branchName: "ignored-from-other-repo",
      }),
      { cwd },
    );

    const alphaResultsRoot = path.join(cwd, ".data", "ci-results", "alpha");

    mkdirSync(alphaResultsRoot, { recursive: true });
    writeFileSync(path.join(alphaResultsRoot, "malformed.json"), "{", "utf8");
    writeFileSync(
      path.join(alphaResultsRoot, "foreign.json"),
      JSON.stringify(
        createArtifact({
          repositoryName: "beta",
          branchName: "foreign",
        }),
      ),
      "utf8",
    );

    expect(getRepositoryWorkflowPanelSummary(repository, { cwd, storage })).toEqual({
      repositoryName: "alpha",
      status: "succeeded",
      branchSummaries: [
        expect.objectContaining({
          branchName: "stable",
          commitHash: "2222222bbbbbbb",
          status: "succeeded",
          source: "artifact",
          activityAt: "2026-04-14T00:20:00.000Z",
        }),
        expect.objectContaining({
          branchName: "zeta",
          commitHash: "3333333ccccccc",
          status: "succeeded",
          source: "artifact",
          activityAt: "2026-04-14T00:20:00.000Z",
        }),
        expect.objectContaining({
          branchName: "feature/test",
          commitHash: "1111111aaaaaaa",
          status: "succeeded",
          source: "artifact",
          activityAt: "2026-04-14T00:10:00.000Z",
        }),
      ],
    });
  });

  it("includes queued jobs before a replacement artifact exists", () => {
    const cwd = createWorkspace();
    const repository = createRepository(cwd, "alpha");
    const storage = path.join(cwd, "storage", "pull-requests");

    queuePullRequest({
      cwd,
      storage,
      repository,
      branchName: "feature/live",
      commitHash: "abcdef1234567890",
      now: "2026-04-14T01:00:00.000Z",
      jobId: "job-1",
    });

    expect(getRepositoryWorkflowPanelSummary(repository, { cwd, storage })).toEqual({
      repositoryName: "alpha",
      status: "queued",
      branchSummaries: [
        {
          branchName: "feature/live",
          commitHash: "abcdef1234567890",
          status: "queued",
          queuedAt: "2026-04-14T01:00:00.000Z",
          startedAt: null,
          finishedAt: null,
          activityAt: "2026-04-14T01:00:00.000Z",
          source: "active_job",
          workflows: [],
        },
      ],
    });
  });

  it("prefers a newer running job over an older finished artifact for the same branch", () => {
    const cwd = createWorkspace();
    const repository = createRepository(cwd, "alpha");
    const storage = path.join(cwd, "storage", "pull-requests");

    writeCiResultArtifact(
      createArtifact({
        repositoryName: "alpha",
        branchName: "feature/test",
        commitHash: "0ddc0de1234567",
        finishedAt: "2026-04-14T00:10:00.000Z",
      }),
      { cwd },
    );

    queuePullRequest({
      cwd,
      storage,
      repository,
      branchName: "feature/test",
      commitHash: "deadc0de7654321",
      now: "2026-04-14T00:20:00.000Z",
      jobId: "job-2",
    });

    expect(
      claimRunnableJobs({
        storage,
        now: createNowFactory("2026-04-14T00:21:00.000Z"),
      }),
    ).toHaveLength(1);

    expect(getRepositoryWorkflowPanelSummary(repository, { cwd, storage })).toEqual({
      repositoryName: "alpha",
      status: "running",
      branchSummaries: [
        {
          branchName: "feature/test",
          commitHash: "deadc0de7654321",
          status: "running",
          queuedAt: "2026-04-14T00:20:00.000Z",
          startedAt: "2026-04-14T00:21:00.000Z",
          finishedAt: null,
          activityAt: "2026-04-14T00:21:00.000Z",
          source: "active_job",
          workflows: [],
        },
      ],
    });
  });

  it("keeps a newer artifact summary when the latest active job is older", () => {
    const cwd = createWorkspace();
    const repository = createRepository(cwd, "alpha");
    const storage = path.join(cwd, "storage", "pull-requests");

    writeCiResultArtifact(
      createArtifact({
        repositoryName: "alpha",
        branchName: "feature/test",
        commitHash: "a71fac77654321",
        finishedAt: "2026-04-14T00:30:00.000Z",
        workflows: [{ name: "lint", status: "passed" }],
      }),
      { cwd },
    );

    queuePullRequest({
      cwd,
      storage,
      repository,
      branchName: "feature/test",
      commitHash: "0feed123456789a",
      now: "2026-04-14T00:20:00.000Z",
      jobId: "job-3",
    });

    const summary = getRepositoryWorkflowPanelSummary(repository, { cwd, storage });

    expect(summary).toEqual({
      repositoryName: "alpha",
      status: "succeeded",
      branchSummaries: [
        {
          branchName: "feature/test",
          commitHash: "a71fac77654321",
          status: "succeeded",
          queuedAt: "2026-04-14T00:00:00.000Z",
          startedAt: "2026-04-14T00:00:10.000Z",
          finishedAt: "2026-04-14T00:30:00.000Z",
          activityAt: "2026-04-14T00:30:00.000Z",
          source: "artifact",
          workflows: [{ name: "lint", status: "passed" }],
        },
      ],
    });
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-repository-workflow-summary-"));

  workspaces.push(workspace);

  return workspace;
}

function createRepository(cwd: string, repositoryName: string): Repository {
  const repositoryPath = path.join(getRepositoriesRoot(cwd), repositoryName);

  mkdirSync(path.join(repositoryPath, ".git"), { recursive: true });

  const repository = getRepositoryByName(repositoryName, { cwd });

  if (!repository) {
    throw new Error(`Expected repository ${repositoryName} to exist.`);
  }

  return repository;
}

function queuePullRequest(options: {
  cwd: string;
  storage: string;
  repository: Repository;
  branchName: string;
  commitHash: string;
  now: string;
  jobId: string;
}): void {
  synchronizePullRequest(
    {
      publishedBranch: {
        repositoryPath: options.repository.path,
        branchName: options.branchName,
        commitHash: options.commitHash,
        remoteName: "origin",
      },
      pullRequest: {
        repositoryPath: options.repository.path,
        branchName: options.branchName,
        baseBranch: "main",
        title: `Sync ${options.branchName}`,
        body: "Synchronize the pull request.",
        draft: false,
        remoteName: "origin",
      },
    },
    {
      cwd: options.cwd,
      storage: options.storage,
      now: createNowFactory(options.now),
      jobIdFactory: () => options.jobId,
      nudgeRunner: () => undefined,
    },
  );
}

function createArtifact(
  overrides: Readonly<{
    repositoryName: string;
    branchName: string;
    commitHash?: string;
    status?: "succeeded" | "failed" | "merge_failed";
    queuedAt?: string;
    startedAt?: string | null;
    finishedAt?: string;
    workflows?: ReadonlyArray<{
      name: string;
      status: "passed" | "failed";
    }>;
  }>,
) {
  return {
    jobId: "job-artifact",
    pullRequestId: 1,
    repositoryName: overrides.repositoryName,
    branchName: overrides.branchName,
    baseBranch: "main",
    commitHash: overrides.commitHash ?? "artifact1234567",
    status: overrides.status ?? "succeeded",
    queuedAt: overrides.queuedAt ?? "2026-04-14T00:00:00.000Z",
    startedAt: overrides.startedAt ?? "2026-04-14T00:00:10.000Z",
    finishedAt: overrides.finishedAt ?? "2026-04-14T00:00:20.000Z",
    errorMessage: null,
    workflows: (overrides.workflows ?? [{ name: "test", status: "passed" }]).map((workflow) => ({
      ...workflow,
      installCommand: "pnpm install",
      runCommand: "pnpm test",
      output: `${workflow.name} output`,
    })),
    merge: {
      status: "succeeded" as const,
      message: "Merged successfully.",
    },
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
