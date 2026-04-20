import "server-only";

import { randomUUID } from "node:crypto";
import {
  applyMigrations,
  runStorageTransaction,
  withStorage,
  type DatabaseSync,
  type StorageMigration,
  type StorageOptions,
} from "@/lib/storage/sqlite";
import type {
  ValidatedPullRequestEditRequest,
  ValidatedPullRequestSyncRequest,
} from "./validation";
import { PullRequestRequestError } from "./validation";
import { getWorkflowRunLogPath } from "@/lib/workflow-runs/log-storage";
import {
  resolveWorkflowRunRepositoryTarget,
  type ValidatedWorkflowRunRequest,
} from "@/lib/workflow-runs/validation";

export const MAX_ACTIVE_CI_JOBS = 4;
export const SUPERSEDED_CI_JOB_MESSAGE =
  "Superseded by a newer pull-request synchronization request before completion.";

export type PullRequestStatus = "queued" | "running" | "failed" | "passed" | "merged";
export type CiJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "merge_failed"
  | "superseded";
export type WorkflowRunStatus = "queued" | "running" | "succeeded" | "failed";

export type PullRequestRecord = Readonly<{
  id: number;
  repositoryName: string;
  repositoryPath: string;
  branchName: string;
  baseBranch: string;
  title: string;
  body: string;
  draft: boolean;
  headCommitHash: string;
  remoteName: string | null;
  status: PullRequestStatus;
  latestJobId: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CiJobRecord = Readonly<{
  id: string;
  pullRequestId: number;
  repositoryName: string;
  repositoryPath: string;
  branchName: string;
  baseBranch: string;
  commitHash: string;
  remoteName: string | null;
  status: CiJobStatus;
  resultPath: string | null;
  errorMessage: string | null;
  mergeStatus: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}>;

export type ClaimedCiJob = Readonly<{
  id: string;
  pullRequestId: number;
  repositoryName: string;
  repositoryPath: string;
  branchName: string;
  baseBranch: string;
  commitHash: string;
  remoteName: string | null;
  createdAt: string;
  startedAt: string | null;
}>;

export type WorkflowRunRecord = Readonly<{
  id: string;
  repositoryName: string;
  repositoryPath: string;
  branchName: string;
  commitHash: string;
  workflowName: string;
  status: WorkflowRunStatus;
  logPath: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}>;

export type ClaimedWorkflowRun = Readonly<{
  id: string;
  repositoryName: string;
  repositoryPath: string;
  executionRepositoryPath: string;
  branchName: string;
  commitHash: string;
  workflowName: string;
  logPath: string;
  createdAt: string;
  startedAt: string | null;
}>;

export type ClaimedExecution =
  | (ClaimedCiJob & { kind: "pull_request" })
  | (ClaimedWorkflowRun & { kind: "workflow_run" });

export type QueuePullRequestResult = Readonly<{
  job: CiJobRecord;
  pullRequest: PullRequestRecord;
  queuePosition: number;
}>;

export type QueueWorkflowRunResult = Readonly<{
  queuePosition: number;
  workflowRun: WorkflowRunRecord;
}>;

export type PullRequestState = "open" | "merged";
export type PullRequestActivityEventType =
  | "created"
  | "synchronized"
  | "edited"
  | "ci_started"
  | "ci_finished"
  | "merged";

export type PullRequestSummaryRecord = Readonly<{
  pullRequest: PullRequestRecord;
  latestJob: CiJobRecord | null;
  state: PullRequestState;
}>;

export type PullRequestActivityEventRecord = Readonly<{
  id: number;
  pullRequestId: number;
  repositoryName: string;
  repositoryPath: string;
  eventType: PullRequestActivityEventType;
  title: string;
  description: string;
  jobId: string | null;
  createdAt: string;
}>;

export type QueuePullRequestOptions = Readonly<{
  now?: () => Date;
  storage?: StorageOptions | string;
  jobIdFactory?: () => string;
}>;

export type ListPullRequestsOptions = Readonly<{
  state?: PullRequestState | "all";
  baseBranch?: string;
  headBranch?: string;
  storage?: StorageOptions | string;
}>;

export type ListWorkflowRunsOptions = Readonly<{
  storage?: StorageOptions | string;
}>;

export type UpdatePullRequestOptions = Readonly<{
  now?: () => Date;
  storage?: StorageOptions | string;
  jobIdFactory?: () => string;
}>;

export type UpdatePullRequestResult = Readonly<{
  pullRequest: PullRequestRecord;
  latestJob: CiJobRecord | null;
  rerunJob: CiJobRecord | null;
  queuePosition: number | null;
}>;

export type ClaimRunnableJobsOptions = Readonly<{
  now?: () => Date;
  storage?: StorageOptions | string;
}>;

export type CompleteCiJobOptions = Readonly<{
  jobId: string;
  status: Exclude<CiJobStatus, "queued" | "running">;
  resultPath: string | null;
  errorMessage?: string | null;
  mergeStatus?: string | null;
  now?: () => Date;
  storage?: StorageOptions | string;
}>;

export type QueueWorkflowRunOptions = Readonly<{
  cwd?: string;
  now?: () => Date;
  storage?: StorageOptions | string;
  workflowIdFactory?: () => string;
}>;

export type CompleteWorkflowRunOptions = Readonly<{
  workflowId: string;
  status: Exclude<WorkflowRunStatus, "queued" | "running">;
  errorMessage?: string | null;
  now?: () => Date;
  storage?: StorageOptions | string;
}>;

export type CompletePullRequestMergeOptions = Readonly<{
  pullRequestId: number;
  jobId: string | null;
  now?: () => Date;
  storage?: StorageOptions | string;
}>;

type PullRequestRow = {
  id: number;
  repository_name: string;
  repository_path: string;
  branch_name: string;
  base_branch: string;
  title: string;
  body: string;
  draft: number;
  head_commit_hash: string;
  remote_name: string | null;
  status: PullRequestStatus;
  latest_job_id: string | null;
  created_at: string;
  updated_at: string;
};

type CiJobRow = {
  id: string;
  pull_request_id: number;
  repository_name: string;
  repository_path: string;
  branch_name: string;
  base_branch: string;
  commit_hash: string;
  remote_name: string | null;
  status: CiJobStatus;
  result_path: string | null;
  error_message: string | null;
  merge_status: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type WorkflowRunRow = {
  id: string;
  repository_name: string;
  repository_path: string;
  execution_repository_path: string | null;
  branch_name: string;
  commit_hash: string;
  workflow_name: string;
  status: WorkflowRunStatus;
  log_path: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

type PullRequestActivityEventRow = {
  id: number;
  pull_request_id: number;
  repository_name: string;
  repository_path: string;
  event_type: PullRequestActivityEventType;
  title: string;
  description: string;
  job_id: string | null;
  created_at: string;
};

type PullRequestSummaryRow = PullRequestRow & {
  ci_job_id: string | null;
  ci_pull_request_id: number | null;
  ci_repository_name: string | null;
  ci_repository_path: string | null;
  ci_branch_name: string | null;
  ci_base_branch: string | null;
  ci_commit_hash: string | null;
  ci_remote_name: string | null;
  ci_status: CiJobStatus | null;
  ci_result_path: string | null;
  ci_error_message: string | null;
  ci_merge_status: string | null;
  ci_created_at: string | null;
  ci_updated_at: string | null;
  ci_started_at: string | null;
  ci_finished_at: string | null;
};

type RunnableExecutionRow = {
  id: string;
  branch_name: string;
  commit_hash: string;
  created_at: string;
  execution_repository_path: string | null;
  kind: "pull_request" | "workflow_run";
  log_path: string | null;
  pull_request_id: number | null;
  remote_name: string | null;
  repository_name: string;
  repository_path: string;
  workflow_name: string | null;
  base_branch: string | null;
};

const MIGRATIONS: readonly StorageMigration[] = [
  {
    version: 1,
    name: "create_pull_requests_and_ci_jobs",
    up(database) {
      database.exec(`
        CREATE TABLE pull_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          repository_name TEXT NOT NULL,
          repository_path TEXT NOT NULL,
          branch_name TEXT NOT NULL,
          base_branch TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          draft INTEGER NOT NULL DEFAULT 0,
          head_commit_hash TEXT NOT NULL,
          remote_name TEXT,
          status TEXT NOT NULL,
          latest_job_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(repository_path, branch_name)
        );

        CREATE TABLE ci_jobs (
          id TEXT PRIMARY KEY,
          pull_request_id INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
          repository_name TEXT NOT NULL,
          repository_path TEXT NOT NULL,
          branch_name TEXT NOT NULL,
          base_branch TEXT NOT NULL,
          commit_hash TEXT NOT NULL,
          remote_name TEXT,
          status TEXT NOT NULL,
          result_path TEXT,
          error_message TEXT,
          merge_status TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT
        );

        CREATE INDEX ci_jobs_status_created_idx ON ci_jobs(status, created_at, id);
        CREATE INDEX ci_jobs_repository_status_idx ON ci_jobs(repository_path, status, created_at, id);
      `);
    },
  },
  {
    version: 2,
    name: "create_workflow_runs",
    up(database) {
      database.exec(`
        CREATE TABLE workflow_runs (
          id TEXT PRIMARY KEY,
          repository_name TEXT NOT NULL,
          repository_path TEXT NOT NULL,
          branch_name TEXT NOT NULL,
          commit_hash TEXT NOT NULL,
          workflow_name TEXT NOT NULL,
          status TEXT NOT NULL,
          log_path TEXT NOT NULL,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT
        );

        CREATE INDEX workflow_runs_status_created_idx
          ON workflow_runs(status, created_at, id);
        CREATE INDEX workflow_runs_repository_status_idx
          ON workflow_runs(repository_path, status, created_at, id);
      `);
    },
  },
  {
    version: 3,
    name: "add_workflow_execution_repository_path",
    up(database) {
      database.exec(`
        ALTER TABLE workflow_runs
        ADD COLUMN execution_repository_path TEXT;

        UPDATE workflow_runs
        SET execution_repository_path = repository_path
        WHERE execution_repository_path IS NULL;
      `);
    },
  },
  {
    version: 4,
    name: "create_pull_request_events",
    up(database) {
      database.exec(`
        CREATE TABLE pull_request_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pull_request_id INTEGER NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
          repository_name TEXT NOT NULL,
          repository_path TEXT NOT NULL,
          event_type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          job_id TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX pull_request_events_pr_created_idx
          ON pull_request_events(pull_request_id, created_at, id);
        CREATE INDEX pull_request_events_repository_created_idx
          ON pull_request_events(repository_name, created_at, id);
      `);
    },
  },
];

export function ensurePullRequestStorage(
  storage: StorageOptions | string | undefined = undefined,
): void {
  applyMigrations(storage, MIGRATIONS);
}

export function queuePullRequestSynchronization(
  request: ValidatedPullRequestSyncRequest,
  options: QueuePullRequestOptions = {},
): QueuePullRequestResult {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) =>
    runStorageTransaction(
      database,
      (transaction) => {
        const now = (options.now ?? (() => new Date()))().toISOString();
        const existingPullRequest = readPullRequestByRepositoryBranch(
          transaction,
          request.repositoryPath,
          request.pullRequest.branchName,
        );
        let pullRequestId: number;

        if (!existingPullRequest) {
          const insertedPullRequest = transaction
            .prepare<
              [
                string,
                string,
                string,
                string,
                string,
                string,
                number,
                string,
                string | null,
                PullRequestStatus,
                string,
                string,
              ]
            >(
              `
                INSERT INTO pull_requests (
                  repository_name,
                  repository_path,
                  branch_name,
                  base_branch,
                  title,
                  body,
                  draft,
                  head_commit_hash,
                  remote_name,
                  status,
                  created_at,
                  updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
            )
            .run(
              request.repositoryName,
              request.repositoryPath,
              request.pullRequest.branchName,
              request.pullRequest.baseBranch,
              request.pullRequest.title,
              request.pullRequest.body,
              request.pullRequest.draft ? 1 : 0,
              request.publishedBranch.commitHash,
              request.pullRequest.remoteName ?? request.publishedBranch.remoteName ?? null,
              "queued",
              now,
              now,
            );

          pullRequestId = Number(insertedPullRequest.lastInsertRowid);
        } else {
          pullRequestId = existingPullRequest.id;

          if (existingPullRequest.status === "merged") {
            throw new PullRequestRequestError("Merged pull requests cannot be synchronized.", 409);
          }

          transaction
            .prepare<
              [
                string,
                string,
                string,
                string,
                number,
                string | null,
                PullRequestStatus,
                string,
                number,
              ]
            >(
              `
                UPDATE pull_requests
                SET
                  base_branch = ?,
                  title = ?,
                  body = ?,
                  head_commit_hash = ?,
                  draft = ?,
                  remote_name = ?,
                  status = ?,
                  updated_at = ?
                WHERE id = ?
              `,
            )
            .run(
              request.pullRequest.baseBranch,
              request.pullRequest.title,
              request.pullRequest.body,
              request.publishedBranch.commitHash,
              request.pullRequest.draft ? 1 : 0,
              request.pullRequest.remoteName ?? request.publishedBranch.remoteName ?? null,
              "queued",
              now,
              pullRequestId,
            );
        }

        transaction
          .prepare<[string, string, number]>(
            `
              UPDATE ci_jobs
              SET
                status = 'superseded',
                error_message = 'Superseded by a newer pull-request synchronization request.',
                finished_at = COALESCE(finished_at, ?),
                updated_at = ?
              WHERE pull_request_id = ? AND status = 'queued'
            `,
          )
          .run(now, now, pullRequestId);

        const jobId = (options.jobIdFactory ?? randomUUID)();

        transaction
          .prepare<
            [
              string,
              number,
              string,
              string,
              string,
              string,
              string,
              string | null,
              CiJobStatus,
              string,
              string,
            ]
          >(
            `
              INSERT INTO ci_jobs (
                id,
                pull_request_id,
                repository_name,
                repository_path,
                branch_name,
                base_branch,
                commit_hash,
                remote_name,
                status,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .run(
            jobId,
            pullRequestId,
            request.repositoryName,
            request.repositoryPath,
            request.pullRequest.branchName,
            request.pullRequest.baseBranch,
            request.publishedBranch.commitHash,
            request.pullRequest.remoteName ?? request.publishedBranch.remoteName ?? null,
            "queued",
            now,
            now,
          );

        transaction
          .prepare<[string, PullRequestStatus, string, number]>(
            `
              UPDATE pull_requests
              SET latest_job_id = ?, status = ?, updated_at = ?
              WHERE id = ?
            `,
          )
          .run(jobId, "queued", now, pullRequestId);

        insertPullRequestActivityEvent(transaction, {
          pullRequestId,
          repositoryName: request.repositoryName,
          repositoryPath: request.repositoryPath,
          eventType: existingPullRequest ? "synchronized" : "created",
          title: existingPullRequest ? "Pull request synchronized" : "Pull request created",
          description: existingPullRequest
            ? `Synchronized ${request.pullRequest.branchName} at ${request.publishedBranch.commitHash}.`
            : `Created ${request.pullRequest.branchName} targeting ${request.pullRequest.baseBranch}.`,
          jobId,
          createdAt: now,
        });

        const queuePosition = countQueuedExecutionsThrough(transaction, "pull_request", jobId);

        return {
          job: readCiJobById(transaction, jobId)!,
          pullRequest: readPullRequestById(transaction, pullRequestId)!,
          queuePosition,
        };
      },
      "immediate",
    ),
  );
}

export function queueWorkflowRun(
  request: ValidatedWorkflowRunRequest,
  options: QueueWorkflowRunOptions = {},
): QueueWorkflowRunResult {
  ensurePullRequestStorage(options.storage);
  const repository = resolveWorkflowRunRepositoryTarget(
    request.executionRepositoryPath,
    options.cwd,
  );

  return withStorage(options.storage, (database) =>
    runStorageTransaction(
      database,
      (transaction) => {
        const now = (options.now ?? (() => new Date()))().toISOString();
        const workflowId = (options.workflowIdFactory ?? randomUUID)();
        const logPath = getWorkflowRunLogPath(
          workflowId,
          repository.repositoryName,
          options.cwd ?? process.cwd(),
        );

        transaction
          .prepare<
            [
              string,
              string,
              string,
              string,
              string,
              string,
              string,
              WorkflowRunStatus,
              string,
              string,
              string,
            ]
          >(
            `
              INSERT INTO workflow_runs (
                id,
                repository_name,
                repository_path,
                execution_repository_path,
                branch_name,
                commit_hash,
                workflow_name,
                status,
                log_path,
                created_at,
                updated_at
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .run(
            workflowId,
            repository.repositoryName,
            repository.repositoryPath,
            repository.executionRepositoryPath,
            request.publishedBranch.branchName,
            request.publishedBranch.commitHash,
            request.workflowName,
            "queued",
            logPath,
            now,
            now,
          );

        return {
          queuePosition: countQueuedExecutionsThrough(transaction, "workflow_run", workflowId),
          workflowRun: readWorkflowRunById(transaction, workflowId)!,
        };
      },
      "immediate",
    ),
  );
}

export function claimRunnableJobs(options: ClaimRunnableJobsOptions = {}): readonly ClaimedCiJob[] {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) =>
    runStorageTransaction(
      database,
      (transaction) => {
        const runningJobs = transaction
          .prepare<[], Pick<CiJobRow, "repository_path">>(
            `
              SELECT repository_path
              FROM ci_jobs
              WHERE status = 'running'
              ORDER BY created_at ASC, id ASC
            `,
          )
          .all();
        const runningRepositoryPaths = new Set(runningJobs.map((job) => job.repository_path));
        const availableSlots = Math.max(MAX_ACTIVE_CI_JOBS - runningJobs.length, 0);

        if (availableSlots === 0) {
          return [];
        }

        const queuedJobs = transaction
          .prepare<[], CiJobRow>(
            `
              SELECT ci_jobs.*
              FROM ci_jobs
              INNER JOIN pull_requests ON pull_requests.id = ci_jobs.pull_request_id
              WHERE ci_jobs.status = 'queued'
                AND pull_requests.latest_job_id = ci_jobs.id
              ORDER BY ci_jobs.created_at ASC, ci_jobs.id ASC
            `,
          )
          .all();
        const selectedJobs = selectRunnableJobs(queuedJobs, runningRepositoryPaths, availableSlots);

        if (selectedJobs.length === 0) {
          return [];
        }

        const now = (options.now ?? (() => new Date()))().toISOString();
        const claimedJobs: ClaimedCiJob[] = [];

        for (const job of selectedJobs) {
          const updateResult = transaction
            .prepare<[string, string, string]>(
              `
                UPDATE ci_jobs
                SET
                  status = 'running',
                  started_at = COALESCE(started_at, ?),
                  updated_at = ?
                WHERE id = ? AND status = 'queued'
              `,
            )
            .run(now, now, job.id);

          if (updateResult.changes === 0) {
            continue;
          }

          transaction
            .prepare<[PullRequestStatus, string, number]>(
              `
                UPDATE pull_requests
                SET status = ?, updated_at = ?
                WHERE id = ?
              `,
            )
            .run("running", now, job.pull_request_id);

          insertPullRequestActivityEvent(transaction, {
            pullRequestId: job.pull_request_id,
            repositoryName: job.repository_name,
            repositoryPath: job.repository_path,
            eventType: "ci_started",
            title: "CI job started",
            description: `Started CI job ${job.id} for ${job.branch_name}.`,
            jobId: job.id,
            createdAt: now,
          });

          claimedJobs.push({
            id: job.id,
            pullRequestId: job.pull_request_id,
            repositoryName: job.repository_name,
            repositoryPath: job.repository_path,
            branchName: job.branch_name,
            baseBranch: job.base_branch,
            commitHash: job.commit_hash,
            remoteName: job.remote_name,
            createdAt: job.created_at,
            startedAt: now,
          });
        }

        return claimedJobs;
      },
      "immediate",
    ),
  );
}

export function claimRunnableExecutions(
  options: ClaimRunnableJobsOptions = {},
): readonly ClaimedExecution[] {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) =>
    runStorageTransaction(
      database,
      (transaction) => {
        const runningExecutions = listRunningExecutionRepositoryNames(transaction);
        const runningRepositoryNames = new Set(
          runningExecutions.map((execution) => execution.repository_name),
        );
        const availableSlots = Math.max(MAX_ACTIVE_CI_JOBS - runningExecutions.length, 0);

        if (availableSlots === 0) {
          return [];
        }

        const selectedExecutions = selectRunnableJobs(
          listQueuedExecutionRows(transaction),
          runningRepositoryNames,
          availableSlots,
          (execution) => execution.repository_name,
        );

        if (selectedExecutions.length === 0) {
          return [];
        }

        const timestamp = (options.now ?? (() => new Date()))().toISOString();
        const claimedExecutions: ClaimedExecution[] = [];

        for (const execution of selectedExecutions) {
          if (execution.kind === "pull_request") {
            const updateResult = transaction
              .prepare<[string, string, string]>(
                `
                  UPDATE ci_jobs
                  SET
                    status = 'running',
                    started_at = COALESCE(started_at, ?),
                    updated_at = ?
                  WHERE id = ? AND status = 'queued'
                `,
              )
              .run(timestamp, timestamp, execution.id);

            if (updateResult.changes === 0 || execution.pull_request_id === null) {
              continue;
            }

            transaction
              .prepare<[PullRequestStatus, string, number]>(
                `
                  UPDATE pull_requests
                  SET status = ?, updated_at = ?
                  WHERE id = ?
                `,
              )
              .run("running", timestamp, execution.pull_request_id);

            insertPullRequestActivityEvent(transaction, {
              pullRequestId: execution.pull_request_id,
              repositoryName: execution.repository_name,
              repositoryPath: execution.repository_path,
              eventType: "ci_started",
              title: "CI job started",
              description: `Started CI job ${execution.id} for ${execution.branch_name}.`,
              jobId: execution.id,
              createdAt: timestamp,
            });

            claimedExecutions.push({
              kind: "pull_request",
              id: execution.id,
              pullRequestId: execution.pull_request_id,
              repositoryName: execution.repository_name,
              repositoryPath: execution.repository_path,
              branchName: execution.branch_name,
              baseBranch: execution.base_branch ?? "",
              commitHash: execution.commit_hash,
              remoteName: execution.remote_name,
              createdAt: execution.created_at,
              startedAt: timestamp,
            });

            continue;
          }

          const updateResult = transaction
            .prepare<[string, string, string]>(
              `
                UPDATE workflow_runs
                SET
                  status = 'running',
                  started_at = COALESCE(started_at, ?),
                  updated_at = ?
                WHERE id = ? AND status = 'queued'
              `,
            )
            .run(timestamp, timestamp, execution.id);

          if (updateResult.changes === 0 || !execution.workflow_name || !execution.log_path) {
            continue;
          }

          claimedExecutions.push({
            kind: "workflow_run",
            id: execution.id,
            repositoryName: execution.repository_name,
            repositoryPath: execution.repository_path,
            executionRepositoryPath:
              execution.execution_repository_path ?? execution.repository_path,
            branchName: execution.branch_name,
            commitHash: execution.commit_hash,
            workflowName: execution.workflow_name,
            logPath: execution.log_path,
            createdAt: execution.created_at,
            startedAt: timestamp,
          });
        }

        return claimedExecutions;
      },
      "immediate",
    ),
  );
}

export function selectRunnableJobs<T extends Pick<CiJobRow, "repository_path">>(
  queuedJobs: readonly T[],
  runningRepositoryIdentities: ReadonlySet<string>,
  limit: number,
  getRepositoryIdentity: (job: T) => string = (job) => job.repository_path,
): readonly T[] {
  const claimedRepositoryIdentities = new Set(runningRepositoryIdentities);
  const selectedJobs: T[] = [];

  for (const job of queuedJobs) {
    if (selectedJobs.length >= limit) {
      break;
    }

    const repositoryIdentity = getRepositoryIdentity(job);

    if (claimedRepositoryIdentities.has(repositoryIdentity)) {
      continue;
    }

    claimedRepositoryIdentities.add(repositoryIdentity);
    selectedJobs.push(job);
  }

  return selectedJobs;
}

export function requeueRunningJobs(
  storage: StorageOptions | string | undefined = undefined,
  now: () => Date = () => new Date(),
): number {
  ensurePullRequestStorage(storage);

  return withStorage(storage, (database) =>
    runStorageTransaction(
      database,
      (transaction) => {
        const timestamp = now().toISOString();
        const requeuedCiJobs = transaction
          .prepare<[string]>(
            `
              UPDATE ci_jobs
              SET
                status = 'queued',
                started_at = NULL,
                updated_at = ?,
                error_message = CASE
                  WHEN error_message IS NULL THEN 'Runner restarted before completion; job requeued.'
                  ELSE error_message || CHAR(10) || 'Runner restarted before completion; job requeued.'
                END
              WHERE status = 'running'
            `,
          )
          .run(timestamp);
        const requeuedWorkflowRuns = transaction
          .prepare<[string]>(
            `
              UPDATE workflow_runs
              SET
                status = 'queued',
                started_at = NULL,
                updated_at = ?,
                error_message = CASE
                  WHEN error_message IS NULL THEN 'Runner restarted before completion; workflow run requeued.'
                  ELSE error_message || CHAR(10) || 'Runner restarted before completion; workflow run requeued.'
                END
              WHERE status = 'running'
            `,
          )
          .run(timestamp);

        if (requeuedCiJobs.changes > 0) {
          transaction
            .prepare<[string, string, string, string, string]>(
              `
                UPDATE ci_jobs
                SET
                  status = 'superseded',
                  result_path = NULL,
                  merge_status = 'skipped',
                  error_message = CASE
                    WHEN error_message IS NULL THEN ?
                    WHEN error_message = ? THEN error_message
                    ELSE ? || CHAR(10) || error_message
                  END,
                  finished_at = COALESCE(finished_at, ?),
                  updated_at = ?
                WHERE status = 'queued'
                  AND EXISTS (
                    SELECT 1
                    FROM pull_requests
                    WHERE pull_requests.id = ci_jobs.pull_request_id
                      AND pull_requests.latest_job_id <> ci_jobs.id
                  )
              `,
            )
            .run(
              SUPERSEDED_CI_JOB_MESSAGE,
              SUPERSEDED_CI_JOB_MESSAGE,
              SUPERSEDED_CI_JOB_MESSAGE,
              timestamp,
              timestamp,
            );

          transaction
            .prepare<[PullRequestStatus, string]>(
              `
                UPDATE pull_requests
                SET status = ?, updated_at = ?
                WHERE status = 'running'
              `,
            )
            .run("queued", timestamp);
        }

        return requeuedCiJobs.changes + requeuedWorkflowRuns.changes;
      },
      "immediate",
    ),
  );
}

export function completeCiJob(options: CompleteCiJobOptions): CiJobRecord {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) =>
    runStorageTransaction(
      database,
      (transaction) => {
        const now = (options.now ?? (() => new Date()))().toISOString();
        const job = readCiJobById(transaction, options.jobId);

        if (!job) {
          throw new Error(`Unknown CI job ${options.jobId}.`);
        }

        const isLatestJob = isLatestCiJobForPullRequest(
          transaction,
          job.pullRequestId,
          options.jobId,
        );
        const shouldSupersedeJob = options.status === "superseded" || !isLatestJob;
        const jobStatus = shouldSupersedeJob ? "superseded" : options.status;
        const resultPath = shouldSupersedeJob ? null : options.resultPath;
        const errorMessage = shouldSupersedeJob
          ? buildSupersededCiJobMessage(options.errorMessage)
          : (options.errorMessage ?? null);
        const mergeStatus = shouldSupersedeJob ? "skipped" : (options.mergeStatus ?? null);

        transaction
          .prepare<
            [CiJobStatus, string | null, string | null, string | null, string, string, string]
          >(
            `
              UPDATE ci_jobs
              SET
                status = ?,
                result_path = ?,
                error_message = ?,
                merge_status = ?,
                finished_at = ?,
                updated_at = ?
              WHERE id = ?
            `,
          )
          .run(jobStatus, resultPath, errorMessage, mergeStatus, now, now, options.jobId);

        insertPullRequestActivityEvent(transaction, {
          pullRequestId: job.pullRequestId,
          repositoryName: job.repositoryName,
          repositoryPath: job.repositoryPath,
          eventType: "ci_finished",
          title: "CI job finished",
          description: `Finished CI job ${job.id} with status ${jobStatus}.`,
          jobId: job.id,
          createdAt: now,
        });

        if (!shouldSupersedeJob) {
          transaction
            .prepare<[PullRequestStatus, string, number]>(
              `
                UPDATE pull_requests
                SET status = ?, updated_at = ?
              WHERE id = ?
              `,
            )
            .run(mapJobStatusToPullRequestStatus(options.status), now, job.pullRequestId);
        }

        return readCiJobById(transaction, options.jobId)!;
      },
      "immediate",
    ),
  );
}

export function completeWorkflowRun(options: CompleteWorkflowRunOptions): WorkflowRunRecord {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) =>
    runStorageTransaction(
      database,
      (transaction) => {
        const now = (options.now ?? (() => new Date()))().toISOString();
        const workflowRun = readWorkflowRunById(transaction, options.workflowId);

        if (!workflowRun) {
          throw new Error(`Unknown workflow run ${options.workflowId}.`);
        }

        transaction
          .prepare<[WorkflowRunStatus, string | null, string, string, string]>(
            `
              UPDATE workflow_runs
              SET
                status = ?,
                error_message = ?,
                finished_at = ?,
                updated_at = ?
              WHERE id = ?
            `,
          )
          .run(options.status, options.errorMessage ?? null, now, now, options.workflowId);

        return readWorkflowRunById(transaction, options.workflowId)!;
      },
      "immediate",
    ),
  );
}

export function isLatestCiJob(
  jobId: string,
  storage: StorageOptions | string | undefined = undefined,
): boolean {
  ensurePullRequestStorage(storage);

  return withStorage(storage, (database) => {
    const job = readCiJobById(database, jobId);

    if (!job) {
      throw new Error(`Unknown CI job ${jobId}.`);
    }

    return isLatestCiJobForPullRequest(database, job.pullRequestId, jobId);
  });
}

export function readPullRequest(
  repositoryPath: string,
  branchName: string,
  storage: StorageOptions | string | undefined = undefined,
): PullRequestRecord | null {
  ensurePullRequestStorage(storage);

  return withStorage(storage, (database) =>
    readPullRequestByRepositoryBranch(database, repositoryPath, branchName),
  );
}

export function readWorkflowRun(
  workflowId: string,
  storage: StorageOptions | string | undefined = undefined,
): WorkflowRunRecord | null {
  ensurePullRequestStorage(storage);

  return withStorage(storage, (database) => readWorkflowRunById(database, workflowId));
}

export function readWorkflowRunForRepository(
  repositoryName: string,
  workflowId: string,
  storage: StorageOptions | string | undefined = undefined,
): WorkflowRunRecord | null {
  ensurePullRequestStorage(storage);

  return withStorage(storage, (database) =>
    readWorkflowRunByRepository(database, repositoryName, workflowId),
  );
}

export function listWorkflowRuns(
  repositoryName: string,
  options: ListWorkflowRunsOptions = {},
): readonly WorkflowRunRecord[] {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) => {
    const rows = database
      .prepare<[string], WorkflowRunRow>(
        `
          SELECT *
          FROM workflow_runs
          WHERE repository_name = ?
          ORDER BY updated_at DESC, id DESC
        `,
      )
      .all(repositoryName);

    return rows.map(toWorkflowRunRecord);
  });
}

export function readPullRequestForRepository(
  repositoryName: string,
  pullRequestId: number,
  storage: StorageOptions | string | undefined = undefined,
): PullRequestRecord | null {
  ensurePullRequestStorage(storage);

  return withStorage(storage, (database) =>
    readPullRequestByRepository(database, repositoryName, pullRequestId),
  );
}

export function listPullRequestsForRepository(
  repositoryName: string,
  options: ListPullRequestsOptions = {},
): readonly PullRequestSummaryRecord[] {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) =>
    listPullRequestSummaryRecords(database, "pull_requests.repository_name = ?", repositoryName, {
      state: options.state,
      baseBranch: options.baseBranch,
      headBranch: options.headBranch,
    }),
  );
}

export function listPullRequests(
  repositoryPath: string,
  options: ListPullRequestsOptions = {},
): readonly PullRequestSummaryRecord[] {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) =>
    listPullRequestSummaryRecords(database, "pull_requests.repository_path = ?", repositoryPath, {
      state: options.state,
      baseBranch: options.baseBranch,
      headBranch: options.headBranch,
    }),
  );
}

export function listCiJobsForPullRequest(
  pullRequestId: number,
  options: Readonly<{
    repositoryName?: string;
    storage?: StorageOptions | string;
  }> = {},
): readonly CiJobRecord[] {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) => {
    const filters = ["pull_request_id = ?"];
    const parameters: Array<string | number> = [pullRequestId];

    if (options.repositoryName) {
      filters.push("repository_name = ?");
      parameters.push(options.repositoryName);
    }

    return database
      .prepare<Array<string | number>, CiJobRow>(
        `
          SELECT *
          FROM ci_jobs
          WHERE ${filters.join(" AND ")}
          ORDER BY created_at DESC, id DESC
        `,
      )
      .all(...parameters)
      .map(toCiJobRecord);
  });
}

export function listPullRequestActivityEvents(
  pullRequestId: number,
  options: Readonly<{
    repositoryName?: string;
    storage?: StorageOptions | string;
  }> = {},
): readonly PullRequestActivityEventRecord[] {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) => {
    const filters = ["pull_request_id = ?"];
    const parameters: Array<string | number> = [pullRequestId];

    if (options.repositoryName) {
      filters.push("repository_name = ?");
      parameters.push(options.repositoryName);
    }

    return database
      .prepare<Array<string | number>, PullRequestActivityEventRow>(
        `
          SELECT *
          FROM pull_request_events
          WHERE ${filters.join(" AND ")}
          ORDER BY created_at ASC, id ASC
        `,
      )
      .all(...parameters)
      .map(toPullRequestActivityEventRecord);
  });
}

export function appendPullRequestActivityEvent(
  event: Readonly<{
    pullRequestId: number;
    repositoryName: string;
    repositoryPath: string;
    eventType: PullRequestActivityEventType;
    title: string;
    description: string;
    jobId: string | null;
  }>,
  options: Readonly<{
    now?: () => Date;
    storage?: StorageOptions | string;
  }> = {},
): PullRequestActivityEventRecord {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) => {
    const createdAt = (options.now ?? (() => new Date()))().toISOString();
    const eventId = insertPullRequestActivityEvent(database, {
      ...event,
      createdAt,
    });

    return readPullRequestActivityEventById(database, eventId)!;
  });
}

export function completePullRequestMerge(
  options: CompletePullRequestMergeOptions,
): PullRequestRecord {
  ensurePullRequestStorage(options.storage);

  return withStorage(options.storage, (database) =>
    runStorageTransaction(
      database,
      (transaction) => {
        const now = (options.now ?? (() => new Date()))().toISOString();
        const pullRequest = readPullRequestById(transaction, options.pullRequestId);

        if (!pullRequest) {
          throw new Error(`Unknown pull request ${options.pullRequestId}.`);
        }

        transaction
          .prepare<[PullRequestStatus, string, number]>(
            `
              UPDATE pull_requests
              SET status = ?, updated_at = ?
              WHERE id = ?
            `,
          )
          .run("merged", now, options.pullRequestId);

        insertPullRequestActivityEvent(transaction, {
          pullRequestId: pullRequest.id,
          repositoryName: pullRequest.repositoryName,
          repositoryPath: pullRequest.repositoryPath,
          eventType: "merged",
          title: "Pull request merged",
          description: `Merged ${pullRequest.branchName} into ${pullRequest.baseBranch} after manual approval.`,
          jobId: options.jobId,
          createdAt: now,
        });

        return readPullRequestById(transaction, options.pullRequestId)!;
      },
      "immediate",
    ),
  );
}

export function updatePullRequest(
  request: ValidatedPullRequestEditRequest,
  options: UpdatePullRequestOptions = {},
): UpdatePullRequestResult | null {
  ensurePullRequestStorage(options.storage);

  const existingPullRequest = readPullRequest(
    request.repositoryPath,
    request.branchName,
    options.storage,
  );

  if (!existingPullRequest) {
    return null;
  }

  const nextBaseBranch = request.baseBranch ?? existingPullRequest.baseBranch;
  const nextTitle = request.title ?? existingPullRequest.title;
  const nextBody = request.body ?? existingPullRequest.body;
  const nextDraft = request.draft ?? existingPullRequest.draft;

  if (nextBaseBranch !== existingPullRequest.baseBranch) {
    if (existingPullRequest.status === "merged") {
      throw new PullRequestRequestError("Merged pull requests cannot change base branches.", 409);
    }

    const queued = queuePullRequestSynchronization(
      {
        repositoryName: existingPullRequest.repositoryName,
        repositoryPath: existingPullRequest.repositoryPath,
        publishedBranch: {
          repositoryPath: existingPullRequest.repositoryPath,
          branchName: existingPullRequest.branchName,
          commitHash: existingPullRequest.headCommitHash,
          remoteName: existingPullRequest.remoteName ?? undefined,
        },
        pullRequest: {
          repositoryPath: existingPullRequest.repositoryPath,
          branchName: existingPullRequest.branchName,
          baseBranch: nextBaseBranch,
          title: nextTitle,
          body: nextBody,
          draft: nextDraft,
          remoteName: existingPullRequest.remoteName ?? undefined,
        },
      },
      options,
    );

    appendPullRequestActivityEvent(
      {
        pullRequestId: queued.pullRequest.id,
        repositoryName: queued.pullRequest.repositoryName,
        repositoryPath: queued.pullRequest.repositoryPath,
        eventType: "edited",
        title: "Pull request edited",
        description: `Retargeted ${queued.pullRequest.branchName} to ${queued.pullRequest.baseBranch}.`,
        jobId: queued.job.id,
      },
      {
        now: options.now,
        storage: options.storage,
      },
    );

    return {
      pullRequest: queued.pullRequest,
      latestJob: queued.job,
      rerunJob: queued.job,
      queuePosition: queued.queuePosition,
    };
  }

  return withStorage(options.storage, (database) =>
    runStorageTransaction(
      database,
      (transaction) => {
        const now = (options.now ?? (() => new Date()))().toISOString();

        transaction
          .prepare<[string, string, string, number, string, number]>(
            `
              UPDATE pull_requests
              SET
                title = ?,
                body = ?,
                base_branch = ?,
                draft = ?,
                updated_at = ?
              WHERE id = ?
            `,
          )
          .run(nextTitle, nextBody, nextBaseBranch, nextDraft ? 1 : 0, now, existingPullRequest.id);

        insertPullRequestActivityEvent(transaction, {
          pullRequestId: existingPullRequest.id,
          repositoryName: existingPullRequest.repositoryName,
          repositoryPath: existingPullRequest.repositoryPath,
          eventType: "edited",
          title: "Pull request edited",
          description: "Updated pull-request metadata.",
          jobId: null,
          createdAt: now,
        });

        const pullRequest = readPullRequestById(transaction, existingPullRequest.id)!;
        const latestJob = pullRequest.latestJobId
          ? readCiJobById(transaction, pullRequest.latestJobId)
          : null;

        return {
          pullRequest,
          latestJob,
          rerunJob: null,
          queuePosition: null,
        };
      },
      "immediate",
    ),
  );
}

export function readCiJob(
  jobId: string,
  storage: StorageOptions | string | undefined = undefined,
): CiJobRecord | null {
  ensurePullRequestStorage(storage);

  return withStorage(storage, (database) => readCiJobById(database, jobId));
}

function mapJobStatusToPullRequestStatus(
  status: CompleteCiJobOptions["status"],
): PullRequestStatus {
  switch (status) {
    case "succeeded":
      return "passed";
    case "merge_failed":
      return "failed";
    case "superseded":
      return "queued";
    default:
      return "failed";
  }
}

function isLatestCiJobForPullRequest(
  database: DatabaseSync,
  pullRequestId: number,
  jobId: string,
): boolean {
  const row = database
    .prepare<[number], Pick<PullRequestRow, "latest_job_id">>(
      `
        SELECT latest_job_id
        FROM pull_requests
        WHERE id = ?
      `,
    )
    .get(pullRequestId);

  if (!row) {
    throw new Error(`Unknown pull request ${pullRequestId}.`);
  }

  return row.latest_job_id === jobId;
}

function buildSupersededCiJobMessage(errorMessage: string | null | undefined): string {
  if (!errorMessage || errorMessage === SUPERSEDED_CI_JOB_MESSAGE) {
    return SUPERSEDED_CI_JOB_MESSAGE;
  }

  return `${SUPERSEDED_CI_JOB_MESSAGE}\n${errorMessage}`;
}

function listPullRequestSummaryRecords(
  database: DatabaseSync,
  identityFilter: string,
  identityValue: string,
  options: Readonly<{
    state?: PullRequestState | "all";
    baseBranch?: string;
    headBranch?: string;
  }>,
): readonly PullRequestSummaryRecord[] {
  const filters = [identityFilter];
  const parameters: string[] = [identityValue];

  if (options.state === "open") {
    filters.push("pull_requests.status <> 'merged'");
  } else if (options.state === "merged") {
    filters.push("pull_requests.status = 'merged'");
  }

  if (options.baseBranch) {
    filters.push("pull_requests.base_branch = ?");
    parameters.push(options.baseBranch);
  }

  if (options.headBranch) {
    filters.push("pull_requests.branch_name = ?");
    parameters.push(options.headBranch);
  }

  const rows = database
    .prepare<string[], PullRequestSummaryRow>(
      `
        SELECT
          pull_requests.*,
          ci_jobs.id AS ci_job_id,
          ci_jobs.pull_request_id AS ci_pull_request_id,
          ci_jobs.repository_name AS ci_repository_name,
          ci_jobs.repository_path AS ci_repository_path,
          ci_jobs.branch_name AS ci_branch_name,
          ci_jobs.base_branch AS ci_base_branch,
          ci_jobs.commit_hash AS ci_commit_hash,
          ci_jobs.remote_name AS ci_remote_name,
          ci_jobs.status AS ci_status,
          ci_jobs.result_path AS ci_result_path,
          ci_jobs.error_message AS ci_error_message,
          ci_jobs.merge_status AS ci_merge_status,
          ci_jobs.created_at AS ci_created_at,
          ci_jobs.updated_at AS ci_updated_at,
          ci_jobs.started_at AS ci_started_at,
          ci_jobs.finished_at AS ci_finished_at
        FROM pull_requests
        LEFT JOIN ci_jobs ON ci_jobs.id = pull_requests.latest_job_id
        WHERE ${filters.join(" AND ")}
        ORDER BY pull_requests.updated_at DESC, pull_requests.id DESC
      `,
    )
    .all(...parameters);

  return rows.map(toPullRequestSummaryRecord);
}

function readPullRequestByRepositoryBranch(
  database: DatabaseSync,
  repositoryPath: string,
  branchName: string,
): PullRequestRecord | null {
  const row = database
    .prepare<[string, string], PullRequestRow>(
      `
        SELECT *
        FROM pull_requests
        WHERE repository_path = ? AND branch_name = ?
      `,
    )
    .get(repositoryPath, branchName);

  return row ? toPullRequestRecord(row) : null;
}

function readPullRequestByRepository(
  database: DatabaseSync,
  repositoryName: string,
  pullRequestId: number,
): PullRequestRecord | null {
  const row = database
    .prepare<[string, number], PullRequestRow>(
      `
        SELECT *
        FROM pull_requests
        WHERE repository_name = ? AND id = ?
      `,
    )
    .get(repositoryName, pullRequestId);

  return row ? toPullRequestRecord(row) : null;
}

function readPullRequestById(
  database: DatabaseSync,
  pullRequestId: number,
): PullRequestRecord | null {
  const row = database
    .prepare<[number], PullRequestRow>(
      `
        SELECT *
        FROM pull_requests
        WHERE id = ?
      `,
    )
    .get(pullRequestId);

  return row ? toPullRequestRecord(row) : null;
}

function readCiJobById(database: DatabaseSync, jobId: string): CiJobRecord | null {
  const row = database
    .prepare<[string], CiJobRow>(
      `
        SELECT *
        FROM ci_jobs
        WHERE id = ?
      `,
    )
    .get(jobId);

  return row ? toCiJobRecord(row) : null;
}

function insertPullRequestActivityEvent(
  database: DatabaseSync,
  event: Readonly<{
    pullRequestId: number;
    repositoryName: string;
    repositoryPath: string;
    eventType: PullRequestActivityEventType;
    title: string;
    description: string;
    jobId: string | null;
    createdAt: string;
  }>,
): number {
  const insertedEvent = database
    .prepare<
      [number, string, string, PullRequestActivityEventType, string, string, string | null, string]
    >(
      `
        INSERT INTO pull_request_events (
          pull_request_id,
          repository_name,
          repository_path,
          event_type,
          title,
          description,
          job_id,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      event.pullRequestId,
      event.repositoryName,
      event.repositoryPath,
      event.eventType,
      event.title,
      event.description,
      event.jobId,
      event.createdAt,
    );

  return Number(insertedEvent.lastInsertRowid);
}

function readPullRequestActivityEventById(
  database: DatabaseSync,
  eventId: number,
): PullRequestActivityEventRecord | null {
  const row = database
    .prepare<[number], PullRequestActivityEventRow>(
      `
        SELECT *
        FROM pull_request_events
        WHERE id = ?
      `,
    )
    .get(eventId);

  return row ? toPullRequestActivityEventRecord(row) : null;
}

function readWorkflowRunById(database: DatabaseSync, workflowId: string): WorkflowRunRecord | null {
  const row = database
    .prepare<[string], WorkflowRunRow>(
      `
        SELECT *
        FROM workflow_runs
        WHERE id = ?
      `,
    )
    .get(workflowId);

  return row ? toWorkflowRunRecord(row) : null;
}

function readWorkflowRunByRepository(
  database: DatabaseSync,
  repositoryName: string,
  workflowId: string,
): WorkflowRunRecord | null {
  const row = database
    .prepare<[string, string], WorkflowRunRow>(
      `
        SELECT *
        FROM workflow_runs
        WHERE repository_name = ? AND id = ?
      `,
    )
    .get(repositoryName, workflowId);

  return row ? toWorkflowRunRecord(row) : null;
}

function listRunningExecutionRepositoryNames(
  database: DatabaseSync,
): readonly Pick<RunnableExecutionRow, "repository_name">[] {
  const runningCiJobs = database
    .prepare<[], Pick<CiJobRow, "repository_name">>(
      `
        SELECT repository_name
        FROM ci_jobs
        WHERE status = 'running'
      `,
    )
    .all();
  const runningWorkflowRuns = database
    .prepare<[], Pick<WorkflowRunRow, "repository_name">>(
      `
        SELECT repository_name
        FROM workflow_runs
        WHERE status = 'running'
      `,
    )
    .all();

  return [...runningCiJobs, ...runningWorkflowRuns];
}

function listQueuedExecutionRows(database: DatabaseSync): readonly RunnableExecutionRow[] {
  const queuedCiJobs = database
    .prepare<[], CiJobRow>(
      `
        SELECT ci_jobs.*
        FROM ci_jobs
        INNER JOIN pull_requests ON pull_requests.id = ci_jobs.pull_request_id
        WHERE ci_jobs.status = 'queued'
          AND pull_requests.latest_job_id = ci_jobs.id
      `,
    )
    .all()
    .map<RunnableExecutionRow>((job) => ({
      id: job.id,
      branch_name: job.branch_name,
      commit_hash: job.commit_hash,
      created_at: job.created_at,
      execution_repository_path: null,
      kind: "pull_request",
      log_path: null,
      pull_request_id: job.pull_request_id,
      remote_name: job.remote_name,
      repository_name: job.repository_name,
      repository_path: job.repository_path,
      workflow_name: null,
      base_branch: job.base_branch,
    }));
  const queuedWorkflowRuns = database
    .prepare<[], WorkflowRunRow>(
      `
        SELECT *
        FROM workflow_runs
        WHERE status = 'queued'
      `,
    )
    .all()
    .map<RunnableExecutionRow>((workflowRun) => ({
      id: workflowRun.id,
      branch_name: workflowRun.branch_name,
      commit_hash: workflowRun.commit_hash,
      created_at: workflowRun.created_at,
      execution_repository_path: workflowRun.execution_repository_path,
      kind: "workflow_run",
      log_path: workflowRun.log_path,
      pull_request_id: null,
      remote_name: null,
      repository_name: workflowRun.repository_name,
      repository_path: workflowRun.repository_path,
      workflow_name: workflowRun.workflow_name,
      base_branch: null,
    }));

  return [...queuedCiJobs, ...queuedWorkflowRuns].sort(compareQueuedExecutionRows);
}

function countQueuedExecutionsThrough(
  database: DatabaseSync,
  kind: RunnableExecutionRow["kind"],
  id: string,
): number {
  const queuedExecutions = listQueuedExecutionRows(database);
  const queueIndex = queuedExecutions.findIndex(
    (execution) => execution.kind === kind && execution.id === id,
  );

  return queueIndex === -1 ? 1 : queueIndex + 1;
}

function compareQueuedExecutionRows(
  left: RunnableExecutionRow,
  right: RunnableExecutionRow,
): number {
  if (left.created_at !== right.created_at) {
    return left.created_at.localeCompare(right.created_at);
  }

  return buildExecutionSortKey(left).localeCompare(buildExecutionSortKey(right));
}

function buildExecutionSortKey(row: Pick<RunnableExecutionRow, "kind" | "id">): string {
  return `${row.kind}:${row.id}`;
}

function toPullRequestSummaryRecord(row: PullRequestSummaryRow): PullRequestSummaryRecord {
  return {
    pullRequest: toPullRequestRecord(row),
    latestJob: toSummaryCiJobRecord(row),
    state: row.status === "merged" ? "merged" : "open",
  };
}

function toPullRequestRecord(row: PullRequestRow): PullRequestRecord {
  return {
    id: row.id,
    repositoryName: row.repository_name,
    repositoryPath: row.repository_path,
    branchName: row.branch_name,
    baseBranch: row.base_branch,
    title: row.title,
    body: row.body,
    draft: row.draft === 1,
    headCommitHash: row.head_commit_hash,
    remoteName: row.remote_name,
    status: row.status,
    latestJobId: row.latest_job_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSummaryCiJobRecord(row: PullRequestSummaryRow): CiJobRecord | null {
  if (row.ci_job_id === null) {
    return null;
  }

  return {
    id: row.ci_job_id,
    pullRequestId: row.ci_pull_request_id!,
    repositoryName: row.ci_repository_name!,
    repositoryPath: row.ci_repository_path!,
    branchName: row.ci_branch_name!,
    baseBranch: row.ci_base_branch!,
    commitHash: row.ci_commit_hash!,
    remoteName: row.ci_remote_name,
    status: row.ci_status!,
    resultPath: row.ci_result_path,
    errorMessage: row.ci_error_message,
    mergeStatus: row.ci_merge_status,
    createdAt: row.ci_created_at!,
    updatedAt: row.ci_updated_at!,
    startedAt: row.ci_started_at,
    finishedAt: row.ci_finished_at,
  };
}

function toPullRequestActivityEventRecord(
  row: PullRequestActivityEventRow,
): PullRequestActivityEventRecord {
  return {
    id: row.id,
    pullRequestId: row.pull_request_id,
    repositoryName: row.repository_name,
    repositoryPath: row.repository_path,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    jobId: row.job_id,
    createdAt: row.created_at,
  };
}

function toCiJobRecord(row: CiJobRow): CiJobRecord {
  return {
    id: row.id,
    pullRequestId: row.pull_request_id,
    repositoryName: row.repository_name,
    repositoryPath: row.repository_path,
    branchName: row.branch_name,
    baseBranch: row.base_branch,
    commitHash: row.commit_hash,
    remoteName: row.remote_name,
    status: row.status,
    resultPath: row.result_path,
    errorMessage: row.error_message,
    mergeStatus: row.merge_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function toWorkflowRunRecord(row: WorkflowRunRow): WorkflowRunRecord {
  return {
    id: row.id,
    repositoryName: row.repository_name,
    repositoryPath: row.repository_path,
    branchName: row.branch_name,
    commitHash: row.commit_hash,
    workflowName: row.workflow_name,
    status: row.status,
    logPath: row.log_path,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}
