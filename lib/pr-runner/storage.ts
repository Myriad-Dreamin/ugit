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
import type { ValidatedPullRequestSyncRequest } from "./validation";

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

export type QueuePullRequestResult = Readonly<{
  job: CiJobRecord;
  pullRequest: PullRequestRecord;
  queuePosition: number;
}>;

export type QueuePullRequestOptions = Readonly<{
  now?: () => Date;
  storage?: StorageOptions | string;
  jobIdFactory?: () => string;
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

type CountRow = {
  total: number;
};

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
        let pullRequestId = existingPullRequest?.id ?? null;

        if (pullRequestId === null) {
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

        const queuePosition =
          (transaction
            .prepare<[string, string, string], CountRow>(
              `
                SELECT COUNT(*) AS total
                FROM ci_jobs
                WHERE status = 'queued'
                  AND (created_at < ? OR (created_at = ? AND id <= ?))
              `,
            )
            .get(now, now, jobId)?.total ??
            1) ||
          1;

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

export function selectRunnableJobs<T extends Pick<CiJobRow, "repository_path">>(
  queuedJobs: readonly T[],
  runningRepositoryPaths: ReadonlySet<string>,
  limit: number,
): readonly T[] {
  const claimedRepositoryPaths = new Set(runningRepositoryPaths);
  const selectedJobs: T[] = [];

  for (const job of queuedJobs) {
    if (selectedJobs.length >= limit) {
      break;
    }

    if (claimedRepositoryPaths.has(job.repository_path)) {
      continue;
    }

    claimedRepositoryPaths.add(job.repository_path);
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
        const updateResult = transaction
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

        if (updateResult.changes > 0) {
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

        return updateResult.changes;
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
      return "merged";
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
