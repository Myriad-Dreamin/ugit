import "server-only";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PullRequestServiceOptions } from "@/lib/pr-runner/service";
import { listPullRequests } from "@/lib/pr-runner/service";
import type { CiResultArtifact, WorkflowResultArtifact } from "@/lib/pr-runner/results";
import type { Repository } from "@/lib/repositories";
import type {
  PullRequestLatestJobSummary,
  PullRequestSummary,
} from "@/packages/ugit-cli/src/pull-request-contract";

const CI_RESULTS_ROOT = path.join(".data", "ci-results");

export type RepositoryWorkflowStatus = "queued" | "running" | "succeeded" | "failed";
export type RepositoryWorkflowPanelStatus = RepositoryWorkflowStatus | "empty" | "mixed";
export type RepositoryWorkflowSummarySource = "artifact" | "active_job";

export type RepositoryWorkflowResultSummary = Readonly<{
  name: string;
  status: WorkflowResultArtifact["status"];
}>;

export type RepositoryWorkflowBranchSummary = Readonly<{
  branchName: string;
  commitHash: string;
  status: RepositoryWorkflowStatus;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  activityAt: string;
  source: RepositoryWorkflowSummarySource;
  workflows: readonly RepositoryWorkflowResultSummary[];
}>;

export type RepositoryWorkflowPanelSummary = Readonly<{
  repositoryName: string;
  status: RepositoryWorkflowPanelStatus;
  branchSummaries: readonly RepositoryWorkflowBranchSummary[];
}>;

export type RepositoryWorkflowSummaryOptions = Pick<PullRequestServiceOptions, "cwd" | "storage">;

export function getRepositoryWorkflowPanelSummary(
  repository: Pick<Repository, "name" | "path">,
  options: RepositoryWorkflowSummaryOptions = {},
): RepositoryWorkflowPanelSummary {
  const branchSummaries = new Map<string, RepositoryWorkflowBranchSummary>();

  for (const artifactSummary of listArtifactBranchSummaries(repository.name, options.cwd)) {
    branchSummaries.set(artifactSummary.branchName, artifactSummary);
  }

  const pullRequests = listPullRequests(
    {
      repositoryPath: repository.path,
      state: "all",
    },
    {
      cwd: options.cwd,
      storage: options.storage,
    },
  ).pullRequests;

  for (const pullRequest of pullRequests) {
    const activeJobSummary = toActiveJobBranchSummary(pullRequest);

    if (!activeJobSummary) {
      continue;
    }

    const currentSummary = branchSummaries.get(activeJobSummary.branchName);

    if (!currentSummary || shouldPreferActiveJob(activeJobSummary, currentSummary)) {
      branchSummaries.set(activeJobSummary.branchName, activeJobSummary);
    }
  }

  const normalizedBranchSummaries = Array.from(branchSummaries.values()).sort(
    compareBranchSummaries,
  );

  return {
    repositoryName: repository.name,
    status: determinePanelStatus(normalizedBranchSummaries),
    branchSummaries: normalizedBranchSummaries,
  };
}

function listArtifactBranchSummaries(
  repositoryName: string,
  cwd: string = process.cwd(),
): readonly RepositoryWorkflowBranchSummary[] {
  const repositoryResultsRoot = path.resolve(cwd, CI_RESULTS_ROOT, repositoryName);

  if (!existsSync(repositoryResultsRoot)) {
    return [];
  }

  const summaries = new Map<string, RepositoryWorkflowBranchSummary>();

  for (const artifactPath of collectArtifactPaths(repositoryResultsRoot)) {
    const artifact = readCiResultArtifact(artifactPath);

    if (!artifact || artifact.repositoryName !== repositoryName) {
      continue;
    }

    const summary = toArtifactBranchSummary(artifact);
    const currentSummary = summaries.get(summary.branchName);

    if (!currentSummary || compareBranchSummaries(summary, currentSummary) < 0) {
      summaries.set(summary.branchName, summary);
    }
  }

  return Array.from(summaries.values());
}

function collectArtifactPaths(directoryPath: string): readonly string[] {
  return readdirSync(directoryPath, { withFileTypes: true })
    .sort((left, right) => compareTextAscending(left.name, right.name))
    .flatMap((entry) => {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        return collectArtifactPaths(entryPath);
      }

      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        return [];
      }

      return [entryPath];
    });
}

function readCiResultArtifact(artifactPath: string): CiResultArtifact | null {
  let payload: unknown;

  try {
    payload = JSON.parse(readFileSync(artifactPath, "utf8"));
  } catch {
    return null;
  }

  return isCiResultArtifact(payload) ? payload : null;
}

function isCiResultArtifact(value: unknown): value is CiResultArtifact {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.jobId === "string" &&
    typeof value.pullRequestId === "number" &&
    typeof value.repositoryName === "string" &&
    typeof value.branchName === "string" &&
    typeof value.baseBranch === "string" &&
    typeof value.commitHash === "string" &&
    isArtifactStatus(value.status) &&
    isTimestamp(value.queuedAt) &&
    (value.startedAt === null || isTimestamp(value.startedAt)) &&
    isTimestamp(value.finishedAt) &&
    (value.errorMessage === null || typeof value.errorMessage === "string") &&
    Array.isArray(value.workflows) &&
    value.workflows.every(isWorkflowResultArtifact) &&
    isMergeResult(value.merge)
  );
}

function isWorkflowResultArtifact(value: unknown): value is WorkflowResultArtifact {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    isWorkflowStatus(value.status) &&
    typeof value.installCommand === "string" &&
    (value.runCommand === undefined || typeof value.runCommand === "string") &&
    typeof value.output === "string"
  );
}

function isMergeResult(value: unknown): value is CiResultArtifact["merge"] {
  if (!isRecord(value)) {
    return false;
  }

  return isMergeStatus(value.status) && typeof value.message === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isArtifactStatus(value: unknown): value is CiResultArtifact["status"] {
  return value === "succeeded" || value === "failed" || value === "merge_failed";
}

function isWorkflowStatus(value: unknown): value is WorkflowResultArtifact["status"] {
  return value === "passed" || value === "failed";
}

function isMergeStatus(value: unknown): value is CiResultArtifact["merge"]["status"] {
  return value === "succeeded" || value === "failed" || value === "skipped";
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function toArtifactBranchSummary(artifact: CiResultArtifact): RepositoryWorkflowBranchSummary {
  return {
    branchName: artifact.branchName,
    commitHash: artifact.commitHash,
    status: artifact.status === "succeeded" ? "succeeded" : "failed",
    queuedAt: artifact.queuedAt,
    startedAt: artifact.startedAt,
    finishedAt: artifact.finishedAt,
    activityAt: artifact.finishedAt,
    source: "artifact",
    workflows: artifact.workflows.map((workflow) => ({
      name: workflow.name,
      status: workflow.status,
    })),
  };
}

function toActiveJobBranchSummary(
  pullRequest: PullRequestSummary,
): RepositoryWorkflowBranchSummary | null {
  const latestJob = pullRequest.latestJob;

  if (!latestJob || !isActiveJobStatus(latestJob.status)) {
    return null;
  }

  return {
    branchName: pullRequest.branchName,
    commitHash: pullRequest.latestCommitHash,
    status: latestJob.status,
    queuedAt: latestJob.createdAt,
    startedAt: latestJob.startedAt,
    finishedAt: latestJob.finishedAt,
    activityAt: resolveActiveJobActivityAt(latestJob),
    source: "active_job",
    workflows: [],
  };
}

function isActiveJobStatus(
  value: PullRequestLatestJobSummary["status"],
): value is Extract<PullRequestLatestJobSummary["status"], "queued" | "running"> {
  return value === "queued" || value === "running";
}

function resolveActiveJobActivityAt(latestJob: PullRequestLatestJobSummary): string {
  return latestJob.startedAt ?? latestJob.updatedAt ?? latestJob.createdAt;
}

function shouldPreferActiveJob(
  activeJobSummary: RepositoryWorkflowBranchSummary,
  currentSummary: RepositoryWorkflowBranchSummary,
): boolean {
  if (currentSummary.source !== "artifact") {
    return compareBranchSummaries(activeJobSummary, currentSummary) < 0;
  }

  return compareTimestampsDescending(activeJobSummary.activityAt, currentSummary.activityAt) < 0;
}

function compareBranchSummaries(
  left: RepositoryWorkflowBranchSummary,
  right: RepositoryWorkflowBranchSummary,
): number {
  const activityComparison = compareTimestampsDescending(left.activityAt, right.activityAt);

  if (activityComparison !== 0) {
    return activityComparison;
  }

  return compareTextAscending(left.branchName, right.branchName);
}

function compareTimestampsDescending(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left > right ? -1 : 1;
}

function compareTextAscending(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function determinePanelStatus(
  branchSummaries: readonly RepositoryWorkflowBranchSummary[],
): RepositoryWorkflowPanelStatus {
  if (branchSummaries.length === 0) {
    return "empty";
  }

  const firstStatus = branchSummaries[0]?.status;

  return branchSummaries.every((branchSummary) => branchSummary.status === firstStatus)
    ? firstStatus
    : "mixed";
}
