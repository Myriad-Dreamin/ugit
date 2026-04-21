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
          ...createCanonicalGhLookupResponses({
            baseBranch: "main",
            baseCommitHash: "fedcba9",
            headCommitHash: "abcdef1",
          }),
          [`git -C ${repositoryPath} fetch --quiet upstream main:refs/remotes/upstream/main`]:
            successResult(),
          [`git -C ${repositoryPath} rev-parse --verify refs/remotes/upstream/main`]:
            successResult("fedcba9\n"),
          [`git -C ${repositoryPath} rev-parse --verify refs/heads/main`]:
            successResult("fedcba9\n"),
        }),
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
          ...createCanonicalGhLookupResponses({
            baseBranch: "main",
            baseCommitHash: "fedcba9",
            headCommitHash: githubHeadCommit,
          }),
          [`git -C ${repositoryPath} fetch --quiet upstream main:refs/remotes/upstream/main`]:
            successResult(),
          [`git -C ${repositoryPath} rev-parse --verify refs/remotes/upstream/main`]:
            successResult("fedcba9\n"),
          [`git -C ${repositoryPath} rev-parse --verify refs/heads/main`]:
            successResult("fedcba9\n"),
        }),
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
          ...createCanonicalGhLookupResponses({
            baseBranch: "main",
            baseCommitHash: "base-commit",
            headCommitHash: featureCommit,
          }),
          [buildGhMergeCommand({
            owner: "acme",
            repository: "alpha",
            pullRequestNumber: 7,
            expectedHeadCommitHash: featureCommit,
          })]: successResult(
            JSON.stringify({
              merged: true,
              message: "Pull Request successfully merged",
              sha: "merged-commit",
            }),
          ),
          [`git -C ${repositoryPath} fetch --quiet upstream main:refs/remotes/upstream/main`]: [
            successResult(),
            successResult(),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/remotes/upstream/main`]: [
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
  });

  it("returns not_ready when GitHub rejects the squash merge because the head changed", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const featureCommit = "abcdef1";

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
          [buildGhListCommand({
            owner: "acme",
            repository: "alpha",
            branchName: "feature/test",
            baseBranch: "main",
          })]: [
            successResult(
              JSON.stringify([
                {
                  number: 7,
                  headRefName: "feature/test",
                  baseRefName: "main",
                  headRepositoryOwner: {
                    login: "acme",
                  },
                },
              ]),
            ),
            successResult(
              JSON.stringify([
                {
                  number: 7,
                  headRefName: "feature/test",
                  baseRefName: "main",
                  headRepositoryOwner: {
                    login: "acme",
                  },
                },
              ]),
            ),
          ],
          [buildGhViewCommand({
            owner: "acme",
            repository: "alpha",
            pullRequestNumber: 7,
          })]: [
            successResult(
              JSON.stringify({
                number: 7,
                url: "https://github.com/acme/alpha/pull/7",
                mergeable: "MERGEABLE",
                headRefName: "feature/test",
                headRefOid: featureCommit,
                baseRefName: "main",
                baseRefOid: "base-commit",
              }),
            ),
            successResult(
              JSON.stringify({
                number: 7,
                url: "https://github.com/acme/alpha/pull/7",
                mergeable: "MERGEABLE",
                headRefName: "feature/test",
                headRefOid: featureCommit,
                baseRefName: "main",
                baseRefOid: "base-commit",
              }),
            ),
          ],
          [buildGhMergeCommand({
            owner: "acme",
            repository: "alpha",
            pullRequestNumber: 7,
            expectedHeadCommitHash: featureCommit,
          })]: failureResult(
            "",
            "gh: Head branch was modified. Review and try the merge again. (HTTP 409)",
          ),
          [`git -C ${repositoryPath} fetch --quiet upstream main:refs/remotes/upstream/main`]: [
            successResult(),
            successResult(),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/remotes/upstream/main`]: [
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
      },
    );

    expect(response.outcome).toBe("not_ready");
    expect(response.message).toContain("Head branch was modified");
    expect(response.pullRequest.status).toBe("passed");
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      status: "passed",
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
          [buildGhListCommand({
            owner: "acme",
            repository: "alpha",
            branchName: "feature/test",
            baseBranch: "main",
          })]: [
            successResult(
              JSON.stringify([
                {
                  number: 7,
                  headRefName: "feature/test",
                  baseRefName: "main",
                  headRepositoryOwner: {
                    login: "acme",
                  },
                },
              ]),
            ),
            successResult(
              JSON.stringify([
                {
                  number: 7,
                  headRefName: "feature/test",
                  baseRefName: "main",
                  headRepositoryOwner: {
                    login: "acme",
                  },
                },
              ]),
            ),
          ],
          [buildGhViewCommand({
            owner: "acme",
            repository: "alpha",
            pullRequestNumber: 7,
          })]: [
            successResult(
              JSON.stringify({
                number: 7,
                url: "https://github.com/acme/alpha/pull/7",
                mergeable: "MERGEABLE",
                headRefName: "feature/test",
                headRefOid: featureCommit,
                baseRefName: "main",
                baseRefOid: newBaseCommit,
              }),
            ),
            successResult(
              JSON.stringify({
                number: 7,
                url: "https://github.com/acme/alpha/pull/7",
                mergeable: "MERGEABLE",
                headRefName: "feature/test",
                headRefOid: featureCommit,
                baseRefName: "main",
                baseRefOid: newBaseCommit,
              }),
            ),
          ],
          [`git -C ${repositoryPath} fetch --quiet upstream main:refs/remotes/upstream/main`]: [
            successResult(),
            successResult(),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/remotes/upstream/main`]: [
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
      },
    );

    expect(response.outcome).toBe("rebase_required");
    expect(response.message).toContain("rebase the pull request and rerun CI before merging");
    expect(response.pullRequest.status).toBe("passed");
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      status: "passed",
    });
  });

  it("fails closed when a newer synchronization lands during merge preflight", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const featureCommit = "abcdef1";
    const nextFeatureCommit = "abcdef2";

    synchronizePullRequest(
      createSyncPayload(repositoryPath, {
        commitHash: featureCommit,
        remoteName: "upstream",
      }),
      {
        cwd: workspace,
        storage,
        now: createNowFactory("2026-04-21T01:30:00.000Z"),
        jobIdFactory: createJobIdFactory("job-1"),
      },
    );

    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "skipped",
      now: createNowFactory("2026-04-21T01:30:20.000Z"),
      storage,
    });

    const mergeBaseCommand = `git -C ${repositoryPath} merge-base --is-ancestor refs/heads/main ${featureCommit}`;
    let synchronizedDuringPreflight = false;
    let ghLookupCount = 0;
    const runCommand = async (command: string, args: readonly string[]) => {
      const key = `${command} ${args.join(" ")}`;

      if (
        key ===
        buildGhListCommand({
          owner: "acme",
          repository: "alpha",
          branchName: "feature/test",
          baseBranch: "main",
        })
      ) {
        ghLookupCount += 1;

        return successResult(
          JSON.stringify([
            {
              number: 7,
              headRefName: "feature/test",
              baseRefName: "main",
              headRepositoryOwner: {
                login: "acme",
              },
            },
          ]),
        );
      }

      if (
        key ===
        buildGhViewCommand({
          owner: "acme",
          repository: "alpha",
          pullRequestNumber: 7,
        })
      ) {
        ghLookupCount += 1;

        return successResult(
          JSON.stringify({
            number: 7,
            url: "https://github.com/acme/alpha/pull/7",
            mergeable: "MERGEABLE",
            headRefName: "feature/test",
            headRefOid: featureCommit,
            baseRefName: "main",
            baseRefOid: "base-commit",
          }),
        );
      }

      if (
        key === `git -C ${repositoryPath} fetch --quiet upstream main:refs/remotes/upstream/main`
      ) {
        return successResult();
      }

      if (key === `git -C ${repositoryPath} rev-parse --verify refs/remotes/upstream/main`) {
        return successResult("base-commit\n");
      }

      if (key === `git -C ${repositoryPath} rev-parse --verify refs/heads/main`) {
        return successResult("base-commit\n");
      }

      if (key === mergeBaseCommand) {
        if (!synchronizedDuringPreflight) {
          synchronizedDuringPreflight = true;
          synchronizePullRequest(
            createSyncPayload(repositoryPath, {
              commitHash: nextFeatureCommit,
              remoteName: "upstream",
            }),
            {
              cwd: workspace,
              storage,
              now: createNowFactory("2026-04-21T01:30:30.000Z"),
              jobIdFactory: createJobIdFactory("job-2"),
            },
          );
        }

        return successResult();
      }

      throw new Error(`Unexpected command: ${key}`);
    };

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
        runCommand,
      },
    );

    expect(response.outcome).toBe("not_ready");
    expect(response.message).toContain("changed while merge approval was running");
    expect(response.pullRequest.status).toBe("queued");
    expect(response.pullRequest.latestJob).toMatchObject({
      id: "job-2",
      status: "queued",
    });
    expect(response.pullRequest.mergeReadiness).toMatchObject({
      state: "blocked",
      canMerge: false,
    });
    expect(ghLookupCount).toBe(4);
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      status: "queued",
      headCommitHash: nextFeatureCommit,
      latestJobId: "job-2",
    });
  });

  it("refuses approval when the canonical GitHub pull request head differs from the passing CI commit", async () => {
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
          [buildGhListCommand({
            owner: "acme",
            repository: "alpha",
            branchName: "feature/test",
            baseBranch: "main",
          })]: [
            successResult(
              JSON.stringify([
                {
                  number: 7,
                  headRefName: "feature/test",
                  baseRefName: "main",
                  headRepositoryOwner: {
                    login: "acme",
                  },
                },
              ]),
            ),
            successResult(
              JSON.stringify([
                {
                  number: 7,
                  headRefName: "feature/test",
                  baseRefName: "main",
                  headRepositoryOwner: {
                    login: "acme",
                  },
                },
              ]),
            ),
          ],
          [buildGhViewCommand({
            owner: "acme",
            repository: "alpha",
            pullRequestNumber: 7,
          })]: [
            successResult(
              JSON.stringify({
                number: 7,
                url: "https://github.com/acme/alpha/pull/7",
                mergeable: "MERGEABLE",
                headRefName: "feature/test",
                headRefOid: githubHeadCommit,
                baseRefName: "main",
                baseRefOid: "base-commit",
              }),
            ),
            successResult(
              JSON.stringify({
                number: 7,
                url: "https://github.com/acme/alpha/pull/7",
                mergeable: "MERGEABLE",
                headRefName: "feature/test",
                headRefOid: githubHeadCommit,
                baseRefName: "main",
                baseRefOid: "base-commit",
              }),
            ),
          ],
          [`git -C ${repositoryPath} fetch --quiet upstream main:refs/remotes/upstream/main`]: [
            successResult(),
            successResult(),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/remotes/upstream/main`]: [
            successResult("base-commit\n"),
            successResult("base-commit\n"),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/heads/main`]: [
            successResult("base-commit\n"),
            successResult("base-commit\n"),
          ],
        }),
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
    expect(readPullRequest(repositoryPath, "feature/test", storage)).toMatchObject({
      status: "passed",
    });
  });

  it("refuses approval when the canonical GitHub pull request targets a different base branch", async () => {
    const workspace = createWorkspace();
    const repositoryPath = createRepositorySkeleton(workspace, "alpha");
    const storage = path.join(workspace, "storage", "pull-requests");
    const featureCommit = "abcdef1";
    const githubBaseBranch = "release";

    synchronizePullRequest(
      createSyncPayload(repositoryPath, {
        commitHash: featureCommit,
        remoteName: "upstream",
      }),
      {
        cwd: workspace,
        storage,
        now: createNowFactory("2026-04-21T02:30:00.000Z"),
        jobIdFactory: createJobIdFactory("job-1"),
      },
    );

    completeCiJob({
      jobId: "job-1",
      status: "succeeded",
      resultPath: "/tmp/job-1-result.json",
      mergeStatus: "skipped",
      now: createNowFactory("2026-04-21T02:30:20.000Z"),
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
          [buildGhListCommand({
            owner: "acme",
            repository: "alpha",
            branchName: "feature/test",
            baseBranch: "main",
          })]: [
            successResult(
              JSON.stringify([
                {
                  number: 7,
                  headRefName: "feature/test",
                  baseRefName: "main",
                  headRepositoryOwner: {
                    login: "acme",
                  },
                },
              ]),
            ),
            successResult(
              JSON.stringify([
                {
                  number: 7,
                  headRefName: "feature/test",
                  baseRefName: "main",
                  headRepositoryOwner: {
                    login: "acme",
                  },
                },
              ]),
            ),
          ],
          [buildGhViewCommand({
            owner: "acme",
            repository: "alpha",
            pullRequestNumber: 7,
          })]: [
            successResult(
              JSON.stringify({
                number: 7,
                url: "https://github.com/acme/alpha/pull/7",
                mergeable: "MERGEABLE",
                headRefName: "feature/test",
                headRefOid: featureCommit,
                baseRefName: githubBaseBranch,
                baseRefOid: "base-commit",
              }),
            ),
            successResult(
              JSON.stringify({
                number: 7,
                url: "https://github.com/acme/alpha/pull/7",
                mergeable: "MERGEABLE",
                headRefName: "feature/test",
                headRefOid: featureCommit,
                baseRefName: githubBaseBranch,
                baseRefOid: "base-commit",
              }),
            ),
          ],
          [`git -C ${repositoryPath} fetch --quiet upstream main:refs/remotes/upstream/main`]: [
            successResult(),
            successResult(),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/remotes/upstream/main`]: [
            successResult("base-commit\n"),
            successResult("base-commit\n"),
          ],
          [`git -C ${repositoryPath} rev-parse --verify refs/heads/main`]: [
            successResult("base-commit\n"),
            successResult("base-commit\n"),
          ],
        }),
      },
    );

    expect(response.outcome).toBe("not_ready");
    expect(response.message).toContain(githubBaseBranch);
    expect(response.message).toContain("ugit expects main");
    expect(response.pullRequest.status).toBe("passed");
    expect(response.pullRequest.mergeReadiness).toMatchObject({
      state: "blocked",
      canMerge: false,
      summary: expect.stringContaining(githubBaseBranch),
      checks: expect.arrayContaining([
        expect.objectContaining({
          id: "current_ci",
          state: "blocked",
          message: expect.stringContaining("ugit expects main"),
        }),
      ]),
    });
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

function createCanonicalGhLookupResponses(
  options: Readonly<{
    owner?: string;
    repository?: string;
    branchName?: string;
    baseBranch?: string;
    pullRequestNumber?: number;
    headRepositoryOwner?: string;
    mergeable?: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
    headCommitHash?: string;
    baseCommitHash?: string;
  }> = {},
): Readonly<Record<string, ReturnType<typeof successResult>>> {
  const owner = options.owner ?? "acme";
  const repository = options.repository ?? "alpha";
  const branchName = options.branchName ?? "feature/test";
  const baseBranch = options.baseBranch ?? "main";
  const pullRequestNumber = options.pullRequestNumber ?? 7;
  const headRepositoryOwner = options.headRepositoryOwner ?? owner;

  return {
    [buildGhListCommand({
      owner,
      repository,
      branchName,
      baseBranch,
    })]: successResult(
      JSON.stringify([
        {
          number: pullRequestNumber,
          headRefName: branchName,
          baseRefName: baseBranch,
          headRepositoryOwner: {
            login: headRepositoryOwner,
          },
        },
      ]),
    ),
    [buildGhViewCommand({
      owner,
      repository,
      pullRequestNumber,
    })]: successResult(
      JSON.stringify({
        number: pullRequestNumber,
        url: `https://github.com/${owner}/${repository}/pull/${pullRequestNumber}`,
        mergeable: options.mergeable ?? "MERGEABLE",
        headRefName: branchName,
        headRefOid: options.headCommitHash ?? "abcdef1",
        baseRefName: baseBranch,
        baseRefOid: options.baseCommitHash ?? "base-commit",
      }),
    ),
  };
}

function buildGhListCommand(
  options: Readonly<{
    host?: string;
    owner: string;
    repository: string;
    branchName: string;
    baseBranch: string;
  }>,
): string {
  const host = options.host ?? "github.com";

  return (
    `gh pr list -R ${host}/${options.owner}/${options.repository} --state open --base ` +
    `${options.baseBranch} --head ${options.branchName} --json ` +
    "number,headRefName,baseRefName,headRepositoryOwner --limit 30"
  );
}

function buildGhViewCommand(
  options: Readonly<{
    host?: string;
    owner: string;
    repository: string;
    pullRequestNumber: number;
  }>,
): string {
  const host = options.host ?? "github.com";

  return (
    `gh pr view ${options.pullRequestNumber} -R ${host}/${options.owner}/${options.repository} --json ` +
    "number,url,mergeable,headRefName,headRefOid,baseRefName,baseRefOid"
  );
}

function buildGhMergeCommand(
  options: Readonly<{
    owner: string;
    repository: string;
    pullRequestNumber: number;
    expectedHeadCommitHash: string;
  }>,
): string {
  return (
    "gh api --hostname github.com --method PUT " +
    `repos/${options.owner}/${options.repository}/pulls/${options.pullRequestNumber}/merge ` +
    `-f merge_method=squash -f sha=${options.expectedHeadCommitHash}`
  );
}
