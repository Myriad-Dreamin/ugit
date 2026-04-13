import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { getRepositoriesRoot } from "@/lib/repositories";
import type {
  GitPlatformPublishedBranch,
  PullRequestListState,
  SynchronizeGitPlatformPullRequestArgs,
} from "@/packages/ugit-cli/src/pull-request-contract";

const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,64}$/i;

export class PullRequestRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PullRequestRequestError";
  }
}

export type ValidatedPullRequestSyncRequest = Readonly<{
  publishedBranch: GitPlatformPublishedBranch;
  pullRequest: SynchronizeGitPlatformPullRequestArgs;
  repositoryName: string;
  repositoryPath: string;
}>;

export type ValidatedPullRequestListRequest = Readonly<{
  repositoryName: string;
  repositoryPath: string;
  state: PullRequestListState;
  baseBranch?: string;
  headBranch?: string;
}>;

export type ValidatedPullRequestEditRequest = Readonly<{
  repositoryName: string;
  repositoryPath: string;
  branchName: string;
  title?: string;
  body?: string;
  baseBranch?: string;
  draft?: boolean;
}>;

export type ValidatePullRequestRequestOptions = Readonly<{
  cwd?: string;
}>;

export function validatePullRequestSyncRequest(
  payload: unknown,
  options: ValidatePullRequestRequestOptions = {},
): ValidatedPullRequestSyncRequest {
  const request = asRecord(payload, "The pull-request synchronization payload");
  const publishedBranch = normalizePublishedBranch(request.publishedBranch);
  const pullRequest = normalizePullRequest(request.pullRequest);
  const publishedRepositoryPath = path.normalize(publishedBranch.repositoryPath);
  const pullRequestRepositoryPath = path.normalize(pullRequest.repositoryPath);

  if (publishedRepositoryPath !== pullRequestRepositoryPath) {
    throw new PullRequestRequestError(
      "Published branch and pull request must target the same repository.",
      400,
    );
  }

  if (publishedBranch.branchName !== pullRequest.branchName) {
    throw new PullRequestRequestError(
      "Published branch and pull request must target the same branch.",
      400,
    );
  }

  const repository = normalizeRepositoryTarget(publishedRepositoryPath, options.cwd);

  return {
    publishedBranch: {
      ...publishedBranch,
      repositoryPath: repository.repositoryPath,
    },
    pullRequest: {
      ...pullRequest,
      repositoryPath: repository.repositoryPath,
    },
    repositoryName: repository.repositoryName,
    repositoryPath: repository.repositoryPath,
  };
}

export function validatePullRequestListRequest(
  payload: unknown,
  options: ValidatePullRequestRequestOptions = {},
): ValidatedPullRequestListRequest {
  const request = asRecord(payload, "The pull-request query payload");
  const repository = normalizeRepositoryTarget(
    readRequiredString(request.repositoryPath, "repositoryPath"),
    options.cwd,
  );

  return {
    ...repository,
    state: readPullRequestState(request.state, "state") ?? "open",
    baseBranch: readOptionalNonEmptyString(request.baseBranch, "baseBranch"),
    headBranch: readOptionalNonEmptyString(request.headBranch, "headBranch"),
  };
}

export function validatePullRequestEditRequest(
  payload: unknown,
  options: ValidatePullRequestRequestOptions = {},
): ValidatedPullRequestEditRequest {
  const request = asRecord(payload, "The pull-request edit payload");
  const repository = normalizeRepositoryTarget(
    readRequiredString(request.repositoryPath, "repositoryPath"),
    options.cwd,
  );
  const branchName = readRequiredString(request.branchName, "branchName");
  const baseBranch = readOptionalNonEmptyString(request.baseBranch, "baseBranch");
  const title = readOptionalNonEmptyString(request.title, "title");
  const body = readOptionalString(request.body, "body");
  const draft = readOptionalBoolean(request.draft, "draft");

  if (baseBranch === branchName) {
    throw new PullRequestRequestError("Pull requests must target a different base branch.", 400);
  }

  if (
    title === undefined &&
    body === undefined &&
    baseBranch === undefined &&
    draft === undefined
  ) {
    throw new PullRequestRequestError("At least one editable field must be provided.", 400);
  }

  return {
    ...repository,
    branchName,
    title,
    body,
    baseBranch,
    draft,
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
    throw new PullRequestRequestError(
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

function normalizePullRequest(value: unknown): SynchronizeGitPlatformPullRequestArgs {
  const record = asRecord(value, "The pullRequest payload");
  const repositoryPath = readRequiredString(record.repositoryPath, "pullRequest.repositoryPath");
  const branchName = readRequiredString(record.branchName, "pullRequest.branchName");
  const baseBranch = readRequiredString(record.baseBranch, "pullRequest.baseBranch");
  const title = readRequiredString(record.title, "pullRequest.title");
  const body = readString(record.body, "pullRequest.body");
  const draft = readOptionalBoolean(record.draft, "pullRequest.draft");

  if (branchName === baseBranch) {
    throw new PullRequestRequestError("Pull requests must target a different base branch.", 400);
  }

  return {
    repositoryPath,
    branchName,
    baseBranch,
    title,
    body,
    draft: draft ?? false,
    remoteName: readOptionalString(record.remoteName, "pullRequest.remoteName"),
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
    throw new PullRequestRequestError(
      `Repository path ${repositoryPath} is outside the configured ugit repository root.`,
      400,
    );
  }

  if (!existsSync(path.join(repositoryPath, ".git"))) {
    throw new PullRequestRequestError(
      `ugit repository ${repositoryPath} does not exist on the server.`,
      404,
    );
  }

  return {
    repositoryName: path.basename(repositoryPath),
    repositoryPath,
  };
}

function readPullRequestState(value: unknown, label: string): PullRequestListState | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const state = readString(value, label);

  if (state === "open" || state === "merged" || state === "all") {
    return state;
  }

  throw new PullRequestRequestError(`${label} must be one of "open", "merged", or "all".`, 400);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PullRequestRequestError(`${label} must be a JSON object.`, 400);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string): string {
  const stringValue = readString(value, label);

  if (stringValue.trim().length === 0) {
    throw new PullRequestRequestError(`${label} must be a non-empty string.`, 400);
  }

  return stringValue;
}

function readOptionalNonEmptyString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return readRequiredString(value, label);
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return readString(value, label);
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new PullRequestRequestError(`${label} must be a string.`, 400);
  }

  return value;
}

function readOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new PullRequestRequestError(`${label} must be a boolean when provided.`, 400);
  }

  return value;
}
