import "server-only";

import { execFileSync } from "node:child_process";
import type { PullRequestGitHubDelegation } from "@/packages/ugit-cli/src/pull-request-contract";

const GITHUB_API_ORIGIN = "https://api.github.com";
const GITHUB_TOKEN_ENV_NAME = "UGIT_GITHUB_TOKEN";

export type GitCommandRunner = (
  file: string,
  args: readonly string[],
  options?: Readonly<{
    encoding?: "utf8";
  }>,
) => string;

export type GitHubFetch = typeof fetch;

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
  number: number;
  html_url: string;
}>;

type GitHubPullRequestResponse = Readonly<{
  number: number;
  html_url: string;
  mergeable: boolean | null;
  head: Readonly<{
    ref: string;
    sha: string;
  }>;
  base: Readonly<{
    ref: string;
    sha: string;
  }>;
}>;

type GitHubMergeResponse = Readonly<{
  merged?: boolean;
  message?: string;
  sha?: string;
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
    fetchImpl?: GitHubFetch;
    token?: string | null;
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

  const token = resolveGitHubToken(options.token);

  if (!token) {
    return {
      status: "unavailable",
      repository,
      pullRequest: null,
      message: `Set ${GITHUB_TOKEN_ENV_NAME} on the ugit server to enable GitHub merge checks.`,
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const searchParams = new URLSearchParams({
    state: "open",
    head: `${repository.owner}:${options.branchName}`,
    base: options.baseBranch,
    per_page: "1",
  });

  try {
    const pullRequests = await requestGitHubJson<readonly GitHubPullRequestListItem[]>(
      fetchImpl,
      `/repos/${repository.owner}/${repository.repository}/pulls?${searchParams.toString()}`,
      {
        method: "GET",
        token,
      },
    );
    const pullRequest = pullRequests[0];

    if (!pullRequest) {
      return {
        status: "unavailable",
        repository,
        pullRequest: null,
        message: `GitHub pull-request metadata is unavailable for ${options.branchName} targeting ${options.baseBranch}.`,
      };
    }

    const detail = await requestGitHubJson<GitHubPullRequestResponse>(
      fetchImpl,
      `/repos/${repository.owner}/${repository.repository}/pulls/${pullRequest.number}`,
      {
        method: "GET",
        token,
      },
    );

    return {
      status: "available",
      repository,
      pullRequest: {
        number: detail.number,
        url: detail.html_url,
        mergeable: detail.mergeable,
        headBranch: detail.head.ref,
        headCommitHash: detail.head.sha,
        baseBranch: detail.base.ref,
        baseCommitHash: detail.base.sha,
      },
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
          : "GitHub pull-request metadata is unavailable for this branch.",
    };
  }
}

export async function squashMergeGitHubPullRequest(
  options: Readonly<{
    repository: GitHubRepositoryContext;
    pullRequestNumber: number;
    expectedHeadCommitHash: string;
    fetchImpl?: GitHubFetch;
    token?: string | null;
  }>,
): Promise<
  Readonly<{
    message: string;
    mergeCommitHash: string | null;
  }>
> {
  const token = resolveGitHubToken(options.token);

  if (!token) {
    throw new GitHubPullRequestMergeError(
      `Set ${GITHUB_TOKEN_ENV_NAME} on the ugit server to enable GitHub merges.`,
      503,
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    new URL(
      `/repos/${options.repository.owner}/${options.repository.repository}/pulls/${options.pullRequestNumber}/merge`,
      GITHUB_API_ORIGIN,
    ),
    {
      method: "PUT",
      headers: buildGitHubHeaders(token, true),
      body: JSON.stringify({
        merge_method: "squash",
        sha: options.expectedHeadCommitHash,
      }),
    },
  );
  const payload = await readGitHubResponseBody<GitHubMergeResponse>(response);
  const message =
    typeof payload?.message === "string" && payload.message.trim().length > 0
      ? payload.message
      : "GitHub rejected the squash merge request.";

  if (!response.ok || payload?.merged !== true) {
    throw new GitHubPullRequestMergeError(message, response.status || 500);
  }

  return {
    message,
    mergeCommitHash: typeof payload.sha === "string" && payload.sha.length > 0 ? payload.sha : null,
  };
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
    return `https://github.com/${sshMatch[1]}/${sshMatch[2]}`;
  }

  try {
    const url = new URL(remoteUrl);

    if (url.hostname !== "github.com") {
      return null;
    }

    const [owner, repository] = url.pathname
      .replace(/^\/+/, "")
      .replace(/\.git$/, "")
      .split("/");

    if (!owner || !repository) {
      return null;
    }

    return `https://github.com/${owner}/${repository}`;
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

function resolveGitHubToken(token: string | null | undefined): string | null {
  const resolvedToken = token ?? process.env[GITHUB_TOKEN_ENV_NAME];

  if (typeof resolvedToken !== "string" || resolvedToken.trim().length === 0) {
    return null;
  }

  return resolvedToken.trim();
}

function buildGitHubHeaders(token: string, withJsonBody: boolean): HeadersInit {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "ugit",
    "x-github-api-version": "2022-11-28",
    ...(withJsonBody
      ? {
          "content-type": "application/json",
        }
      : {}),
  };
}

async function requestGitHubJson<TResponse>(
  fetchImpl: GitHubFetch,
  requestPath: string,
  options: Readonly<{
    method: "GET" | "PUT";
    token: string;
    body?: string;
  }>,
): Promise<TResponse> {
  const response = await fetchImpl(new URL(requestPath, GITHUB_API_ORIGIN), {
    method: options.method,
    headers: buildGitHubHeaders(options.token, Boolean(options.body)),
    body: options.body,
  });
  const payload = await readGitHubResponseBody<TResponse & { message?: string }>(response);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `GitHub request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload;
}

async function readGitHubResponseBody<TResponse>(response: Response): Promise<TResponse> {
  const responseText = await response.text();

  if (responseText.trim().length === 0) {
    return {} as TResponse;
  }

  try {
    return JSON.parse(responseText) as TResponse;
  } catch {
    throw new Error(`GitHub returned malformed JSON with status ${response.status}.`);
  }
}

const defaultRunGitCommand: GitCommandRunner = (file, args, options) =>
  execFileSync(file, args, {
    encoding: options?.encoding ?? "utf8",
  });
