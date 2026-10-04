import { redirect } from "next/navigation";

import { AdmissionForm } from "@/components/admissions/admission-form";
import { requireAdmissionContext } from "@/lib/admissions/context";

const formErrors: Record<string, string> = {
  "invalid-application": "Please check the application details and try again.",
  "invalid-class": "The selected class is not available for this school.",
  "invalid-session": "The selected academic session is not available for this school.",
  "application-save-failed": "The application could not be saved. Please try again.",
};

export default async function NewAdmissionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, schoolId } = await requireAdmissionContext("create");
  const params = await searchParams;
  const [{ data: classes, error: classesError }, { data: sessions, error: sessionsError }] = await Promise.all([
    supabase.from("classes").select("id,name").eq("school_id", schoolId).order("grade_level", { ascending: true }),
    supabase.from("academic_sessions").select("id,name,is_current").eq("school_id", schoolId).order("starts_on", { ascending: false }),
  ]);
  if (classesError || sessionsError) {
    return <main className="admissions-page"><section className="admissions-alert admissions-alert--error" role="alert">{classesError?.message ?? sessionsError?.message}</section></main>;
  }

  if (params.error && !formErrors[params.error]) redirect("/admissions/new");

  return (
    <main style={{ margin: "0 auto", maxWidth: 1100, padding: "28px 20px 52px" }}>
      {params.error && <p role="alert" style={{ background: "color-mix(in srgb, var(--brand-danger) 9%, var(--surface))", border: "1px solid color-mix(in srgb, var(--brand-danger) 28%, var(--line))", borderRadius: 10, color: "var(--brand-danger)", margin: "0 0 18px", padding: 14 }}>{formErrors[params.error]}</p>}
      <div style={{ marginBottom: 20 }}>
        <div>
          <p style={{ color: "var(--brand-primary)", fontSize: 12, fontWeight: 750, letterSpacing: ".12em", margin: 0, textTransform: "uppercase" }}>Admissions</p>
          <h1 style={{ color: "var(--brand-secondary)", fontSize: "clamp(28px, 5vw, 40px)", margin: "7px 0 0" }}>Create an application</h1>
          <p style={{ color: "var(--ink-soft)", margin: "8px 0 0" }}>Applicant records are saved to this school&apos;s admissions register.</p>
        </div>
      </div>
      <AdmissionForm
        classes={(classes ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }))}
        sessions={(sessions ?? []).map((item) => ({ id: String(item.id), name: String(item.name), isCurrent: Boolean(item.is_current) }))}
      />
    </main>
  );
}
