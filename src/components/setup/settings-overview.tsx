import Link from "next/link";

type SettingsOverviewProps = {
  school: Record<string, string | null>;
  activeSessions: number;
  activeTerms: number;
  activeClasses: number;
  activeSections: number;
  activeSubjects: number;
};

const settingsGroups = [
  {
    title: "School foundation",
    description: "Identity, academic calendar, and the structure used across school records.",
    items: [
      { title: "School identity", detail: "Name, contact details, campus, board, principal, and location.", href: "/setup?section=school", action: "Edit school profile" },
      { title: "School data backup", detail: "Download a compressed, school-scoped snapshot of database records.", href: "/setup?section=backup", action: "Create backup" },
      { title: "Academic sessions", detail: "Create and manage school years and their active status.", href: "/setup?section=sessions", action: "Manage sessions" },
      { title: "Terms & periods", detail: "Set term dates and connect them to academic sessions.", href: "/setup?section=terms", action: "Manage terms" },
      { title: "Classes & sections", detail: "Organize class levels, section capacity, and class teachers.", href: "/setup?section=classes", action: "Manage classes" },
      { title: "Subjects & curriculum", detail: "Maintain subjects and class-to-subject assignments.", href: "/setup?section=subjects", action: "Manage subjects" },
      { title: "Class-subject assignments", detail: "Assign subjects to classes and review existing mappings.", href: "/setup?section=assignments", action: "Manage assignments" },
    ],
  },
  {
    title: "Teaching & assessment",
    description: "Open the existing workflows that define daily teaching and evaluation.",
    items: [
      { title: "Timetable", detail: "Configure working days, periods, teacher assignments, and schedules.", href: "/timetable", action: "Open timetable" },
      { title: "Examinations", detail: "Manage exams, schedules, assessment records, and results.", href: "/exams", action: "Open examinations" },
      { title: "Curriculum workspace", detail: "Review curriculum planning and related academic workflows.", href: "/curriculum", action: "Open curriculum" },
    ],
  },
  {
    title: "Finance & people",
    description: "Access the school's existing financial and staff administration controls.",
    items: [
      { title: "Fee structures", detail: "Manage fee plans, charges, and finance workflows.", href: "/finance/fees", action: "Open fee setup" },
      { title: "Payroll policy", detail: "Configure payroll rules and staff compensation profiles.", href: "/payroll/settings", action: "Open payroll settings" },
      { title: "Users & access", detail: "Manage school user accounts and their access workflows.", href: "/users", action: "Manage users" },
    ],
  },
  {
    title: "School operations",
    description: "Jump directly into the operational workspaces already enabled for this school.",
    items: [
      { title: "Library", detail: "Manage books, circulation, and library records.", href: "/library", action: "Open library" },
      { title: "Transport", detail: "Manage routes, vehicles, student assignments, and transport fees.", href: "/transport", action: "Open transport" },
      { title: "Inventory", detail: "Manage stock, inventory items, and movements.", href: "/inventory", action: "Open inventory" },
      { title: "Food & cafeteria", detail: "Manage cafeteria menus and related service workflows.", href: "/cafeteria", action: "Open cafeteria" },
      { title: "Notifications", detail: "Review school announcements and role-based updates.", href: "/notifications", action: "Open notifications" },
    ],
  },
] as const;

function countLabel(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

export function SettingsOverview({
  school,
  activeSessions,
  activeTerms,
  activeClasses,
  activeSections,
  activeSubjects,
}: SettingsOverviewProps) {
  const profileFields = [
    ["School name", school.name],
    ["School code", school.code],
    ["School email", school.email],
    ["Contact number", school.phone],
    ["Location", [school.city, school.state, school.country].filter(Boolean).join(", ")],
    ["Principal", school.principal],
  ] as const;
  const completedProfileFields = profileFields.filter(([, value]) => Boolean(value?.trim())).length;

  return (
    <div className="settings-overview">
      <section className="settings-overview-hero" aria-label="School configuration overview">
        <div>
          <p className="settings-overview-kicker">School configuration</p>
          <h3>{school.name || "Your school workspace"}</h3>
          <p>Manage the real settings and workflows that shape your school, all from one place.</p>
        </div>
        <Link className="settings-overview-primary" href="/setup?section=school">Review school profile <span aria-hidden="true">-&gt;</span></Link>
      </section>

      <section className="settings-overview-metrics" aria-label="Current academic setup">
        <article><strong>{countLabel(activeSessions, "active session")}</strong><span>Academic sessions</span></article>
        <article><strong>{countLabel(activeTerms, "active term")}</strong><span>Academic terms</span></article>
        <article><strong>{activeClasses}</strong><span>Active classes</span></article>
        <article><strong>{activeSections}</strong><span>Active sections</span></article>
        <article><strong>{activeSubjects}</strong><span>Active subjects</span></article>
      </section>

      <section className="settings-overview-profile" aria-label="School profile completion">
        <div>
          <p className="settings-overview-kicker">Profile coverage</p>
          <h3>{completedProfileFields} of {profileFields.length} key details provided</h3>
          <p>These details are already used to identify and contact your school in supported workflows.</p>
        </div>
        <ul>
          {profileFields.map(([label, value]) => (
            <li key={label} className={value?.trim() ? "is-configured" : "is-missing"}>
              <span aria-hidden="true">{value?.trim() ? "✓" : "—"}</span>{label}
            </li>
          ))}
        </ul>
      </section>

      {settingsGroups.map((group) => (
        <section className="settings-overview-group" key={group.title}>
          <div className="settings-overview-group-heading">
            <div><p className="settings-overview-kicker">Configuration area</p><h3>{group.title}</h3></div>
            <p>{group.description}</p>
          </div>
          <div className="settings-overview-grid">
            {group.items.map((item, index) => (
              <article className="settings-overview-card" key={item.href}>
                <span className="settings-overview-card-index">{String(index + 1).padStart(2, "0")}</span>
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
                <Link href={item.href}>{item.action}<span aria-hidden="true">-&gt;</span></Link>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
