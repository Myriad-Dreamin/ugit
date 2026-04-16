import Link from "next/link";
import { notFound } from "next/navigation";
import {
  configuredOwner,
  getRepositoryHref,
  getRepositoryWorkflowsHref,
  isConfiguredOwner,
} from "@/lib/owner";
import { getRepositoryByName } from "@/lib/repositories";
import { listWorkflowRuns } from "@/lib/workflow-runs/service";
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
  const response = listWorkflowRuns({
    repositoryPath: repository.path,
  });

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
          repositoryPath={repository.path}
        />
      </section>
    </main>
  );
}
