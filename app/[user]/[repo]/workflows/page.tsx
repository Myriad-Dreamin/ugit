import Link from "next/link";
import { notFound } from "next/navigation";
import {
  configuredOwner,
  getRepositoryHref,
  getRepositoryWorkflowsHref,
  isConfiguredOwner,
} from "@/lib/owner";
import { getRepositoryByName } from "@/lib/repositories";
import { buildWorkflowRunsBootstrapUrl } from "@/lib/workflow-runs/rest-bootstrap";
import type { ListWorkflowRunsResponse } from "@/packages/ugit-cli/src/workflow-contract";
import { WorkflowRunsListClient } from "./workflow-runs-list-client";

export const dynamic = "force-dynamic";

type RepositoryWorkflowsPageParams = Readonly<{
  user: string;
  repo: string;
}>;

type RepositoryWorkflowsPageProps = Readonly<{
  params: Promise<RepositoryWorkflowsPageParams> | RepositoryWorkflowsPageParams;
}>;

export default async function RepositoryWorkflowsPage({ params }: RepositoryWorkflowsPageProps) {
  const { user, repo } = await Promise.resolve(params);

  if (!isConfiguredOwner(user)) {
    notFound();
  }

  const repository = getRepositoryByName(repo);

  if (!repository) {
    notFound();
  }

  const repositoryHref = getRepositoryHref(repository.name);
  const repositoryWorkflowsHref = getRepositoryWorkflowsHref(repository.name);
  const workflowRunsResponse = await fetch(await buildWorkflowRunsBootstrapUrl(repository.name), {
    cache: "no-store",
  });

  if (workflowRunsResponse.status === 404) {
    notFound();
  }

  if (!workflowRunsResponse.ok) {
    throw new Error(await readWorkflowRunsError(workflowRunsResponse));
  }

  const response = (await workflowRunsResponse.json()) as ListWorkflowRunsResponse;

  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="repository-workflows-heading">
        <p className="hero-eyebrow">repository workflows</p>
        <p className="page-link-row page-link-group">
          <Link href="/" className="page-link">
            Back to repositories
          </Link>
          <span className="page-link-separator" aria-hidden="true">
            /
          </span>
          <Link href={repositoryHref} className="page-link">
            Back to repository
          </Link>
        </p>
        <h1 id="repository-workflows-heading">
          {configuredOwner.username}/{repository.name}
        </h1>
        <p className="hero-subtitle">
          Live workflow status for <code>{repository.relativePath}</code>, refreshed in the browser
          without leaving <code>{repositoryWorkflowsHref}</code>.
        </p>
        <WorkflowRunsListClient
          initialWorkflowRuns={response.workflowRuns}
          repositoryName={repository.name}
        />
      </section>
    </main>
  );
}

async function readWorkflowRunsError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
    };

    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {}

  return `Failed to load workflow runs: ${response.status} ${response.statusText}`.trim();
}
