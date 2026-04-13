import path from "node:path";
import type { ResolvedMachine } from "./config";
import {
  PULL_REQUEST_SYNC_PATH,
  type GitPlatformPublishedBranch,
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

export type PublishCurrentBranchOptions = Readonly<{
  repositoryPath: string;
  remoteName?: string;
  runCommand?: CommandRunner;
  now?: () => Date;
}>;

export type SynchronizePullRequestOptions = Readonly<{
  machine: ResolvedMachine;
  repositoryPath: string;
  baseBranch: string;
  title: string;
  body: string;
  draft?: boolean;
  remoteName?: string;
  localPort?: number;
  runCommand?: CommandRunner;
  spawnCommand?: SpawnCommand;
  fetchImpl?: typeof fetch;
  now?: () => Date;
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
    repositoryPath: resolveRemoteRepositoryPath(
      readRequiredRemoteUrl(options.repositoryPath, remoteName, runCommand),
    ),
    branchName,
    commitHash,
    remoteName,
    pushedAt: (options.now ?? (() => new Date()))().toISOString(),
  };
}

export async function synchronizePullRequest(
  options: SynchronizePullRequestOptions,
): Promise<SynchronizePullRequestResult> {
  const remoteName = options.remoteName ?? DEFAULT_REMOTE_NAME;
  const fetchImpl = options.fetchImpl ?? fetch;
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

  const response = await withMachineServer(
    options.machine,
    {
      localPort: options.localPort,
      spawnCommand: options.spawnCommand,
    },
    async ({ baseUrl }) => {
      const syncResponse = await fetchImpl(`${baseUrl}${PULL_REQUEST_SYNC_PATH}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!syncResponse.ok) {
        const responseText = await syncResponse.text();
        throw new Error(
          `Pull-request synchronization failed with status ${syncResponse.status}: ${responseText}`,
        );
      }

      return (await syncResponse.json()) as SynchronizePullRequestResponse;
    },
  );

  return {
    payload,
    publishedBranch,
    response,
  };
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
