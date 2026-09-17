import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CertificateForm } from "@/components/documents/certificate-forms";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  const schoolId = membership.school_id as string;
  const [{ data: students }, { data: certificates }, { data: schoolDocuments }] = await Promise.all([
    supabase.from("students").select("id,first_name,last_name,admission_number").eq("school_id", schoolId).eq("is_active", true).order("last_name"),
    supabase.from("certificate_records").select("id,certificate_type,certificate_number,issued_on,status,student_id,students(first_name,last_name,admission_number)").eq("school_id", schoolId).order("issued_on", { ascending: false }),
    supabase.from("school_documents").select("id,document_type,document_name,storage_path,created_at").eq("school_id", schoolId).order("created_at", { ascending: false }),
  ]);
  const studentOptions = (students ?? []).map((student) => ({ id: String(student.id), name: `${student.first_name ?? ""} ${student.last_name ?? ""} (${student.admission_number ?? "-"})`.trim() }));
  return <main className="students-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header><section className="students-heading"><div><p className="eyebrow">Documents</p><h1>Documents & certificates.</h1><p>Store document metadata securely and issue print-friendly certificate records.</p></div></section><section className="setup-card"><h3>Issue certificate</h3><CertificateForm students={studentOptions} /></section><div className="student-table-wrap"><table className="student-table"><thead><tr><th>Certificate</th><th>Student</th><th>Number</th><th>Issued</th><th>Status</th><th>Action</th></tr></thead><tbody>{(certificates ?? []).length ? (certificates ?? []).map((certificate) => { const student = Array.isArray(certificate.students) ? certificate.students[0] : certificate.students; return <tr key={String(certificate.id)}><td>{String(certificate.certificate_type)}</td><td>{student?.first_name} {student?.last_name}</td><td>{String(certificate.certificate_number)}</td><td>{String(certificate.issued_on)}</td><td><span className={`status-pill ${String(certificate.status)}`}>{String(certificate.status)}</span></td><td><Link className="text-action" href={`/documents/certificates/${certificate.id}`}>Print -&gt;</Link></td></tr>; }) : <tr><td colSpan={6}><div className="student-empty"><h3>No certificates yet</h3><p>Issued certificates will appear here.</p></div></td></tr>}</tbody></table></div>{(schoolDocuments ?? []).length > 0 && <div className="student-table-wrap" style={{ marginTop: 24 }}><table className="student-table"><thead><tr><th>Document</th><th>Type</th><th>Path</th><th>Created</th></tr></thead><tbody>{(schoolDocuments ?? []).map((document) => <tr key={String(document.id)}><td>{String(document.document_name)}</td><td>{String(document.document_type)}</td><td>{String(document.storage_path)}</td><td>{new Date(String(document.created_at)).toLocaleDateString()}</td></tr>)}</tbody></table></div>}</main>;
}
