import Link from "next/link";
import { notFound } from "next/navigation";
import { configuredOwner, getRepositoryHref, isConfiguredOwner } from "@/lib/owner";
import { getRepositoryByName, listRepositoryRootEntries } from "@/lib/repositories";
import {
  getRepositoryWorkflowPanelSummary,
  type RepositoryWorkflowBranchSummary,
  type RepositoryWorkflowPanelStatus,
  type RepositoryWorkflowStatus,
} from "@/lib/repository-workflow-summary";

export const dynamic = "force-dynamic";

type RepositoryPageParams = Readonly<{
  user: string;
  repo: string;
}>;

type RepositoryPageProps = Readonly<{
  params: Promise<RepositoryPageParams> | RepositoryPageParams;
}>;

export default async function RepositoryPage({ params }: RepositoryPageProps) {
  const { user, repo } = await Promise.resolve(params);

  if (!isConfiguredOwner(user)) {
    notFound();
  }

  const repository = getRepositoryByName(repo);

  if (!repository) {
    notFound();
  }

  const entries = listRepositoryRootEntries(repository);
  const repositoryHref = getRepositoryHref(repository.name);
  const workflowSummary = getRepositoryWorkflowPanelSummary(repository);

  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="repository-heading">
        <p className="hero-eyebrow">repository overview</p>
        <p className="page-link-row">
          <Link href="/" className="page-link">
            Back to repositories
          </Link>
        </p>
        <h1 id="repository-heading">
          {configuredOwner.username}/{repository.name}
        </h1>
        <p className="hero-subtitle">
          Direct children from <code>{repository.relativePath}</code>, served at{" "}
          <code>{repositoryHref}</code>.
        </p>
        <div className="repository-panels">
          <WorkflowStatusPanel summary={workflowSummary} />
          <div className="repositories-panel">
            <div className="repositories-header">
              <h2>Repository root entries</h2>
              <p>
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </p>
            </div>
            {entries.length === 0 ? (
              <p className="empty-state">
                No files or directories are available at this repository root.
              </p>
            ) : (
              <ul className="entries-list">
                {entries.map((entry) => (
                  <li key={entry.relativePath} className="entry-item">
                    <div>
                      <p className="entry-name">{entry.name}</p>
                      <p className="entry-kind">
                        {entry.kind === "directory" ? "Directory" : "File"}
                      </p>
                    </div>
                    <code className="repository-relative-path">{entry.relativePath}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

type WorkflowStatusPanelProps = Readonly<{
  summary: ReturnType<typeof getRepositoryWorkflowPanelSummary>;
}>;

function WorkflowStatusPanel({ summary }: WorkflowStatusPanelProps) {
  return (
    <div className="repositories-panel" aria-labelledby="workflow-status-heading">
      <div className="repositories-header">
        <h2 id="workflow-status-heading">Workflow status</h2>
        <p>
          {summary.branchSummaries.length}{" "}
          {summary.branchSummaries.length === 1 ? "branch" : "branches"}
        </p>
      </div>
      <p className="workflow-panel-status">
        <span className={`status-badge status-${summary.status}`}>
          {formatWorkflowStatusLabel(summary.status)}
        </span>
      </p>
      {summary.branchSummaries.length === 0 ? (
        <p className="empty-state">
          No triggered workflows have been recorded for this repository yet.
        </p>
      ) : (
        <ul className="workflow-summary-list">
          {summary.branchSummaries.map((branchSummary) => (
            <WorkflowBranchCard key={branchSummary.branchName} summary={branchSummary} />
          ))}
        </ul>
      )}
    </div>
  );
}

type WorkflowBranchCardProps = Readonly<{
  summary: RepositoryWorkflowBranchSummary;
}>;

function WorkflowBranchCard({ summary }: WorkflowBranchCardProps) {
  const timestamps = [
    summary.queuedAt ? { label: "Queued", value: summary.queuedAt } : null,
    summary.startedAt ? { label: "Started", value: summary.startedAt } : null,
    summary.finishedAt ? { label: "Finished", value: summary.finishedAt } : null,
  ].filter((timestamp): timestamp is { label: string; value: string } => timestamp !== null);
  const hasMixedWorkflowResults =
    summary.workflows.some((workflow) => workflow.status === "passed") &&
    summary.workflows.some((workflow) => workflow.status === "failed");

  return (
    <li className="workflow-summary-item">
      <div className="workflow-summary-header">
        <div>
          <p className="workflow-branch-name">{summary.branchName}</p>
          <p className="workflow-commit">
            Commit <code>{formatCommitHash(summary.commitHash)}</code>
          </p>
        </div>
        <span className={`status-badge status-${summary.status}`}>
          {formatWorkflowStatusLabel(summary.status)}
        </span>
      </div>
      {timestamps.length > 0 ? (
        <dl className="workflow-metadata-list">
          {timestamps.map((timestamp) => (
            <div key={timestamp.label}>
              <dt>{timestamp.label}</dt>
              <dd>
                <time dateTime={timestamp.value}>{formatTimestamp(timestamp.value)}</time>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {summary.source === "active_job" ? (
        <p className="workflow-note">
          Detailed workflow results will appear after this run finishes.
        </p>
      ) : summary.workflows.length === 0 ? (
        <p className="workflow-note">No individual workflow results were recorded for this run.</p>
      ) : (
        <div className="workflow-results">
          <p className="workflow-results-label">
            {hasMixedWorkflowResults ? "Mixed workflow results" : "Workflow results"}
          </p>
          <ul className="workflow-results-list">
            {summary.workflows.map((workflow) => (
              <li key={workflow.name} className="workflow-result-item">
                <span className="workflow-result-name">{workflow.name}</span>
                <span
                  className={`status-badge status-${mapWorkflowStatusToBadge(workflow.status)}`}
                >
                  {workflow.status === "passed" ? "Passed" : "Failed"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function formatWorkflowStatusLabel(
  status: RepositoryWorkflowPanelStatus | RepositoryWorkflowStatus,
): string {
  switch (status) {
    case "empty":
      return "Empty";
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "succeeded":
      return "Succeeded";
    case "failed":
      return "Failed";
    case "mixed":
      return "Mixed results";
  }
}

function formatCommitHash(commitHash: string): string {
  return commitHash.slice(0, 7);
}

function formatTimestamp(timestamp: string): string {
  const parsedTimestamp = new Date(timestamp);

  if (Number.isNaN(parsedTimestamp.getTime())) {
    return timestamp;
  }

  return parsedTimestamp
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

function mapWorkflowStatusToBadge(status: "passed" | "failed"): "succeeded" | "failed" {
  return status === "passed" ? "succeeded" : "failed";
}
