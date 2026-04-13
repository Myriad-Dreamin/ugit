import Link from "next/link";
import { getHomepageContent } from "@/lib/storage/homepage";
import { configuredOwner, getRepositoryHref } from "@/lib/owner";
import { listRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const homepageContent = await getHomepageContent();
  const repositories = listRepositories();

  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="repositories-heading">
        <p className="hero-eyebrow">{homepageContent.eyebrow}</p>
        <h1 id="repositories-heading">
          {homepageContent.title} <code>{homepageContent.repositoriesPath}</code>
        </h1>
        <p className="hero-subtitle">{homepageContent.subtitle}</p>
        <p className="hero-note">
          {homepageContent.endpointLabel}: <code>{homepageContent.endpointPath}</code>
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
