import "server-only";

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export type WorkflowResultArtifact = Readonly<{
  name: string;
  status: "passed" | "failed";
  installCommand: string;
  runCommand?: string;
  output: string;
}>;

export type CiResultArtifact = Readonly<{
  jobId: string;
  pullRequestId: number;
  repositoryName: string;
  branchName: string;
  baseBranch: string;
  commitHash: string;
  status: "succeeded" | "failed" | "merge_failed";
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string;
  errorMessage: string | null;
  workflows: readonly WorkflowResultArtifact[];
  merge: Readonly<{
    status: "succeeded" | "failed" | "skipped";
    message: string;
  }>;
}>;

export type WriteCiResultArtifactOptions = Readonly<{
  cwd?: string;
}>;

const RESULTS_ROOT = path.join(".data", "ci-results");

export function getCiResultArtifactPath(
  repositoryName: string,
  branchName: string,
  cwd: string = process.cwd(),
): string {
  return path.resolve(cwd, RESULTS_ROOT, repositoryName, `${branchName}.json`);
}

export function writeCiResultArtifact(
  artifact: CiResultArtifact,
  options: WriteCiResultArtifactOptions = {},
): string {
  const artifactPath = getCiResultArtifactPath(
    artifact.repositoryName,
    artifact.branchName,
    options.cwd,
  );

  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(`${artifactPath}`, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  return artifactPath;
}
