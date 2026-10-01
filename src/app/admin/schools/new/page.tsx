import Link from "next/link";
import { redirect } from "next/navigation";

import { createSchool } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { isMasterAdminUser } from "@/lib/auth/roles";

export default async function NewSchoolPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const isAdmin = await isMasterAdminUser(supabase, user.id);
  if (!isAdmin) redirect("/dashboard?error=not-authorized");

  return (
    <AdminShell title="Create New School" description="Add a new tenant using the fields currently supported by the Schooliva schema." breadcrumbs={[{ label: "Schools", href: "/admin/schools" }, { label: "Create New School" }]}>
      <section className="setup-card" style={{ maxWidth: 900 }}>
        <form action={createSchool} className="student-form" style={{ display: "grid", gap: 16 }}>
          <div className="student-form-grid">
            <label className="student-field">School name<input name="name" required /></label>
            <label className="student-field">School code<input name="code" required /></label>
            <label className="student-field">Email<input type="email" name="email" /></label>
            <label className="student-field">Phone<input name="phone" /></label>
            <label className="student-field">Address<input name="address" /></label>
            <label className="student-field">City<input name="city" /></label>
            <label className="student-field">State<input name="state" /></label>
            <label className="student-field">Country<input name="country" /></label>
            <label className="student-field">Status<select name="status" defaultValue="active"><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></label>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button type="submit" className="dashboard-action dashboard-action--primary">Create School</button>
            <Link href="/admin/schools" className="dashboard-action">Back</Link>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
