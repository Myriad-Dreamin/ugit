import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { getRepositoriesRoot } from "@/lib/repositories";
import type {
  GitPlatformPublishedBranch,
  SynchronizeGitPlatformPullRequestArgs,
} from "@/packages/ugit-cli/src/pull-request-contract";

const COMMIT_HASH_PATTERN = /^[0-9a-f]{7,64}$/i;

export class PullRequestSyncError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PullRequestSyncError";
  }
}

export type ValidatedPullRequestSyncRequest = Readonly<{
  publishedBranch: GitPlatformPublishedBranch;
  pullRequest: SynchronizeGitPlatformPullRequestArgs;
  repositoryName: string;
  repositoryPath: string;
}>;

export type ValidatePullRequestSyncRequestOptions = Readonly<{
  cwd?: string;
}>;

export function validatePullRequestSyncRequest(
  payload: unknown,
  options: ValidatePullRequestSyncRequestOptions = {},
): ValidatedPullRequestSyncRequest {
  const repositoriesRoot = getRepositoriesRoot(options.cwd);
  const request = asRecord(payload, "The pull-request synchronization payload");
  const publishedBranch = normalizePublishedBranch(request.publishedBranch);
  const pullRequest = normalizePullRequest(request.pullRequest);

  if (publishedBranch.repositoryPath !== pullRequest.repositoryPath) {
    throw new PullRequestSyncError(
      "Published branch and pull request must target the same repository.",
      400,
    );
  }

  if (publishedBranch.branchName !== pullRequest.branchName) {
    throw new PullRequestSyncError(
      "Published branch and pull request must target the same branch.",
      400,
    );
  }

  const repositoryPath = path.normalize(publishedBranch.repositoryPath);
  const relativeRepositoryPath = path.relative(repositoriesRoot, repositoryPath);

  if (
    !path.isAbsolute(repositoryPath) ||
    relativeRepositoryPath.startsWith("..") ||
    path.isAbsolute(relativeRepositoryPath)
  ) {
    throw new PullRequestSyncError(
      `Repository path ${repositoryPath} is outside the configured ugit repository root.`,
      400,
    );
  }

  const repositoryName = path.basename(repositoryPath);

  if (!existsSync(path.join(repositoryPath, ".git"))) {
    throw new PullRequestSyncError(
      `ugit repository ${repositoryPath} does not exist on the server.`,
      404,
    );
  }

  return {
    publishedBranch: {
      ...publishedBranch,
      repositoryPath,
    },
    pullRequest: {
      ...pullRequest,
      repositoryPath,
    },
    repositoryName,
    repositoryPath,
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
    throw new PullRequestSyncError(
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
    throw new PullRequestSyncError("Pull requests must target a different base branch.", 400);
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

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PullRequestSyncError(`${label} must be a JSON object.`, 400);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string): string {
  const stringValue = readString(value, label);

  if (stringValue.trim().length === 0) {
    throw new PullRequestSyncError(`${label} must be a non-empty string.`, 400);
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
    throw new PullRequestSyncError(`${label} must be a string.`, 400);
  }

  return value;
}

function readOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new PullRequestSyncError(`${label} must be a boolean when provided.`, 400);
  }

  return value;
}
