import { listRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export default function HomePage() {
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
          JSON endpoint: <code>/api/repositories</code>
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
