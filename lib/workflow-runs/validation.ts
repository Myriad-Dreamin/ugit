import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { getRepositoriesRoot } from "@/lib/repositories";
import type { GitPlatformPublishedBranch } from "@/packages/ugit-cli/src/pull-request-contract";

const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,64}$/i;
const WORKFLOW_NAME_PATTERN = /^[^/\\]+$/;

export class WorkflowRunRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "WorkflowRunRequestError";
  }
}

export type ValidatedWorkflowRunRequest = Readonly<{
  publishedBranch: GitPlatformPublishedBranch;
  repositoryName: string;
  repositoryPath: string;
  workflowName: string;
}>;

export type ValidatedWorkflowLogsRequest = Readonly<{
  workflowId: string;
}>;

export type ValidateWorkflowRunRequestOptions = Readonly<{
  cwd?: string;
}>;

export function validateWorkflowRunRequest(
  payload: unknown,
  options: ValidateWorkflowRunRequestOptions = {},
): ValidatedWorkflowRunRequest {
  const request = asRecord(payload, "The workflow-run payload");
  const publishedBranch = normalizePublishedBranch(request.publishedBranch);
  const repository = normalizeRepositoryTarget(publishedBranch.repositoryPath, options.cwd);
  const workflowName = readRequiredString(request.workflowName, "workflowName");

  if (!WORKFLOW_NAME_PATTERN.test(workflowName) || workflowName === "." || workflowName === "..") {
    throw new WorkflowRunRequestError(
      `workflowName must be a single workflow directory name. Received "${workflowName}".`,
      400,
    );
  }

  return {
    publishedBranch: {
      ...publishedBranch,
      repositoryPath: repository.repositoryPath,
    },
    repositoryName: repository.repositoryName,
    repositoryPath: repository.repositoryPath,
    workflowName,
  };
}

export function validateWorkflowLogsRequest(workflowId: unknown): ValidatedWorkflowLogsRequest {
  return {
    workflowId: readRequiredString(workflowId, "workflowId"),
  };
}

function normalizePublishedBranch(value: unknown): GitPlatformPublishedBranch {
  const record = asRecord(value, "The publishedBranch payload");
  const repositoryPath = readRequiredString(
    record.repositoryPath,
    "publishedBranch.repositoryPath",
  );
  const branchName = readRequiredString(record.branchName, "publishedBranch.branchName");
  const commitHash = readRequiredString(record.commitHash, "publishedBranch.commitHash");

  if (!COMMIT_HASH_PATTERN.test(commitHash)) {
    throw new WorkflowRunRequestError(
      `publishedBranch.commitHash must be a hexadecimal Git revision. Received "${commitHash}".`,
      400,
    );
  }

  return {
    repositoryPath,
    branchName,
    commitHash,
    remoteName: readOptionalString(record.remoteName, "publishedBranch.remoteName"),
    pushedAt: readOptionalString(record.pushedAt, "publishedBranch.pushedAt"),
  };
}

function normalizeRepositoryTarget(
  repositoryPathValue: string,
  cwd: string | undefined,
): Readonly<{
  repositoryName: string;
  repositoryPath: string;
}> {
  const repositoriesRoot = getRepositoriesRoot(cwd);
  const repositoryPath = path.normalize(repositoryPathValue);
  const relativeRepositoryPath = path.relative(repositoriesRoot, repositoryPath);

  if (
    !path.isAbsolute(repositoryPath) ||
    relativeRepositoryPath.startsWith("..") ||
    path.isAbsolute(relativeRepositoryPath)
  ) {
    throw new WorkflowRunRequestError(
      `Repository path ${repositoryPath} is outside the configured ugit repository root.`,
      400,
    );
  }

  if (!existsSync(path.join(repositoryPath, ".git"))) {
    throw new WorkflowRunRequestError(
      `ugit repository ${repositoryPath} does not exist on the server.`,
      404,
    );
  }

  return {
    repositoryName: path.basename(repositoryPath),
    repositoryPath,
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowRunRequestError(`${label} must be a JSON object.`, 400);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string): string {
  const stringValue = readString(value, label);

  if (stringValue.trim().length === 0) {
    throw new WorkflowRunRequestError(`${label} must be a non-empty string.`, 400);
  }

  return stringValue;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return readString(value, label);
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new WorkflowRunRequestError(`${label} must be a string.`, 400);
  }

  return value;
}
