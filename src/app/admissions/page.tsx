import { requireAdmissionContext } from "@/lib/admissions/context";
import { createClient } from "@/lib/supabase/server";

export default async function AdmissionsPage() {
  const { schoolId } = await requireAdmissionContext("view");
  const supabase = await createClient();

  const { data: admissions, error } = await supabase
    .from("admissions")
    .select("id, application_date, status, documents_status, test_status, interview_status")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  const applications = admissions ?? [];
  const totalApplications = applications.length;
  const newApplications = applications.filter((admission) => {
    const date = new Date(admission.application_date);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;
  const countStatus = (status: string) => applications.filter((admission) => admission.status === status).length;
  const underReview = countStatus("under_review");
  const documentsPending = applications.filter((admission) => admission.documents_status === "pending" || admission.status === "documents_pending").length;
  const testPending = applications.filter((admission) => admission.test_status === "pending" || admission.status === "test_pending").length;
  const interviewPending = applications.filter((admission) => admission.interview_status === "pending" || admission.status === "interview_pending").length;
  const approved = countStatus("approved");
  const rejected = countStatus("rejected");
  const waitlisted = countStatus("waitlisted");
  const admitted = countStatus("admitted");
  const convertedToStudent = countStatus("converted_to_student");

  const cards = [
    { label: "Total Applications", value: totalApplications },
    { label: "New Applications", value: newApplications },
    { label: "Under Review", value: underReview },
    { label: "Documents Pending", value: documentsPending },
    { label: "Test Pending", value: testPending },
    { label: "Interview Pending", value: interviewPending },
    { label: "Approved", value: approved },
    { label: "Rejected", value: rejected },
    { label: "Waitlisted", value: waitlisted },
    { label: "Admitted", value: admitted },
    { label: "Converted to Student", value: convertedToStudent },
  ];

  return (
    <main style={{ display: 'grid', gap: 24, maxWidth: 1280, margin: '0 auto', padding: '24px 20px 48px' }}>
      {error && <section className="admissions-alert admissions-alert--error" role="alert"><strong>Admissions summary is unavailable.</strong> {error.message}</section>}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5b6472' }}>Admissions</p>
          <h1 style={{ margin: '8px 0 0', fontSize: 36 }}>Admission dashboard</h1>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {cards.map((card) => (
          <div key={card.label} style={{ border: '1px solid #e4ebf5', borderRadius: 16, background: '#fff', padding: 18 }}>
            <p style={{ margin: 0, color: '#5b6472', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{card.label}</p>
            <p style={{ margin: '12px 0 0', fontSize: 28, fontWeight: 800, color: '#1d2a39' }}>{card.value}</p>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <div style={{ border: '1px solid #e4ebf5', borderRadius: 16, background: '#fff', padding: 20 }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5b6472' }}>Applications by status</p>
          <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
            {[
              ['Submitted', totalApplications],
              ['Under review', underReview],
              ['Approved', approved],
              ['Rejected', rejected],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#324459', fontSize: 14 }}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
                <div style={{ height: 10, borderRadius: 99, background: '#eef3fb', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (Number(value) / Math.max(totalApplications, 1)) * 100)}%`, height: '100%', borderRadius: 99, background: '#2d6cdf' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ border: '1px solid #e4ebf5', borderRadius: 16, background: '#fff', padding: 20 }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5b6472' }}>Admissions overview</p>
          <ul style={{ margin: '18px 0 0', paddingLeft: 18, color: '#425266', lineHeight: 1.8 }}>
            <li>Applications are managed independently until accepted into the student register.</li>
            <li>Document, assessment, interview, and decision stages reflect saved application records.</li>
            <li>Admitted applicants can be converted into student records from their application.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
