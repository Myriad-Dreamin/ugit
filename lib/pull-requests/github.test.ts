import { describe, expect, it, vi } from "vitest";
import {
  buildPullRequestGitHubDelegation,
  readCanonicalGitHubPullRequest,
  resolveGitHubRepositoryContext,
  squashMergeGitHubPullRequest,
  GitHubPullRequestMergeError,
  type GitCommandRunner,
  type GitHubCommandRunner,
} from "@/lib/pull-requests/github";

describe("GitHub repository context", () => {
  it("prefers upstream remotes for compare links when GitHub metadata is available", () => {
    const runGit = vi.fn<GitCommandRunner>(
      () => "remote.upstream.url https://github.com/acme/alpha.git\n",
    );

    expect(resolveGitHubRepositoryContext("/tmp/alpha", "origin", runGit)).toEqual({
      remoteName: "upstream",
      repositoryUrl: "https://github.com/acme/alpha",
      owner: "acme",
      repository: "alpha",
    });
    expect(
      buildPullRequestGitHubDelegation({
        repositoryPath: "/tmp/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        preferredRemoteName: "origin",
        runGit,
      }),
    ).toEqual({
      state: "compare",
      url: "https://github.com/acme/alpha/compare/main...feature%2Ftest?expand=1",
      remoteName: "upstream",
      repositoryUrl: "https://github.com/acme/alpha",
      actionLabel: "Open on GitHub",
      message: "Open the best-effort GitHub compare view for this pull request.",
    });
  });

  it("falls back to an unavailable state without GitHub remotes", () => {
    const runGit = vi.fn<GitCommandRunner>(() => {
      throw new Error("missing config");
    });

    expect(
      buildPullRequestGitHubDelegation({
        repositoryPath: "/tmp/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        runGit,
      }),
    ).toEqual({
      state: "unavailable",
      url: null,
      remoteName: null,
      repositoryUrl: null,
      actionLabel: "Open on GitHub",
      message: "GitHub remote metadata is unavailable for this repository.",
    });
  });
});

describe("readCanonicalGitHubPullRequest", () => {
  it("reads the canonical pull request and mergeability through gh", async () => {
    const runCommand = createRunCommandStub({
      "gh pr list -R github.com/acme/alpha --state open --base main --head feature/test --json number,headRefName,baseRefName,headRepositoryOwner --limit 30":
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
      "gh pr view 7 -R github.com/acme/alpha --json number,url,mergeable,headRefName,headRefOid,baseRefName,baseRefOid":
        successResult(
          JSON.stringify({
            number: 7,
            url: "https://github.com/acme/alpha/pull/7",
            mergeable: "MERGEABLE",
            headRefName: "feature/test",
            headRefOid: "abcdef1",
            baseRefName: "main",
            baseRefOid: "fedcba9",
          }),
        ),
    });

    await expect(
      readCanonicalGitHubPullRequest({
        repositoryPath: "/tmp/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        repository: {
          remoteName: "upstream",
          repositoryUrl: "https://github.com/acme/alpha",
          owner: "acme",
          repository: "alpha",
        },
        runCommand,
      }),
    ).resolves.toEqual({
      status: "available",
      repository: {
        remoteName: "upstream",
        repositoryUrl: "https://github.com/acme/alpha",
        owner: "acme",
        repository: "alpha",
      },
      pullRequest: {
        number: 7,
        url: "https://github.com/acme/alpha/pull/7",
        mergeable: true,
        headBranch: "feature/test",
        headCommitHash: "abcdef1",
        baseBranch: "main",
        baseCommitHash: "fedcba9",
      },
      message: null,
    });
  });

  it("fails closed when canonical metadata is incomplete", async () => {
    const runCommand = createRunCommandStub({
      "gh pr list -R github.com/acme/alpha --state open --base main --head feature/test --json number,headRefName,baseRefName,headRepositoryOwner --limit 30":
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
      "gh pr view 7 -R github.com/acme/alpha --json number,url,mergeable,headRefName,headRefOid,baseRefName,baseRefOid":
        successResult(
          JSON.stringify({
            number: 7,
            url: "https://github.com/acme/alpha/pull/7",
            mergeable: "MERGEABLE",
            headRefName: "feature/test",
            baseRefName: "main",
            baseRefOid: "fedcba9",
          }),
        ),
    });

    await expect(
      readCanonicalGitHubPullRequest({
        repositoryPath: "/tmp/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        repository: {
          remoteName: "upstream",
          repositoryUrl: "https://github.com/acme/alpha",
          owner: "acme",
          repository: "alpha",
        },
        runCommand,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      repository: {
        remoteName: "upstream",
        repositoryUrl: "https://github.com/acme/alpha",
        owner: "acme",
        repository: "alpha",
      },
      pullRequest: null,
      message:
        "GitHub pull-request metadata is incomplete for feature/test targeting main. Verify gh auth status on the ugit server and check server logs if the problem persists.",
    });
  });

  it("fails closed when gh is unavailable", async () => {
    const runCommand = vi.fn<GitHubCommandRunner>(async () => {
      throw new Error("Failed to start gh pr list.");
    });

    await expect(
      readCanonicalGitHubPullRequest({
        repositoryPath: "/tmp/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        repository: {
          remoteName: "upstream",
          repositoryUrl: "https://github.com/acme/alpha",
          owner: "acme",
          repository: "alpha",
        },
        runCommand,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      repository: {
        remoteName: "upstream",
        repositoryUrl: "https://github.com/acme/alpha",
        owner: "acme",
        repository: "alpha",
      },
      pullRequest: null,
      message:
        "GitHub CLI is unavailable on the ugit server. Install gh, run gh auth login, and verify gh auth status.",
    });
  });

  it("fails closed when gh authentication is unavailable", async () => {
    const runCommand = createRunCommandStub({
      "gh pr list -R github.com/acme/alpha --state open --base main --head feature/test --json number,headRefName,baseRefName,headRepositoryOwner --limit 30":
        failureResult("", "To get started with GitHub CLI, please run: gh auth login"),
    });

    await expect(
      readCanonicalGitHubPullRequest({
        repositoryPath: "/tmp/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        repository: {
          remoteName: "upstream",
          repositoryUrl: "https://github.com/acme/alpha",
          owner: "acme",
          repository: "alpha",
        },
        runCommand,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      repository: {
        remoteName: "upstream",
        repositoryUrl: "https://github.com/acme/alpha",
        owner: "acme",
        repository: "alpha",
      },
      pullRequest: null,
      message:
        "GitHub CLI is not authenticated for this repository. Run gh auth login on the ugit server and verify gh auth status.",
    });
  });

  it("fails closed when gh returns malformed JSON", async () => {
    const runCommand = createRunCommandStub({
      "gh pr list -R github.com/acme/alpha --state open --base main --head feature/test --json number,headRefName,baseRefName,headRepositoryOwner --limit 30":
        successResult("{not-json"),
    });

    await expect(
      readCanonicalGitHubPullRequest({
        repositoryPath: "/tmp/alpha",
        branchName: "feature/test",
        baseBranch: "main",
        repository: {
          remoteName: "upstream",
          repositoryUrl: "https://github.com/acme/alpha",
          owner: "acme",
          repository: "alpha",
        },
        runCommand,
      }),
    ).resolves.toEqual({
      status: "unavailable",
      repository: {
        remoteName: "upstream",
        repositoryUrl: "https://github.com/acme/alpha",
        owner: "acme",
        repository: "alpha",
      },
      pullRequest: null,
      message:
        "GitHub CLI returned malformed JSON while reading pull-request metadata. Verify gh auth status on the ugit server and check server logs if the problem persists.",
    });
  });
});

describe("squashMergeGitHubPullRequest", () => {
  it("executes a squash merge through gh api", async () => {
    const runCommand = createRunCommandStub({
      "gh api --hostname github.com --method PUT repos/acme/alpha/pulls/7/merge -f merge_method=squash -f sha=abcdef1":
        successResult(
          JSON.stringify({
            merged: true,
            message: "Pull Request successfully merged",
            sha: "1234567",
          }),
        ),
    });

    await expect(
      squashMergeGitHubPullRequest({
        repository: {
          remoteName: "upstream",
          repositoryUrl: "https://github.com/acme/alpha",
          owner: "acme",
          repository: "alpha",
        },
        pullRequestNumber: 7,
        expectedHeadCommitHash: "abcdef1",
        runCommand,
      }),
    ).resolves.toEqual({
      message: "Pull Request successfully merged",
      mergeCommitHash: "1234567",
    });
  });

  it("surfaces merge failures as typed errors", async () => {
    const runCommand = createRunCommandStub({
      "gh api --hostname github.com --method PUT repos/acme/alpha/pulls/7/merge -f merge_method=squash -f sha=abcdef1":
        failureResult(
          "",
          "gh: Head branch was modified. Review and try the merge again. (HTTP 409)",
        ),
    });

    await expect(
      squashMergeGitHubPullRequest({
        repository: {
          remoteName: "upstream",
          repositoryUrl: "https://github.com/acme/alpha",
          owner: "acme",
          repository: "alpha",
        },
        pullRequestNumber: 7,
        expectedHeadCommitHash: "abcdef1",
        runCommand,
      }),
    ).rejects.toEqual(
      new GitHubPullRequestMergeError(
        "Head branch was modified. Review and try the merge again.",
        409,
      ),
    );
  });

  it("surfaces command-start failures as typed errors", async () => {
    const runCommand = vi.fn<GitHubCommandRunner>(async () => {
      throw new Error("Failed to start gh api.");
    });

    await expect(
      squashMergeGitHubPullRequest({
        repository: {
          remoteName: "upstream",
          repositoryUrl: "https://github.com/acme/alpha",
          owner: "acme",
          repository: "alpha",
        },
        pullRequestNumber: 7,
        expectedHeadCommitHash: "abcdef1",
        runCommand,
      }),
    ).rejects.toEqual(
      new GitHubPullRequestMergeError(
        "GitHub CLI is unavailable on the ugit server. Install gh, run gh auth login, and verify gh auth status.",
        503,
      ),
    );
  });
});

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
): ReturnType<typeof vi.fn<GitHubCommandRunner>> {
  return vi.fn<GitHubCommandRunner>(async (command, args) => {
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
