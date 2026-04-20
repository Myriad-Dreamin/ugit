import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getCiResultArtifactPath,
  readCiResultArtifact,
  writeCiResultArtifact,
} from "@/lib/pr-runner/results";

const workspaces: string[] = [];

afterEach(() => {
  while (workspaces.length > 0) {
    const workspace = workspaces.pop();

    if (workspace) {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
});

describe("writeCiResultArtifact", () => {
  it("writes CI artifacts into .data/ci-results/<repo>/<branch>.json", () => {
    const cwd = createWorkspace();

    const artifactPath = writeCiResultArtifact(
      {
        jobId: "job-1",
        pullRequestId: 1,
        repositoryName: "alpha",
        branchName: "feature/test",
        baseBranch: "main",
        commitHash: "abcdef1",
        status: "succeeded",
        queuedAt: "2026-04-14T00:00:00.000Z",
        startedAt: "2026-04-14T00:00:10.000Z",
        finishedAt: "2026-04-14T00:00:20.000Z",
        errorMessage: null,
        workflows: [],
        merge: {
          status: "succeeded",
          message: "Fast-forwarded main to abcdef1.",
        },
      },
      { cwd },
    );

    expect(artifactPath).toBe(getCiResultArtifactPath("alpha", "feature/test", cwd));
    expect(JSON.parse(readFileSync(artifactPath, "utf8"))).toMatchObject({
      repositoryName: "alpha",
      branchName: "feature/test",
      merge: {
        status: "succeeded",
      },
    });
  });
});

describe("readCiResultArtifact", () => {
  it("parses recorded workflow summaries", () => {
    const cwd = createWorkspace();
    const artifactPath = writeCiResultArtifact(
      {
        jobId: "job-1",
        pullRequestId: 1,
        repositoryName: "alpha",
        branchName: "feature/test",
        baseBranch: "main",
        commitHash: "abcdef1",
        status: "succeeded",
        queuedAt: "2026-04-14T00:00:00.000Z",
        startedAt: "2026-04-14T00:00:10.000Z",
        finishedAt: "2026-04-14T00:00:20.000Z",
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
          status: "succeeded",
          message: "Fast-forwarded main to abcdef1.",
        },
      },
      { cwd },
    );

    expect(readCiResultArtifact(artifactPath)).toEqual({
      status: "available",
      artifact: expect.objectContaining({
        jobId: "job-1",
        workflows: [
          expect.objectContaining({
            name: "lint",
            status: "passed",
          }),
        ],
      }),
      errorMessage: null,
    });
  });

  it("returns malformed when the artifact JSON is invalid", () => {
    const cwd = createWorkspace();
    const artifactPath = getCiResultArtifactPath("alpha", "feature/test", cwd);

    mkdirSync(path.dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, "{not valid json}\n", "utf8");

    expect(readCiResultArtifact(artifactPath)).toEqual({
      status: "malformed",
      artifact: null,
      errorMessage: expect.any(String),
    });
  });
});

function createWorkspace(): string {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ugit-pr-results-"));

  workspaces.push(workspace);

  return workspace;
}
