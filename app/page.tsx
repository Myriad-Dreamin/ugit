import { getHelloMessage } from "@/lib/hello";

export default function HomePage() {
  const { heading, subtitle } = getHelloMessage();

  return (
    <main className="page-shell">
      <section className="hero-card" aria-labelledby="hello-heading">
        <p className="hero-eyebrow">ugit starter</p>
        <h1 id="hello-heading">{heading}</h1>
        <p className="hero-subtitle">{subtitle}</p>
      </section>
    </main>
  );
}
