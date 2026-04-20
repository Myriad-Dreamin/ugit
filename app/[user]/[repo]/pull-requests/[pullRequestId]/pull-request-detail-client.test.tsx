import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: Readonly<{
    children: React.ReactNode;
    href: string;
  }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { PullRequestDetailClient } from "@/app/[user]/[repo]/pull-requests/[pullRequestId]/pull-request-detail-client";
import type { BrowserPullRequestDetail } from "@/packages/ugit-cli/src/pull-request-contract";

describe("PullRequestDetailClient", () => {
  it("renders an enabled merge button when the pull request is ready", () => {
    const markup = renderToStaticMarkup(
      <PullRequestDetailClient initialPullRequest={createPullRequestDetail()} />,
    );

    expect(markup).toContain("Merge via GitHub");
    expect(markup).not.toContain('disabled=""');
    expect(markup).toContain(
      "All manual-merge checks passed. This pull request is ready for approval.",
    );
    expect(markup).toContain("Open the canonical GitHub pull request for this branch.");
  });

  it("renders blocked readiness with a disabled merge button", () => {
    const markup = renderToStaticMarkup(
      <PullRequestDetailClient
        initialPullRequest={createPullRequestDetail({
          mergeReadiness: {
            state: "blocked",
            canMerge: false,
            summary: "Set UGIT_GITHUB_TOKEN on the ugit server to enable GitHub merge checks.",
            blockingReasons: [
              "Set UGIT_GITHUB_TOKEN on the ugit server to enable GitHub merge checks.",
            ],
            checks: [
              {
                id: "github_mergeability",
                label: "GitHub mergeability",
                state: "blocked",
                message: "Set UGIT_GITHUB_TOKEN on the ugit server to enable GitHub merge checks.",
              },
            ],
            checkedAt: "2026-04-20T00:00:05.000Z",
          },
        })}
      />,
    );

    expect(markup).toContain(
      "Set UGIT_GITHUB_TOKEN on the ugit server to enable GitHub merge checks.",
    );
    expect(markup).toContain('disabled=""');
  });
});

function createPullRequestDetail(
  overrides: Partial<BrowserPullRequestDetail> = {},
): BrowserPullRequestDetail {
  return {
    id: 7,
    repositoryName: "alpha",
    branchName: "feature/test",
    baseBranch: "main",
    title: "Add PR pages",
    body: "",
    draft: false,
    status: "passed",
    state: "open",
    latestCommitHash: "abcdef1",
    latestJob: {
      id: "job-1",
      status: "succeeded",
      commitHash: "abcdef1",
      errorMessage: null,
      mergeStatus: "skipped",
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:05.000Z",
      startedAt: "2026-04-20T00:00:02.000Z",
      finishedAt: "2026-04-20T00:00:20.000Z",
    },
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:05.000Z",
    activity: [],
    ciJobs: [],
    github: {
      state: "pull_request",
      url: "https://github.com/acme/alpha/pull/7",
      remoteName: "upstream",
      repositoryUrl: "https://github.com/acme/alpha",
      actionLabel: "Open on GitHub",
      message: "Open the canonical GitHub pull request for this branch.",
    },
    mergeReadiness: {
      state: "ready",
      canMerge: true,
      summary: "All manual-merge checks passed. This pull request is ready for approval.",
      blockingReasons: [],
      checks: [
        {
          id: "current_ci",
          label: "Current CI",
          state: "ready",
          message: "The latest CI job job-1 succeeded for abcdef1.",
        },
        {
          id: "base_parity",
          label: "Mirror parity",
          state: "ready",
          message: "Local main matches GitHub at fedcba9.",
        },
        {
          id: "github_mergeability",
          label: "GitHub mergeability",
          state: "ready",
          message: "GitHub reports pull request #7 is mergeable.",
        },
      ],
      checkedAt: "2026-04-20T00:00:05.000Z",
    },
    ...overrides,
  };
}
