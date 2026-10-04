import Link from "next/link";

export default function AdmissionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="admissions-header">
        <Link href="/admissions" className="admissions-header__brand">
          <span className="admissions-header__mark" aria-hidden="true">A</span>
          <span>
            <strong>Admissions</strong>
            <small>Applicant management</small>
          </span>
        </Link>
        <nav className="admissions-header__nav" aria-label="Admissions navigation">
          <Link href="/admissions">Overview</Link>
          <Link href="/admissions/applications">Applications</Link>
          <Link href="/admissions/new" className="admissions-header__action">New application <span aria-hidden="true">+</span></Link>
        </nav>
      </header>
      {children}
    </>
  );
}
