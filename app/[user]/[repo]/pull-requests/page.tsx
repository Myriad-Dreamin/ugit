import Link from "next/link";
import { notFound } from "next/navigation";
import {
  configuredOwner,
  getRepositoryHref,
  getRepositoryPullRequestsHref,
  isConfiguredOwner,
} from "@/lib/owner";
import { buildPullRequestsBootstrapUrl } from "@/lib/pull-requests/rest-bootstrap";
import { getRepositoryByName } from "@/lib/repositories";
import type { ListRepositoryPullRequestsResponse } from "@/packages/ugit-cli/src/pull-request-contract";
import { PullRequestsListClient } from "./pull-requests-list-client";

export const dynamic = "force-dynamic";

type RepositoryPullRequestsPageParams = Readonly<{
  user: string;
  repo: string;
}>;

type RepositoryPullRequestsPageProps = Readonly<{
  params: Promise<RepositoryPullRequestsPageParams> | RepositoryPullRequestsPageParams;
}>;

export default async function RepositoryPullRequestsPage({
  params,
}: RepositoryPullRequestsPageProps) {
  const { user, repo } = await Promise.resolve(params);

  if (!isConfiguredOwner(user)) {
    notFound();
  }

  const repository = getRepositoryByName(repo);

  if (!repository) {
    notFound();
  }

  const repositoryHref = getRepositoryHref(repository.name);
  const repositoryPullRequestsHref = getRepositoryPullRequestsHref(repository.name);
  const pullRequestsResponse = await fetch(await buildPullRequestsBootstrapUrl(repository.name), {
    cache: "no-store",
  });

  if (pullRequestsResponse.status === 404) {
    notFound();
  }

  if (!pullRequestsResponse.ok) {
    throw new Error(await readPullRequestsError(pullRequestsResponse));
  }

  const response = (await pullRequestsResponse.json()) as ListRepositoryPullRequestsResponse;

  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="repository-pull-requests-heading">
        <p className="hero-eyebrow">repository pull requests</p>
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
        <h1 id="repository-pull-requests-heading">
          {configuredOwner.username}/{repository.name}
        </h1>
        <p className="hero-subtitle">
          Live pull-request status for <code>{repository.relativePath}</code>, refreshed in the
          browser without leaving <code>{repositoryPullRequestsHref}</code>.
        </p>
        <PullRequestsListClient
          initialPullRequests={response.pullRequests}
          repositoryName={repository.name}
        />
      </section>
    </main>
  );
}

async function readPullRequestsError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string;
    };

    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {}

  return `Failed to load pull requests: ${response.status} ${response.statusText}`.trim();
}
