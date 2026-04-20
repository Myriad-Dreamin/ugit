import { describe, expect, it } from "vitest";
import {
  buildRepositoryPullRequestPath,
  buildRepositoryPullRequestsPath,
} from "@/lib/pull-requests/rest-paths";

describe("pull-request REST paths", () => {
  it("builds repo-scoped pull-request list and detail paths", () => {
    expect(buildRepositoryPullRequestsPath("alpha")).toBe(
      "/api/pull-requests?repositoryName=alpha",
    );
    expect(buildRepositoryPullRequestPath("alpha", "17")).toBe(
      "/api/pull-requests/17?repositoryName=alpha",
    );
  });
});
