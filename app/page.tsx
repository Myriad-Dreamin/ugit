import { getHomepageContent } from "@/lib/storage/homepage";
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
        <div className="repositories-panel">
          <div className="repositories-header">
            <h2>Available repositories</h2>
            <p>
              {repositories.length} {repositories.length === 1 ? "repository" : "repositories"}
            </p>
          </div>
          <ul className="repositories-list">
            {repositories.map((repository) => (
              <li key={repository.relativePath} className="repository-item">
                <div>
                  <p className="repository-name">{repository.name}</p>
                  <p className="repository-relative-path">{repository.relativePath}</p>
                </div>
                <code className="repository-path">{repository.path}</code>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
