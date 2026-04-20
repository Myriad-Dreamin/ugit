import "server-only";

import { execFileSync } from "node:child_process";
import type { PullRequestGitHubDelegation } from "@/packages/ugit-cli/src/pull-request-contract";

export type GitCommandRunner = (
  file: string,
  args: readonly string[],
  options?: Readonly<{
    encoding?: "utf8";
  }>,
) => string;

type GitHubRemote = Readonly<{
  name: string;
  repositoryUrl: string;
}>;

export function buildPullRequestGitHubDelegation(
  options: Readonly<{
    repositoryPath: string;
    branchName: string;
    baseBranch: string;
    preferredRemoteName?: string | null;
    runGit?: GitCommandRunner;
  }>,
): PullRequestGitHubDelegation {
  const remote = selectGitHubRemote(
    options.repositoryPath,
    options.preferredRemoteName,
    options.runGit,
  );

  if (!remote) {
    return {
      state: "unavailable",
      url: null,
      remoteName: null,
      repositoryUrl: null,
      actionLabel: "Open on GitHub",
      message: "GitHub remote metadata is unavailable for this repository.",
    };
  }

  const compareUrl = new URL(
    `${remote.repositoryUrl}/compare/${encodeURIComponent(options.baseBranch)}...${encodeURIComponent(options.branchName)}`,
  );
  compareUrl.searchParams.set("expand", "1");

  return {
    state: "compare",
    url: compareUrl.toString(),
    remoteName: remote.name,
    repositoryUrl: remote.repositoryUrl,
    actionLabel: "Open on GitHub",
    message: "Open the best-effort GitHub compare view for this pull request.",
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

const defaultRunGitCommand: GitCommandRunner = (file, args, options) =>
  execFileSync(file, args, {
    encoding: options?.encoding ?? "utf8",
  });
