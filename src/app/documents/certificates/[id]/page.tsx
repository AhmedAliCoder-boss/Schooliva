import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/documents/print-button";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: certificate } = await supabase.from("certificate_records").select("id,certificate_type,certificate_number,issued_on,status,content,students(first_name,middle_name,last_name,admission_number),schools(name,address,phone,email)").eq("id", id).eq("status", "issued").maybeSingle();
  if (!certificate) notFound();
  const student = Array.isArray(certificate.students) ? certificate.students[0] : certificate.students;
  const school = Array.isArray(certificate.schools) ? certificate.schools[0] : certificate.schools;
  const content = certificate.content as { text?: string } | null;
  return <main className="certificate-page"><header className="students-header no-print"><Link className="wordmark" href="/documents"><span className="wordmark-mark">S</span><span>schooliva</span></Link><PrintButton /></header><article className="certificate-sheet"><p className="eyebrow">{school?.name ?? "Schooliva"}</p><h1>{String(certificate.certificate_type).replace("_", " ").toUpperCase()} CERTIFICATE</h1><p className="certificate-number">Certificate no: {String(certificate.certificate_number)}</p><p>This is to certify that</p><h2>{student?.first_name} {student?.middle_name ?? ""} {student?.last_name}</h2><p>Admission number: {student?.admission_number ?? "-"}</p><p className="certificate-content">{content?.text ?? "This certificate is issued from the official Schooliva school record."}</p><p>Issued on {String(certificate.issued_on)}</p><div className="certificate-signatures"><span>Class teacher</span><span>Principal / Head</span></div></article><style>{`@media print { .no-print { display: none !important; } body { background: white; } .certificate-sheet { box-shadow: none !important; border: 0 !important; } }`}</style></main>;
}
