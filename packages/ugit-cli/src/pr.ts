import path from "node:path";
import type { ResolvedMachine } from "./config";
import {
  PULL_REQUESTS_PATH,
  PULL_REQUEST_SYNC_PATH,
  type EditPullRequestRequest,
  type EditPullRequestResponse,
  type GitPlatformPublishedBranch,
  type ListPullRequestsResponse,
  type PullRequestListState,
  type PullRequestSummary,
  type SynchronizeGitPlatformPullRequestArgs,
  type SynchronizePullRequestRequest,
  type SynchronizePullRequestResponse,
} from "./pull-request-contract";
import {
  readCurrentBranch,
  readHeadCommit,
  readRequiredRemoteUrl,
  runGit,
  runLocalCommand,
  type CommandRunner,
} from "./git";
import { withMachineServer, type SpawnCommand } from "./transport";

const DEFAULT_REMOTE_NAME = "origin";

type PullRequestServerOptions = Readonly<{
  machine: ResolvedMachine;
  localPort?: number;
  spawnCommand?: SpawnCommand;
  fetchImpl?: typeof fetch;
}>;

export type PublishCurrentBranchOptions = Readonly<{
  repositoryPath: string;
  remoteName?: string;
  runCommand?: CommandRunner;
  now?: () => Date;
}>;

export type ListPullRequestsOptions = PullRequestServerOptions &
  Readonly<{
    repositoryPath: string;
    state?: PullRequestListState;
    baseBranch?: string;
    headBranch?: string;
    remoteName?: string;
    runCommand?: CommandRunner;
  }>;

export type SynchronizePullRequestOptions = PullRequestServerOptions &
  Readonly<{
    repositoryPath: string;
    baseBranch: string;
    title: string;
    body: string;
    draft?: boolean;
    remoteName?: string;
    runCommand?: CommandRunner;
    now?: () => Date;
  }>;

export type EditPullRequestOptions = PullRequestServerOptions &
  Readonly<{
    repositoryPath: string;
    branchName?: string;
    title?: string;
    body?: string;
    baseBranch?: string;
    draft?: boolean;
    remoteName?: string;
    runCommand?: CommandRunner;
  }>;

export type SynchronizePullRequestResult = Readonly<{
  payload: SynchronizePullRequestRequest;
  publishedBranch: GitPlatformPublishedBranch;
  response: SynchronizePullRequestResponse;
}>;

export function publishCurrentBranch(
  options: PublishCurrentBranchOptions,
): GitPlatformPublishedBranch {
  const runCommand = options.runCommand ?? runLocalCommand;
  const remoteName = options.remoteName ?? DEFAULT_REMOTE_NAME;
  const branchName = readCurrentBranch(options.repositoryPath, runCommand);
  const commitHash = readHeadCommit(options.repositoryPath, runCommand);

  runGit(options.repositoryPath, ["push", remoteName, `HEAD:${branchName}`], runCommand);

  return {
    repositoryPath: resolvePullRequestRepositoryPath(
      options.repositoryPath,
      remoteName,
      runCommand,
    ),
    branchName,
    commitHash,
    remoteName,
    pushedAt: (options.now ?? (() => new Date()))().toISOString(),
  };
}

export async function listPullRequests(
  options: ListPullRequestsOptions,
): Promise<ListPullRequestsResponse> {
  const runCommand = options.runCommand ?? runLocalCommand;
  const remoteName = options.remoteName ?? DEFAULT_REMOTE_NAME;
  const searchParams = new URLSearchParams({
    repositoryPath: resolvePullRequestRepositoryPath(
      options.repositoryPath,
      remoteName,
      runCommand,
    ),
    state: options.state ?? "open",
  });

  if (options.baseBranch) {
    searchParams.set("baseBranch", options.baseBranch);
  }

  if (options.headBranch) {
    searchParams.set("headBranch", options.headBranch);
  }

  return await requestPullRequestApi<ListPullRequestsResponse>(
    `${PULL_REQUESTS_PATH}?${searchParams.toString()}`,
    { method: "GET" },
    options,
  );
}

export async function createPullRequest(
  options: SynchronizePullRequestOptions,
): Promise<SynchronizePullRequestResult> {
  const runCommand = options.runCommand ?? runLocalCommand;
  const branchName = readCurrentBranch(options.repositoryPath, runCommand);
  const existingPullRequests = await listPullRequests({
    machine: options.machine,
    repositoryPath: options.repositoryPath,
    state: "all",
    headBranch: branchName,
    remoteName: options.remoteName,
    runCommand,
    localPort: options.localPort,
    spawnCommand: options.spawnCommand,
    fetchImpl: options.fetchImpl,
  });
  const existingPullRequest = existingPullRequests.pullRequests[0];

  if (existingPullRequest) {
    throw new Error(
      `Pull request #${existingPullRequest.id} already exists for ${existingPullRequest.repositoryName}:${existingPullRequest.branchName}. Use "ugit pr edit" to update metadata or "ugit pr sync" after new commits.`,
    );
  }

  return await synchronizePullRequest(options);
}

export async function synchronizePullRequest(
  options: SynchronizePullRequestOptions,
): Promise<SynchronizePullRequestResult> {
  const remoteName = options.remoteName ?? DEFAULT_REMOTE_NAME;
  const publishedBranch = publishCurrentBranch({
    repositoryPath: options.repositoryPath,
    remoteName,
    runCommand: options.runCommand,
    now: options.now,
  });
  const pullRequest: SynchronizeGitPlatformPullRequestArgs = {
    repositoryPath: publishedBranch.repositoryPath,
    branchName: publishedBranch.branchName,
    baseBranch: options.baseBranch,
    title: options.title,
    body: options.body,
    draft: options.draft,
    remoteName,
  };
  const payload: SynchronizePullRequestRequest = {
    publishedBranch,
    pullRequest,
  };
  const response = await requestPullRequestApi<SynchronizePullRequestResponse>(
    PULL_REQUEST_SYNC_PATH,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    options,
  );

  return {
    payload,
    publishedBranch,
    response,
  };
}

export async function editPullRequest(
  options: EditPullRequestOptions,
): Promise<EditPullRequestResponse> {
  const runCommand = options.runCommand ?? runLocalCommand;
  const remoteName = options.remoteName ?? DEFAULT_REMOTE_NAME;
  const branchName = options.branchName ?? readCurrentBranch(options.repositoryPath, runCommand);

  if (
    options.title === undefined &&
    options.body === undefined &&
    options.baseBranch === undefined &&
    options.draft === undefined
  ) {
    throw new Error(
      "ugit pr edit requires at least one of --base, --title, --body, --draft, or --ready.",
    );
  }

  const payload: EditPullRequestRequest = {
    repositoryPath: resolvePullRequestRepositoryPath(
      options.repositoryPath,
      remoteName,
      runCommand,
    ),
    branchName,
    title: options.title,
    body: options.body,
    baseBranch: options.baseBranch,
    draft: options.draft,
  };

  return await requestPullRequestApi<EditPullRequestResponse>(
    PULL_REQUESTS_PATH,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    options,
  );
}

export function formatPullRequestTable(pullRequests: readonly PullRequestSummary[]): string {
  const headers = ["ID", "State", "CI", "Base", "Head", "Title"];
  const rows = pullRequests.map((pullRequest) => [
    String(pullRequest.id),
    pullRequest.state,
    pullRequest.latestJob?.status ?? "-",
    pullRequest.baseBranch,
    pullRequest.branchName,
    pullRequest.draft ? `[draft] ${pullRequest.title}` : pullRequest.title,
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]!.length)),
  );

  return [headers, ...rows]
    .map((row) =>
      row
        .map((cell, index) => cell.padEnd(widths[index]!))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

export function resolveRemoteRepositoryPath(remoteUrl: string): string {
  if (path.isAbsolute(remoteUrl)) {
    return path.normalize(remoteUrl);
  }

  try {
    return path.normalize(decodeURIComponent(new URL(remoteUrl).pathname));
  } catch (error) {
    throw new Error(`Unsupported ugit origin URL "${remoteUrl}".`, { cause: error });
  }
}

function resolvePullRequestRepositoryPath(
  repositoryPath: string,
  remoteName: string,
  runCommand: CommandRunner,
): string {
  return resolveRemoteRepositoryPath(readRequiredRemoteUrl(repositoryPath, remoteName, runCommand));
}

async function requestPullRequestApi<TResponse>(
  requestPath: string,
  requestInit: RequestInit,
  options: PullRequestServerOptions,
): Promise<TResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;

  return await withMachineServer(
    options.machine,
    {
      localPort: options.localPort,
      spawnCommand: options.spawnCommand,
    },
    async ({ baseUrl }) => {
      const response = await fetchImpl(`${baseUrl}${requestPath}`, requestInit);

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          `Pull-request request failed with status ${response.status}: ${responseText}`,
        );
      }

      return (await response.json()) as TResponse;
    },
  );
}
