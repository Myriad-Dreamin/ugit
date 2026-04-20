import Link from "next/link";
import { notFound } from "next/navigation";
import {
  configuredOwner,
  getRepositoryHref,
  getRepositoryPullRequestsHref,
  getRepositoryWorkflowsHref,
  isConfiguredOwner,
} from "@/lib/owner";
import { getRepositoryByName, listRepositoryRootEntries } from "@/lib/repositories";

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
  const repositoryPullRequestsHref = getRepositoryPullRequestsHref(repository.name);
  const repositoryWorkflowsHref = getRepositoryWorkflowsHref(repository.name);

  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="repository-heading">
        <p className="hero-eyebrow">repository root</p>
        <p className="page-link-row">
          <Link href="/" className="page-link">
            Back to repositories
          </Link>
        </p>
        <p className="page-link-row">
          <Link href={repositoryPullRequestsHref} className="page-link">
            View pull requests
          </Link>
        </p>
        <p className="page-link-row">
          <Link href={repositoryWorkflowsHref} className="page-link">
            View workflow runs
          </Link>
        </p>
        <h1 id="repository-heading">
          {configuredOwner.username}/{repository.name}
        </h1>
        <p className="hero-subtitle">
          Direct children from <code>{repository.relativePath}</code>, served at{" "}
          <code>{repositoryHref}</code>.
        </p>
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
      </section>
    </main>
  );
}
