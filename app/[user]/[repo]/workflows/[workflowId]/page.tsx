import Link from "next/link";
import { notFound } from "next/navigation";
import {
  configuredOwner,
  getRepositoryHref,
  getRepositoryWorkflowsHref,
  isConfiguredOwner,
} from "@/lib/owner";
import { getRepositoryByName } from "@/lib/repositories";
import { getWorkflowRunPageData } from "@/lib/workflow-runs/service";
import { WorkflowRunRequestError } from "@/lib/workflow-runs/validation";
import { WorkflowRunDetailClient } from "./workflow-run-detail-client";

export const dynamic = "force-dynamic";

type WorkflowRunPageParams = Readonly<{
  user: string;
  repo: string;
  workflowId: string;
}>;

type WorkflowRunPageProps = Readonly<{
  params: Promise<WorkflowRunPageParams> | WorkflowRunPageParams;
}>;

export default async function WorkflowRunPage({ params }: WorkflowRunPageProps) {
  const { user, repo, workflowId } = await Promise.resolve(params);

  if (!isConfiguredOwner(user)) {
    notFound();
  }

  const repository = getRepositoryByName(repo);

  if (!repository) {
    notFound();
  }

  const repositoryHref = getRepositoryHref(repository.name);
  const repositoryWorkflowsHref = getRepositoryWorkflowsHref(repository.name);
  let response: ReturnType<typeof getWorkflowRunPageData>;

  try {
    response = getWorkflowRunPageData({
      repositoryName: repository.name,
      workflowId,
    });
  } catch (error) {
    if (error instanceof WorkflowRunRequestError && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }

  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="workflow-run-heading">
        <p className="hero-eyebrow">workflow run</p>
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
          <span className="page-link-separator" aria-hidden="true">
            /
          </span>
          <Link href={repositoryWorkflowsHref} className="page-link">
            Back to workflows
          </Link>
        </p>
        <h1 id="workflow-run-heading">
          {configuredOwner.username}/{repository.name}
        </h1>
        <p className="hero-subtitle">
          Inspect <code>{response.workflowRun.workflowName}</code> from <code>{workflowId}</code>{" "}
          without leaving the repo route.
        </p>
        <WorkflowRunDetailClient
          initialLogOffset={response.initialLog.nextOffset}
          initialLogText={response.initialLog.text}
          initialWorkflowRun={response.workflowRun}
        />
      </section>
    </main>
  );
}
