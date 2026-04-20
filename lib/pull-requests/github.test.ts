import { describe, expect, it, vi } from "vitest";
import {
  buildPullRequestGitHubDelegation,
  type GitCommandRunner,
} from "@/lib/pull-requests/github";

describe("buildPullRequestGitHubDelegation", () => {
  it("prefers GitHub compare links when remotes are available", () => {
    const runGit = vi.fn<GitCommandRunner>(
      () => "remote.upstream.url https://github.com/acme/alpha.git\n",
    );

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
