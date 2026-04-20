import { describe, expect, it } from "vitest";
import {
  formatPullRequestStatus,
  formatPullRequestTimestamp,
  hasActivePullRequestSummaries,
  isPullRequestCiJobActive,
} from "@/lib/pull-requests/presentation";

describe("pull-request presentation helpers", () => {
  it("detects active CI jobs for polling", () => {
    expect(isPullRequestCiJobActive("queued")).toBe(true);
    expect(isPullRequestCiJobActive("running")).toBe(true);
    expect(isPullRequestCiJobActive("failed")).toBe(false);
    expect(
      hasActivePullRequestSummaries([
        {
          id: 1,
          repositoryName: "alpha",
          branchName: "feature/test",
          baseBranch: "main",
          title: "Add PR pages",
          body: "",
          draft: false,
          status: "running",
          state: "open",
          latestCommitHash: "abcdef1",
          latestJob: {
            id: "job-1",
            status: "running",
            commitHash: "abcdef1",
            errorMessage: null,
            mergeStatus: null,
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-20T00:00:05.000Z",
            startedAt: "2026-04-20T00:00:02.000Z",
            finishedAt: null,
          },
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:05.000Z",
        },
      ]),
    ).toBe(true);
  });

  it("formats status and timestamps for the UI", () => {
    expect(formatPullRequestStatus("merge_failed")).toBe("Merge Failed");
    expect(formatPullRequestTimestamp("2026-04-20T00:00:00.000Z")).toBe("2026-04-20 00:00:00 UTC");
  });
});
