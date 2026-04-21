import "server-only";

import { execFileSync } from "node:child_process";
import {
  combineCommandOutput,
  runAsyncCommand,
  type AsyncCommandRunner,
  type CommandExecutionResult,
} from "@/lib/pr-runner/process";
import type { PullRequestGitHubDelegation } from "@/packages/ugit-cli/src/pull-request-contract";

const GITHUB_HOSTNAME = "github.com";
const GITHUB_CLI_UNAVAILABLE_MESSAGE =
  "GitHub CLI is unavailable on the ugit server. Install gh, run gh auth login, and verify gh auth status.";
const GITHUB_CLI_AUTH_MESSAGE =
  "GitHub CLI is not authenticated for this repository. Run gh auth login on the ugit server and verify gh auth status.";
const GITHUB_CLI_STATUS_GUIDANCE =
  "Verify gh auth status on the ugit server and check server logs if the problem persists.";

export type GitCommandRunner = (
  file: string,
  args: readonly string[],
  options?: Readonly<{
    encoding?: "utf8";
  }>,
) => string;

export type GitHubCommandRunner = AsyncCommandRunner;

type GitHubRemote = Readonly<{
  name: string;
  repositoryUrl: string;
}>;

export type GitHubRepositoryContext = Readonly<{
  remoteName: string;
  repositoryUrl: string;
  owner: string;
  repository: string;
}>;

export type CanonicalGitHubPullRequest = Readonly<{
  number: number;
  url: string;
  mergeable: boolean | null;
  headBranch: string;
  headCommitHash: string;
  baseBranch: string;
  baseCommitHash: string;
}>;

export type ReadCanonicalGitHubPullRequestResult =
  | Readonly<{
      status: "available";
      repository: GitHubRepositoryContext;
      pullRequest: CanonicalGitHubPullRequest;
      message: null;
    }>
  | Readonly<{
      status: "unavailable";
      repository: GitHubRepositoryContext | null;
      pullRequest: null;
      message: string;
    }>;

class GitHubCommandError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "GitHubCommandError";
  }
}

export class GitHubPullRequestMergeError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "GitHubPullRequestMergeError";
  }
}

type GitHubPullRequestListItem = Readonly<{
  number?: unknown;
  headRefName?: unknown;
  baseRefName?: unknown;
  headRepositoryOwner?: unknown;
}>;

type GitHubMergeResponse = Readonly<{
  merged?: unknown;
  message?: unknown;
  sha?: unknown;
}>;

export function buildPullRequestGitHubDelegation(
  options: Readonly<{
    repositoryPath: string;
    branchName: string;
    baseBranch: string;
    preferredRemoteName?: string | null;
    pullRequestUrl?: string | null;
    runGit?: GitCommandRunner;
  }>,
): PullRequestGitHubDelegation {
  const repository = resolveGitHubRepositoryContext(
    options.repositoryPath,
    options.preferredRemoteName,
    options.runGit,
  );

  if (!repository) {
    return {
      state: "unavailable",
      url: null,
      remoteName: null,
      repositoryUrl: null,
      actionLabel: "Open on GitHub",
      message: "GitHub remote metadata is unavailable for this repository.",
    };
  }

  if (options.pullRequestUrl) {
    return {
      state: "pull_request",
      url: options.pullRequestUrl,
      remoteName: repository.remoteName,
      repositoryUrl: repository.repositoryUrl,
      actionLabel: "Open on GitHub",
      message: "Open the canonical GitHub pull request for this branch.",
    };
  }

  const compareUrl = new URL(
    `${repository.repositoryUrl}/compare/${encodeURIComponent(options.baseBranch)}...${encodeURIComponent(options.branchName)}`,
  );
  compareUrl.searchParams.set("expand", "1");

  return {
    state: "compare",
    url: compareUrl.toString(),
    remoteName: repository.remoteName,
    repositoryUrl: repository.repositoryUrl,
    actionLabel: "Open on GitHub",
    message: "Open the best-effort GitHub compare view for this pull request.",
  };
}

export function resolveGitHubRepositoryContext(
  repositoryPath: string,
  preferredRemoteName: string | null | undefined,
  runGit: GitCommandRunner = defaultRunGitCommand,
): GitHubRepositoryContext | null {
  const remote = selectGitHubRemote(repositoryPath, preferredRemoteName, runGit);

  if (!remote) {
    return null;
  }

  const coordinates = parseGitHubRepositoryCoordinates(remote.repositoryUrl);

  if (!coordinates) {
    return null;
  }

  return {
    remoteName: remote.name,
    repositoryUrl: remote.repositoryUrl,
    owner: coordinates.owner,
    repository: coordinates.repository,
  };
}

export async function readCanonicalGitHubPullRequest(
  options: Readonly<{
    repositoryPath: string;
    branchName: string;
    baseBranch: string;
    preferredRemoteName?: string | null;
    repository?: GitHubRepositoryContext | null;
    runGit?: GitCommandRunner;
    runCommand?: GitHubCommandRunner;
  }>,
): Promise<ReadCanonicalGitHubPullRequestResult> {
  const repository =
    options.repository ??
    resolveGitHubRepositoryContext(
      options.repositoryPath,
      options.preferredRemoteName,
      options.runGit,
    );

  if (!repository) {
    return {
      status: "unavailable",
      repository: null,
      pullRequest: null,
      message: "GitHub remote metadata is unavailable for this repository.",
    };
  }

  try {
    const pullRequestList = await runGhJsonCommand({
      args: [
        "pr",
        "list",
        "-R",
        formatGitHubRepositoryTarget(repository),
        "--state",
        "open",
        "--base",
        options.baseBranch,
        "--head",
        options.branchName,
        "--json",
        "number,headRefName,baseRefName,headRepositoryOwner",
        "--limit",
        "30",
      ],
      runCommand: options.runCommand,
      fallbackMessage: `GitHub pull-request metadata is unavailable for ${options.branchName} targeting ${options.baseBranch}.`,
      malformedJsonMessage:
        "GitHub CLI returned malformed JSON while reading pull-request metadata. " +
        GITHUB_CLI_STATUS_GUIDANCE,
    });
    const pullRequestNumber = selectCanonicalGitHubPullRequestNumber(pullRequestList, {
      repository,
      branchName: options.branchName,
      baseBranch: options.baseBranch,
    });

    if (pullRequestNumber === null) {
      return {
        status: "unavailable",
        repository,
        pullRequest: null,
        message: `GitHub pull-request metadata is unavailable for ${options.branchName} targeting ${options.baseBranch}.`,
      };
    }

    const pullRequestDetail = await runGhJsonCommand({
      args: [
        "pr",
        "view",
        String(pullRequestNumber),
        "-R",
        formatGitHubRepositoryTarget(repository),
        "--json",
        "number,url,mergeable,headRefName,headRefOid,baseRefName,baseRefOid",
      ],
      runCommand: options.runCommand,
      fallbackMessage: `GitHub pull-request metadata is unavailable for ${options.branchName} targeting ${options.baseBranch}.`,
      malformedJsonMessage:
        "GitHub CLI returned malformed JSON while reading pull-request metadata. " +
        GITHUB_CLI_STATUS_GUIDANCE,
    });

    return {
      status: "available",
      repository,
      pullRequest: parseCanonicalGitHubPullRequest(pullRequestDetail, {
        branchName: options.branchName,
        baseBranch: options.baseBranch,
      }),
      message: null,
    };
  } catch (error) {
    return {
      status: "unavailable",
      repository,
      pullRequest: null,
      message:
        error instanceof Error
          ? error.message
          : `GitHub pull-request metadata is unavailable for ${options.branchName} targeting ${options.baseBranch}.`,
    };
  }
}

export async function squashMergeGitHubPullRequest(
  options: Readonly<{
    repository: GitHubRepositoryContext;
    pullRequestNumber: number;
    expectedHeadCommitHash: string;
    runCommand?: GitHubCommandRunner;
  }>,
): Promise<
  Readonly<{
    message: string;
    mergeCommitHash: string | null;
  }>
> {
  try {
    const payload = await runGhJsonCommand({
      args: [
        "api",
        "--hostname",
        readGitHubHostname(options.repository),
        "--method",
        "PUT",
        `repos/${options.repository.owner}/${options.repository.repository}/pulls/${options.pullRequestNumber}/merge`,
        "-f",
        "merge_method=squash",
        "-f",
        `sha=${options.expectedHeadCommitHash}`,
      ],
      runCommand: options.runCommand,
      fallbackMessage: "GitHub rejected the squash merge request.",
      malformedJsonMessage:
        "GitHub CLI returned malformed JSON while requesting the squash merge. " +
        GITHUB_CLI_STATUS_GUIDANCE,
    });
    const response = parseGitHubMergeResponse(payload);
    const message =
      readTrimmedString(response.message) ?? "GitHub accepted the squash merge request.";

    if (response.merged !== true) {
      throw new GitHubPullRequestMergeError(message, 503);
    }

    return {
      message,
      mergeCommitHash: readTrimmedString(response.sha) ?? null,
    };
  } catch (error) {
    if (error instanceof GitHubPullRequestMergeError) {
      throw error;
    }

    if (error instanceof GitHubCommandError) {
      throw new GitHubPullRequestMergeError(error.message, error.statusCode);
    }

    throw error;
  }
}

function selectGitHubRemote(
  repositoryPath: string,
  preferredRemoteName: string | null | undefined,
  runGit: GitCommandRunner = defaultRunGitCommand,
): GitHubRemote | null {
  const remotes = readGitHubRemotes(repositoryPath, runGit);

  if (remotes.length === 0) {
    return null;
  }

  const preferredRemoteOrder = ["upstream", preferredRemoteName, "origin"].filter(
    (remoteName): remoteName is string => typeof remoteName === "string" && remoteName.length > 0,
  );

  for (const remoteName of preferredRemoteOrder) {
    const remote = remotes.find((candidate) => candidate.name === remoteName);

    if (remote) {
      return remote;
    }
  }

  return remotes[0] ?? null;
}

function readGitHubRemotes(
  repositoryPath: string,
  runGit: GitCommandRunner,
): readonly GitHubRemote[] {
  try {
    const output = runGit(
      "git",
      ["-C", repositoryPath, "config", "--get-regexp", "^remote\\..*\\.url$"],
      {
        encoding: "utf8",
      },
    );

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        const match = /^remote\.(.+)\.url\s+(.+)$/.exec(line);

        if (!match) {
          return [];
        }

        const repositoryUrl = normalizeGitHubRepositoryUrl(match[2]);

        if (!repositoryUrl) {
          return [];
        }

        return [
          {
            name: match[1],
            repositoryUrl,
          },
        ];
      });
  } catch {
    return [];
  }
}

function normalizeGitHubRepositoryUrl(remoteUrl: string): string | null {
  const sshMatch = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(remoteUrl);

  if (sshMatch) {
    return `https://${GITHUB_HOSTNAME}/${sshMatch[1]}/${sshMatch[2]}`;
  }

  try {
    const url = new URL(remoteUrl);

    if (url.hostname !== GITHUB_HOSTNAME) {
      return null;
    }

    const [owner, repository] = url.pathname
      .replace(/^\/+/, "")
      .replace(/\.git$/, "")
      .split("/");

    if (!owner || !repository) {
      return null;
    }

    return `https://${GITHUB_HOSTNAME}/${owner}/${repository}`;
  } catch {
    return null;
  }
}

function parseGitHubRepositoryCoordinates(repositoryUrl: string): Readonly<{
  owner: string;
  repository: string;
}> | null {
  try {
    const url = new URL(repositoryUrl);
    const [owner, repository] = url.pathname.replace(/^\/+/, "").split("/");

    if (!owner || !repository) {
      return null;
    }

    return {
      owner,
      repository,
    };
  } catch {
    return null;
  }
}

async function runGhJsonCommand(
  options: Readonly<{
    args: readonly string[];
    runCommand?: GitHubCommandRunner;
    fallbackMessage: string;
    malformedJsonMessage: string;
  }>,
): Promise<unknown> {
  const result = await runGhCommand(options);

  try {
    return JSON.parse(result.stdout) as unknown;
  } catch {
    throw new GitHubCommandError(options.malformedJsonMessage, 503);
  }
}

async function runGhCommand(
  options: Readonly<{
    args: readonly string[];
    runCommand?: GitHubCommandRunner;
    fallbackMessage: string;
  }>,
): Promise<CommandExecutionResult> {
  const runCommand = options.runCommand ?? runAsyncCommand;

  try {
    const result = await runCommand("gh", options.args);

    if (result.exitCode !== 0) {
      throw buildGitHubCommandError(result, options.fallbackMessage);
    }

    return result;
  } catch (error) {
    if (error instanceof GitHubCommandError) {
      throw error;
    }

    throw buildGitHubCommandStartError(error);
  }
}

function buildGitHubCommandError(
  result: CommandExecutionResult,
  fallbackMessage: string,
): GitHubCommandError {
  const output = combineCommandOutput(result);

  if (looksLikeMissingGitHubCli(output)) {
    return new GitHubCommandError(GITHUB_CLI_UNAVAILABLE_MESSAGE, 503);
  }

  if (looksLikeGitHubCliAuthFailure(output)) {
    return new GitHubCommandError(GITHUB_CLI_AUTH_MESSAGE, 503);
  }

  return new GitHubCommandError(
    extractGitHubCommandMessage(result) ?? fallbackMessage,
    extractGitHubHttpStatus(output) ?? 503,
  );
}

function buildGitHubCommandStartError(error: unknown): GitHubCommandError {
  if (looksLikeMissingGitHubCli(error)) {
    return new GitHubCommandError(GITHUB_CLI_UNAVAILABLE_MESSAGE, 503);
  }

  return new GitHubCommandError(GITHUB_CLI_UNAVAILABLE_MESSAGE, 503);
}

function looksLikeMissingGitHubCli(candidate: unknown): boolean {
  const text = String(
    candidate instanceof Error
      ? [candidate.message, readErrorCode(candidate), candidate.cause].filter(Boolean).join("\n")
      : (candidate ?? ""),
  ).toLowerCase();

  return (
    text.includes("failed to start gh") ||
    text.includes("enoent") ||
    text.includes("command not found") ||
    text.includes("executable file not found")
  );
}

function looksLikeGitHubCliAuthFailure(output: string): boolean {
  const normalizedOutput = output.toLowerCase();

  return (
    normalizedOutput.includes("gh auth login") ||
    normalizedOutput.includes("not logged into any github hosts") ||
    normalizedOutput.includes("authentication failed") ||
    normalizedOutput.includes("authentication required") ||
    normalizedOutput.includes("requires authentication")
  );
}

function extractGitHubCommandMessage(
  result: Pick<CommandExecutionResult, "stdout" | "stderr">,
): string | null {
  const jsonMessage = extractGitHubJsonMessage(result.stdout);

  if (jsonMessage) {
    return jsonMessage;
  }

  const output = combineCommandOutput(result);

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine
      .trim()
      .replace(/^gh:\s*/i, "")
      .replace(/\s*\(http \d+\)\s*$/i, "")
      .trim();

    if (line.length > 0) {
      return line;
    }
  }

  return null;
}

function extractGitHubJsonMessage(output: string): string | null {
  if (output.trim().length === 0) {
    return null;
  }

  try {
    const payload = JSON.parse(output) as { message?: unknown };

    return readTrimmedString(payload.message);
  } catch {
    return null;
  }
}

function extractGitHubHttpStatus(output: string): number | null {
  const match = /http\s+(\d{3})/i.exec(output);

  if (!match) {
    return null;
  }

  const statusCode = Number.parseInt(match[1], 10);

  return Number.isFinite(statusCode) ? statusCode : null;
}

function selectCanonicalGitHubPullRequestNumber(
  payload: unknown,
  options: Readonly<{
    repository: GitHubRepositoryContext;
    branchName: string;
    baseBranch: string;
  }>,
): number | null {
  if (!Array.isArray(payload)) {
    throw new GitHubCommandError(
      "GitHub CLI returned malformed JSON while reading pull-request metadata. " +
        GITHUB_CLI_STATUS_GUIDANCE,
      503,
    );
  }

  for (const item of payload as readonly GitHubPullRequestListItem[]) {
    const headRepositoryOwner = readGitHubOwnerLogin(item.headRepositoryOwner);

    if (
      readFiniteNumber(item.number) !== null &&
      readTrimmedString(item.headRefName) === options.branchName &&
      readTrimmedString(item.baseRefName) === options.baseBranch &&
      headRepositoryOwner === options.repository.owner
    ) {
      return readFiniteNumber(item.number);
    }
  }

  return null;
}

function parseCanonicalGitHubPullRequest(
  payload: unknown,
  options: Readonly<{
    branchName: string;
    baseBranch: string;
  }>,
): CanonicalGitHubPullRequest {
  if (!isRecord(payload)) {
    throw new GitHubCommandError(
      buildIncompleteGitHubMetadataMessage(options.branchName, options.baseBranch),
      503,
    );
  }

  const number = readFiniteNumber(payload.number);
  const url = readTrimmedString(payload.url);
  const headBranch = readTrimmedString(payload.headRefName);
  const headCommitHash = readTrimmedString(payload.headRefOid);
  const baseBranch = readTrimmedString(payload.baseRefName);
  const baseCommitHash = readTrimmedString(payload.baseRefOid);
  const mergeable = normalizeGitHubMergeable(payload.mergeable);

  if (
    number === null ||
    !url ||
    !headBranch ||
    !headCommitHash ||
    !baseBranch ||
    !baseCommitHash ||
    mergeable === undefined
  ) {
    throw new GitHubCommandError(
      buildIncompleteGitHubMetadataMessage(options.branchName, options.baseBranch),
      503,
    );
  }

  return {
    number,
    url,
    mergeable,
    headBranch,
    headCommitHash,
    baseBranch,
    baseCommitHash,
  };
}

function parseGitHubMergeResponse(payload: unknown): GitHubMergeResponse {
  if (!isRecord(payload)) {
    throw new GitHubPullRequestMergeError(
      "GitHub CLI returned malformed JSON while requesting the squash merge. " +
        GITHUB_CLI_STATUS_GUIDANCE,
      503,
    );
  }

  return payload as GitHubMergeResponse;
}

function normalizeGitHubMergeable(value: unknown): boolean | null | undefined {
  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  switch (value.toUpperCase()) {
    case "MERGEABLE":
      return true;
    case "UNKNOWN":
      return null;
    case "CONFLICTING":
    case "UNMERGEABLE":
      return false;
    default:
      return undefined;
  }
}

function readGitHubOwnerLogin(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim().length > 0 ? value.trim() : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  return readTrimmedString(value.login);
}

function readGitHubHostname(repository: GitHubRepositoryContext): string {
  try {
    return new URL(repository.repositoryUrl).hostname;
  } catch {
    return GITHUB_HOSTNAME;
  }
}

function formatGitHubRepositoryTarget(repository: GitHubRepositoryContext): string {
  return `${repository.owner}/${repository.repository}`;
}

function buildIncompleteGitHubMetadataMessage(branchName: string, baseBranch: string): string {
  return (
    `GitHub pull-request metadata is incomplete for ${branchName} targeting ${baseBranch}. ` +
    GITHUB_CLI_STATUS_GUIDANCE
  );
}

function readTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function readErrorCode(error: Error): string {
  const code =
    "code" in error && typeof error.code === "string"
      ? error.code
      : isRecord(error.cause) && typeof error.cause.code === "string"
        ? error.cause.code
        : "";

  return code;
}

const defaultRunGitCommand: GitCommandRunner = (file, args, options) =>
  execFileSync(file, args, {
    encoding: options?.encoding ?? "utf8",
  });
