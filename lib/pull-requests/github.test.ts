import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPullRequestGitHubDelegation,
  readCanonicalGitHubPullRequest,
  resolveGitHubRepositoryContext,
  squashMergeGitHubPullRequest,
  GitHubPullRequestMergeError,
  type GitCommandRunner,
} from "@/lib/pull-requests/github";

afterEach(() => {
  vi.unstubAllEnvs();
});

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
  it("reads the canonical pull request and mergeability through the GitHub API", async () => {
    vi.stubEnv("UGIT_GITHUB_TOKEN", "test-token");

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
            sha: "abcdef1",
          },
          base: {
            ref: "main",
            sha: "fedcba9",
          },
        }),
      );

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
        fetchImpl,
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

  it("fails closed when the GitHub token is missing", async () => {
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
        fetchImpl: vi.fn<typeof fetch>(),
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
      message: "Set UGIT_GITHUB_TOKEN on the ugit server to enable GitHub merge checks.",
    });
  });
});

describe("squashMergeGitHubPullRequest", () => {
  it("executes a squash merge through the GitHub API", async () => {
    vi.stubEnv("UGIT_GITHUB_TOKEN", "test-token");

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        merged: true,
        message: "Pull Request successfully merged",
        sha: "1234567",
      }),
    );

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
        fetchImpl,
      }),
    ).resolves.toEqual({
      message: "Pull Request successfully merged",
      mergeCommitHash: "1234567",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      merge_method: "squash",
      sha: "abcdef1",
    });
  });

  it("surfaces merge failures as typed errors", async () => {
    vi.stubEnv("UGIT_GITHUB_TOKEN", "test-token");

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          message: "Pull Request is not mergeable",
        },
        {
          status: 409,
        },
      ),
    );

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
        fetchImpl,
      }),
    ).rejects.toEqual(new GitHubPullRequestMergeError("Pull Request is not mergeable", 409));
  });
});
