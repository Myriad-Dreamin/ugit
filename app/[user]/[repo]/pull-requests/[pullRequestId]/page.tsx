import Link from "next/link";
import { notFound } from "next/navigation";
import {
  configuredOwner,
  getRepositoryHref,
  getRepositoryPullRequestsHref,
  isConfiguredOwner,
} from "@/lib/owner";
import { buildPullRequestBootstrapUrl } from "@/lib/pull-requests/rest-bootstrap";
import { getRepositoryByName } from "@/lib/repositories";
import type { GetRepositoryPullRequestResponse } from "@/packages/ugit-cli/src/pull-request-contract";
import { PullRequestDetailClient } from "./pull-request-detail-client";

export const dynamic = "force-dynamic";

type PullRequestPageParams = Readonly<{
  user: string;
  repo: string;
  pullRequestId: string;
}>;

type PullRequestPageProps = Readonly<{
  params: Promise<PullRequestPageParams> | PullRequestPageParams;
}>;

export default async function PullRequestPage({ params }: PullRequestPageProps) {
  const { user, repo, pullRequestId } = await Promise.resolve(params);

  if (!isConfiguredOwner(user)) {
    notFound();
  }

  const repository = getRepositoryByName(repo);

  if (!repository) {
    notFound();
  }

  const repositoryHref = getRepositoryHref(repository.name);
  const repositoryPullRequestsHref = getRepositoryPullRequestsHref(repository.name);
  const pullRequestResponse = await fetch(
    await buildPullRequestBootstrapUrl(repository.name, pullRequestId),
    {
      cache: "no-store",
    },
  );

  if (pullRequestResponse.status === 404) {
    notFound();
  }

  if (!pullRequestResponse.ok) {
    throw new Error(await readPullRequestError(pullRequestResponse));
  }

  const response = (await pullRequestResponse.json()) as GetRepositoryPullRequestResponse;

  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="pull-request-heading">
        <p className="hero-eyebrow">pull request</p>
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
          <Link href={repositoryPullRequestsHref} className="page-link">
            Back to pull requests
          </Link>
        </p>
        <h1 id="pull-request-heading">
          {configuredOwner.username}/{repository.name}
        </h1>
        <p className="hero-subtitle">
          Inspect pull request <code>#{response.pullRequest.id}</code> without leaving the repo
          route.
        </p>
        <PullRequestDetailClient initialPullRequest={response.pullRequest} />
      </section>
    </main>
  );
}

async function readPullRequestError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
    };

    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {}

  return `Failed to load pull request: ${response.status} ${response.statusText}`.trim();
}
