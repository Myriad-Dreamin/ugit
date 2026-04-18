import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { getRepositoriesRoot, getRepositoryByName } from "@/lib/repositories";
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
  executionRepositoryPath: string;
  workflowName: string;
}>;

export type ValidatedWorkflowRunListRequest = Readonly<{
  repositoryName: string;
}>;

export type ValidatedWorkflowRunDetailRequest = Readonly<{
  repositoryName: string;
  workflowId: string;
}>;

export type ValidatedWorkflowLogsRequest = Readonly<{
  workflowId: string;
  repositoryName: string | null;
  offset: number;
}>;

export type ValidatedWorkflowReadRepository = Readonly<{
  repositoryName: string;
  repositoryPath: string;
}>;

export type ValidateWorkflowRequestOptions = Readonly<{
  cwd?: string;
}>;

export type ValidateWorkflowRunRequestOptions = ValidateWorkflowRequestOptions;

export function resolveWorkflowReadRepository(
  repositoryNameValue: unknown,
  options: ValidateWorkflowRequestOptions = {},
): ValidatedWorkflowReadRepository {
  const repositoryName = readRequiredString(repositoryNameValue, "repositoryName");
  const repository = options.cwd
    ? getRepositoryByName(repositoryName, {
        cwd: options.cwd,
      })
    : getRepositoryByName(repositoryName);

  if (!repository) {
    throw new WorkflowRunRequestError(
      `ugit repository ${repositoryName} does not exist on the server.`,
      404,
    );
  }

  return {
    repositoryName: repository.name,
    repositoryPath: repository.path,
  };
}

export function validateWorkflowRunRequest(
  payload: unknown,
  options: ValidateWorkflowRunRequestOptions = {},
): ValidatedWorkflowRunRequest {
  const request = asRecord(payload, "The workflow-run payload");
  const publishedBranch = normalizePublishedBranch(request.publishedBranch);
  const repository = resolveWorkflowRunRepositoryTarget(
    publishedBranch.repositoryPath,
    options.cwd,
  );
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
      repositoryPath: repository.executionRepositoryPath,
    },
    repositoryName: repository.repositoryName,
    repositoryPath: repository.repositoryPath,
    executionRepositoryPath: repository.executionRepositoryPath,
    workflowName,
  };
}

export function validateWorkflowRunListRequest(payload: unknown): ValidatedWorkflowRunListRequest {
  const request = asRecord(payload, "The workflow-run list payload");

  return {
    repositoryName: readRequiredString(request.repositoryName, "repositoryName"),
  };
}

export function validateWorkflowRunDetailRequest(
  payload: unknown,
): ValidatedWorkflowRunDetailRequest {
  const request = asRecord(payload, "The workflow-run detail payload");

  return {
    repositoryName: readRequiredString(request.repositoryName, "repositoryName"),
    workflowId: readRequiredString(request.workflowId, "workflowId"),
  };
}

export function validateWorkflowLogsRequest(payload: unknown): ValidatedWorkflowLogsRequest {
  const request = asRecord(payload, "The workflow-log payload");
  const repositoryName = readOptionalNonEmptyString(request.repositoryName, "repositoryName");

  return {
    workflowId: readRequiredString(request.workflowId, "workflowId"),
    repositoryName: repositoryName ?? null,
    offset: readNonNegativeInteger(request.offset, "offset"),
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

export function resolveWorkflowRunRepositoryTarget(
  repositoryPathValue: string,
  cwd: string | undefined,
): Readonly<{
  repositoryName: string;
  repositoryPath: string;
  executionRepositoryPath: string;
}> {
  const executionRepositoryPath = normalizeWorkflowExecutionPath(repositoryPathValue, cwd);
  const repositoryName = resolveWorkflowRepositoryNameFromPath(executionRepositoryPath, cwd);
  const repository = resolveWorkflowReadRepository(repositoryName, {
    cwd,
  });

  return {
    repositoryName: repository.repositoryName,
    repositoryPath: repository.repositoryPath,
    executionRepositoryPath,
  };
}

function normalizeWorkflowExecutionPath(
  repositoryPathValue: string,
  cwd: string | undefined,
): string {
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

  return repositoryPath;
}

function resolveWorkflowRepositoryNameFromPath(
  repositoryPath: string,
  cwd: string | undefined,
): string {
  const relativeRepositoryPath = path.relative(getRepositoriesRoot(cwd), repositoryPath);
  const repositoryNameCandidate = relativeRepositoryPath
    .split(path.sep)
    .find((segment) => segment.length > 0);

  if (!repositoryNameCandidate) {
    throw new WorkflowRunRequestError(
      `ugit repository ${repositoryPath} does not exist on the server.`,
      404,
    );
  }

  return resolveWorkflowReadRepository(repositoryNameCandidate, {
    cwd,
  }).repositoryName;
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

function readOptionalNonEmptyString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return readRequiredString(value, label);
}

function readNonNegativeInteger(value: unknown, label: string): number {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const integerValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(integerValue) || integerValue < 0) {
    throw new WorkflowRunRequestError(`${label} must be a non-negative integer.`, 400);
  }

  return integerValue;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new WorkflowRunRequestError(`${label} must be a string.`, 400);
  }

  return value;
}
