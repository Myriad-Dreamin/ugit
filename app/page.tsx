import Link from "next/link";
import { configuredOwner, getRepositoryHref } from "@/lib/owner";
import { listRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const repositories = listRepositories();

  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="repositories-heading">
        <p className="hero-eyebrow">ugit repositories</p>
        <h1 id="repositories-heading">
          Local repositories, served from <code>.data/repos</code>
        </h1>
        <p className="hero-subtitle">
          The server seeds a real example Git repository on demand and exposes the current
          repository listing over HTTP.
        </p>
        <p className="hero-note">
          Owner route prefix: <code>/{configuredOwner.username}</code>
        </p>
        <div className="repositories-panel">
          <div className="repositories-header">
            <h2>Available repositories</h2>
            <p>
              {repositories.length} {repositories.length === 1 ? "repository" : "repositories"}
            </p>
          </div>
          <ul className="repositories-list">
            {repositories.map((repository) => {
              const repositoryHref = getRepositoryHref(repository.name);

              return (
                <li key={repository.relativePath}>
                  <Link href={repositoryHref} className="repository-item">
                    <div>
                      <p className="repository-name">{repository.name}</p>
                      <p className="repository-relative-path">{repository.relativePath}</p>
                    </div>
                    <div className="repository-meta">
                      <code className="repository-path">{repository.path}</code>
                      <code className="repository-route">{repositoryHref}</code>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </main>
  );
}
