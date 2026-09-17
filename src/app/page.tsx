import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="foundation-app">
      <nav className="foundation-nav" aria-label="Primary navigation">
        <Link className="foundation-brand" href="/" aria-label="Schooliva home">
          <Image src="/brand/logo.png" alt="Schooliva" width={180} height={68} priority />
        </Link>
        <div className="foundation-nav__links">
          <a href="#foundation">Foundation</a>
          <a href="/README.md">Documentation</a>
          <Link className="foundation-nav__login" href="/sign-in">Sign in <span aria-hidden="true">-&gt;</span></Link>
        </div>
      </nav>

      <section className="foundation-hero" aria-labelledby="hero-title">
        <div className="foundation-hero__copy">
          <div className="foundation-kicker"><span aria-hidden="true" /> Production foundation</div>
          <h1 id="hero-title">A clearer operating system for your school.</h1>
          <p>Schooliva brings the daily work of a school into one calm, permission-aware workspace built for people, progress, and confident decisions.</p>
          <div className="foundation-hero__actions">
            <Link className="foundation-primary-action" href="/sign-in">Open the workspace <span aria-hidden="true">-&gt;</span></Link>
            <a className="foundation-secondary-action" href="#foundation">See the foundation</a>
          </div>
          <div className="foundation-trust"><span>Ready for real operations</span><span>Secure by design</span><span>Built to grow</span></div>
        </div>

        <div className="workspace-preview" aria-label="Schooliva workspace preview">
          <div className="workspace-preview__topbar"><span className="workspace-preview__dots"><i /><i /><i /></span><span>schooliva.app / workspace</span><span className="workspace-preview__avatar">A</span></div>
          <div className="workspace-preview__body">
            <aside className="workspace-preview__sidebar"><strong>schooliva</strong><span className="is-active">Overview</span><span>Students</span><span>Attendance</span><span>Finance</span><span>Reports</span></aside>
            <div className="workspace-preview__content">
              <div className="workspace-preview__heading"><div><small>Monday, 17 September</small><h2>Good morning, Admin.</h2></div><span className="workspace-preview__status">All systems ready</span></div>
              <div className="workspace-preview__metrics"><article><span>Students</span><strong>1,248</strong><small>+12 this term</small></article><article><span>Attendance</span><strong>93%</strong><small>Today</small></article><article><span>Collected</span><strong>84%</strong><small>This month</small></article></div>
              <div className="workspace-preview__lower"><div className="workspace-preview__chart"><span>Attendance overview</span><div className="workspace-preview__chart-lines"><i /><i /><i /><i /><i /></div><div className="workspace-preview__chart-area" /></div><div className="workspace-preview__activity"><span>Recent activity</span><p><b>New student enrolled</b><small>2 min ago</small></p><p><b>Fee payment received</b><small>15 min ago</small></p><p><b>Exam result published</b><small>1 hour ago</small></p></div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="foundation-section" id="foundation" aria-labelledby="foundation-title">
        <div className="foundation-section__heading"><div><p className="foundation-kicker">Built for the long run</p><h2 id="foundation-title">The right foundation makes every next step clearer.</h2></div><p>Start with a dependable core for academic, financial, and operational work. Add depth as your school grows.</p></div>
        <div className="principles-grid"><article><span className="principle-number">01</span><h3>One source of truth</h3><p>Academic, financial, and operational data remain connected in a single secure workspace.</p></article><article><span className="principle-number">02</span><h3>Security by design</h3><p>Access stays permission-aware while keeping the experience clear, fast, and trustworthy.</p></article><article><span className="principle-number">03</span><h3>Modules that stay clear</h3><p>Each operational area is neatly organized so teams can move from planning to action with confidence.</p></article></div>
      </section>

      <footer className="foundation-footer"><span>Schooliva / Production foundation</span><span>Next.js / TypeScript / Supabase-ready</span></footer>
    </main>
  );
}