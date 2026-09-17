import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="site-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <Link className="brand-logo" href="/" aria-label="Schooliva home">
          <Image src="/brand/logo.png" alt="Schooliva" width={220} height={84} priority />
        </Link>
        <span className="status-chip"><span aria-hidden="true" /> Foundation phase</span>
      </nav>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">School operations, clearly managed</p>
          <h1 id="hero-title">A calmer way to run a school.</h1>
          <p className="hero-description">
            Schooliva brings academic operations, staff workflows, attendance, finance,
            and reporting into one clean, modern system that supports growth without noise.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/sign-in">Explore the workspace <span aria-hidden="true">-&gt;</span></Link>
            <a className="text-action" href="/README.md">Read the docs <span aria-hidden="true">-&gt;</span></a>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit-core"><span>01</span><strong>school<br />system</strong></div>
          <span className="orbit-label label-top">people</span>
          <span className="orbit-label label-right">progress</span>
          <span className="orbit-label label-bottom">possibility</span>
        </div>
      </section>

      <section className="foundation-section" id="foundation" aria-labelledby="foundation-title">
        <div className="section-heading">
          <p className="eyebrow">Built for the long run</p>
          <h2 id="foundation-title">A foundation with room to grow.</h2>
        </div>
        <div className="principles-grid">
          <article><span className="principle-number">01</span><h3>One source of truth</h3><p>Academic, financial, and operational data remain connected in a single secure workspace.</p></article>
          <article><span className="principle-number">02</span><h3>Security by design</h3><p>Access stays permission-aware while keeping the experience clear, fast, and trustworthy.</p></article>
          <article><span className="principle-number">03</span><h3>Modules that stay clear</h3><p>Each operational area is neatly organized so users can move from planning to action with confidence.</p></article>
        </div>
      </section>

      <footer className="footer"><span>Schooliva / Phase 0</span><span>Next.js / TypeScript / Supabase-ready</span></footer>
    </main>
  );
}