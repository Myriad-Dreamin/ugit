import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

export type ReadCiResultArtifactResult =
  | Readonly<{
      status: "available";
      artifact: CiResultArtifact;
      errorMessage: null;
    }>
  | Readonly<{
      status: "missing" | "malformed";
      artifact: null;
      errorMessage: string;
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

export function readCiResultArtifact(resultPath: string | null): ReadCiResultArtifactResult {
  if (!resultPath) {
    return {
      status: "missing",
      artifact: null,
      errorMessage: "No CI result artifact was recorded for this job.",
    };
  }

  if (!existsSync(resultPath)) {
    return {
      status: "missing",
      artifact: null,
      errorMessage: `CI result artifact ${resultPath} does not exist.`,
    };
  }

  try {
    const parsedArtifact = JSON.parse(readFileSync(resultPath, "utf8")) as unknown;

    return {
      status: "available",
      artifact: normalizeCiResultArtifact(parsedArtifact),
      errorMessage: null,
    };
  } catch (error) {
    return {
      status: "malformed",
      artifact: null,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Failed to parse the CI result artifact for this pull request.",
    };
  }
}

function normalizeCiResultArtifact(value: unknown): CiResultArtifact {
  const record = asRecord(value);

  return {
    jobId: readRequiredString(record.jobId, "jobId"),
    pullRequestId: readPositiveInteger(record.pullRequestId, "pullRequestId"),
    repositoryName: readRequiredString(record.repositoryName, "repositoryName"),
    branchName: readRequiredString(record.branchName, "branchName"),
    baseBranch: readRequiredString(record.baseBranch, "baseBranch"),
    commitHash: readRequiredString(record.commitHash, "commitHash"),
    status: readCiStatus(record.status),
    queuedAt: readRequiredString(record.queuedAt, "queuedAt"),
    startedAt: readNullableString(record.startedAt, "startedAt"),
    finishedAt: readRequiredString(record.finishedAt, "finishedAt"),
    errorMessage: readNullableString(record.errorMessage, "errorMessage"),
    workflows: readWorkflowArtifacts(record.workflows),
    merge: normalizeMergeResult(record.merge),
  };
}

function readWorkflowArtifacts(value: unknown): readonly WorkflowResultArtifact[] {
  if (!Array.isArray(value)) {
    throw new Error("workflows must be an array.");
  }

  return value.map((workflowValue) => {
    const workflow = asRecord(workflowValue);

    return {
      name: readRequiredString(workflow.name, "workflows[].name"),
      status: readWorkflowStatus(workflow.status),
      installCommand: readRequiredString(workflow.installCommand, "workflows[].installCommand"),
      runCommand: readOptionalString(workflow.runCommand, "workflows[].runCommand"),
      output: readRequiredString(workflow.output, "workflows[].output"),
    };
  });
}

function normalizeMergeResult(value: unknown): CiResultArtifact["merge"] {
  const merge = asRecord(value);
  const status = merge.status;

  if (status !== "succeeded" && status !== "failed" && status !== "skipped") {
    throw new Error("merge.status must be succeeded, failed, or skipped.");
  }

  return {
    status,
    message: readRequiredString(merge.message, "merge.message"),
  };
}

function readCiStatus(value: unknown): CiResultArtifact["status"] {
  if (value === "succeeded" || value === "failed" || value === "merge_failed") {
    return value;
  }

  throw new Error("status must be succeeded, failed, or merge_failed.");
}

function readWorkflowStatus(value: unknown): WorkflowResultArtifact["status"] {
  if (value === "passed" || value === "failed") {
    return value;
  }

  throw new Error("workflows[].status must be passed or failed.");
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("CI result artifacts must be JSON objects.");
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string when provided.`);
  }

  return value;
}

function readNullableString(value: unknown, label: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string when provided.`);
  }

  return value;
}

function readPositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return value as number;
}
