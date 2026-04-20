import { beforeEach, describe, expect, it, vi } from "vitest";

const { evictManagedWorkflowWorktreeForCommit } = vi.hoisted(() => ({
  evictManagedWorkflowWorktreeForCommit: vi.fn(),
}));

vi.mock("@/lib/pr-runner/worktrees", () => ({
  evictManagedWorkflowWorktreeForCommit,
}));

import {
  advanceMirroredBaseBranchToCommit,
  fetchRemoteBranchCommit,
  validateFastForwardPreflight,
} from "@/lib/pr-runner/merge";

beforeEach(() => {
  evictManagedWorkflowWorktreeForCommit.mockReset();
  evictManagedWorkflowWorktreeForCommit.mockResolvedValue(undefined);
});

describe("validateFastForwardPreflight", () => {
  it("marks merge-ready branches whose head descends from the local base", async () => {
    const runCommand = createRunCommandStub({
      "git -C /tmp/alpha rev-parse --verify refs/heads/main": successResult("base-commit\n"),
      "git -C /tmp/alpha merge-base --is-ancestor refs/heads/main abcdef1": successResult(),
    });

    await expect(
      validateFastForwardPreflight({
        repositoryPath: "/tmp/alpha",
        baseBranch: "main",
        commitHash: "abcdef1",
        runCommand,
      }),
    ).resolves.toEqual({
      status: "ready",
      baseCommitHash: "base-commit",
      message: "Base branch main can fast-forward to abcdef1.",
    });
  });

  it("reports rebase-required branches before any mirror mutation", async () => {
    const runCommand = createRunCommandStub({
      "git -C /tmp/alpha rev-parse --verify refs/heads/main": successResult("base-commit\n"),
      "git -C /tmp/alpha merge-base --is-ancestor refs/heads/main abcdef1": failureResult(),
    });

    await expect(
      validateFastForwardPreflight({
        repositoryPath: "/tmp/alpha",
        baseBranch: "main",
        commitHash: "abcdef1",
        runCommand,
      }),
    ).resolves.toEqual({
      status: "rebase_required",
      baseCommitHash: "base-commit",
      message:
        "Base branch main is not an ancestor of abcdef1; rebase the pull request and rerun CI before merging.",
    });
  });
});

describe("fetchRemoteBranchCommit", () => {
  it("fetches the latest remote base commit through a branch-specific tracking ref", async () => {
    const runCommand = createRunCommandStub({
      "git -C /tmp/alpha fetch --quiet upstream main:refs/remotes/upstream/main": successResult(),
      "git -C /tmp/alpha rev-parse --verify refs/remotes/upstream/main": successResult("fedcba9\n"),
    });

    await expect(
      fetchRemoteBranchCommit({
        repositoryPath: "/tmp/alpha",
        remoteName: "upstream",
        branchName: "main",
        runCommand,
      }),
    ).resolves.toEqual({
      status: "succeeded",
      commitHash: "fedcba9",
      message: "Fetched upstream/main.",
    });
  });
});

describe("advanceMirroredBaseBranchToCommit", () => {
  it("uses git merge when the mirrored base branch is checked out", async () => {
    const runCommand = createRunCommandStub({
      "git -C /tmp/alpha rev-parse --verify refs/heads/main": successResult("base-commit\n"),
      "git -C /tmp/alpha merge-base --is-ancestor refs/heads/main fedcba9": successResult(),
      "git -C /tmp/alpha symbolic-ref --quiet --short HEAD": successResult("main\n"),
      "git -C /tmp/alpha merge --ff-only --quiet fedcba9": successResult(),
    });

    await expect(
      advanceMirroredBaseBranchToCommit({
        repositoryPath: "/tmp/alpha",
        baseBranch: "main",
        commitHash: "fedcba9",
        runCommand,
      }),
    ).resolves.toEqual({
      status: "succeeded",
      message: "Fast-forwarded main to fedcba9.",
    });
    expect(evictManagedWorkflowWorktreeForCommit).toHaveBeenCalledWith(
      "/tmp/alpha",
      "fedcba9",
      runCommand,
    );
  });

  it("uses update-ref when another branch is checked out", async () => {
    const runCommand = createRunCommandStub({
      "git -C /tmp/alpha rev-parse --verify refs/heads/main": successResult("base-commit\n"),
      "git -C /tmp/alpha merge-base --is-ancestor refs/heads/main fedcba9": successResult(),
      "git -C /tmp/alpha symbolic-ref --quiet --short HEAD": successResult("feature/test\n"),
      "git -C /tmp/alpha update-ref refs/heads/main fedcba9 base-commit": successResult(),
    });

    await expect(
      advanceMirroredBaseBranchToCommit({
        repositoryPath: "/tmp/alpha",
        baseBranch: "main",
        commitHash: "fedcba9",
        runCommand,
      }),
    ).resolves.toEqual({
      status: "succeeded",
      message: "Fast-forwarded main to fedcba9.",
    });
  });

  it("fails cleanly when managed workflow eviction rejects the update", async () => {
    const runCommand = createRunCommandStub({
      "git -C /tmp/alpha rev-parse --verify refs/heads/main": successResult("base-commit\n"),
      "git -C /tmp/alpha merge-base --is-ancestor refs/heads/main fedcba9": successResult(),
      "git -C /tmp/alpha symbolic-ref --quiet --short HEAD": successResult("main\n"),
    });

    evictManagedWorkflowWorktreeForCommit.mockRejectedValue(
      new Error("Refusing to remove workflow1 because the repository is dirty."),
    );

    await expect(
      advanceMirroredBaseBranchToCommit({
        repositoryPath: "/tmp/alpha",
        baseBranch: "main",
        commitHash: "fedcba9",
        runCommand,
      }),
    ).resolves.toEqual({
      status: "failed",
      message: "Refusing to remove workflow1 because the repository is dirty.",
    });
  });
});

function createRunCommandStub(
  responses: Readonly<
    Record<
      string,
      Readonly<{
        exitCode: number;
        stdout: string;
        stderr: string;
      }>
    >
  >,
): ReturnType<typeof vi.fn> {
  return vi.fn(async (command: string, args: readonly string[]) => {
    const key = `${command} ${args.join(" ")}`;
    const response = responses[key];

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
