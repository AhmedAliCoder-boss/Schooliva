import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/documents/print-button";
import { requireHrmContext } from "@/lib/hrm/context";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";

type DocumentType = "appointment" | "experience" | "employment_verification" | "promotion" | "relieving";
type GeneratedContent = {
  employeeName?: string;
  employeeCode?: string;
  employeeType?: string;
  designation?: string;
  department?: string;
  joiningDate?: string;
  employmentStatus?: string;
  effectiveDate?: string;
  endDate?: string;
  employmentType?: string;
  probationPeriod?: string;
  salary?: string;
  reportingTo?: string;
  workingHours?: string;
  responsibilities?: string;
  performance?: string;
  recipientName?: string;
  purpose?: string;
  previousDesignation?: string;
  reason?: string;
  clearanceStatus?: string;
  handoverDetails?: string;
  notes?: string;
};

const documentTitles: Record<DocumentType, string> = {
  appointment: "Appointment Letter",
  experience: "Experience Letter",
  employment_verification: "Employment Verification Letter",
  promotion: "Promotion Letter",
  relieving: "Relieving Letter",
};

function asContent(value: unknown): GeneratedContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GeneratedContent;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(date);
}

function labelForEmploymentType(value: string | undefined) {
  const labels: Record<string, string> = {
    full_time: "Full-time",
    part_time: "Part-time",
    contract: "Contract",
    temporary: "Temporary",
  };
  return value ? labels[value] ?? value : "";
}

function paragraphsFor(type: DocumentType, content: GeneratedContent, schoolName: string) {
  const name = content.employeeName || "the employee";
  const designation = content.designation || "Employee";
  const startDate = formatDate(content.effectiveDate || content.joiningDate);
  const endDate = formatDate(content.endDate);
  switch (type) {
    case "appointment":
      return [
        `Following approval by the school administration, ${name} is appointed to the position of ${designation}${content.department ? ` in ${content.department}` : ""} at ${schoolName}, with effect from ${startDate}.`,
        `This appointment is ${labelForEmploymentType(content.employmentType).toLowerCase() || "full-time"}${content.probationPeriod ? ` and includes a probation period of ${content.probationPeriod}` : ""}. ${content.reportingTo ? `The employee will report to ${content.reportingTo}.` : ""}${content.workingHours ? ` Working hours are ${content.workingHours}.` : ""}`,
        `The employee is expected to perform the duties and responsibilities associated with the position diligently, maintain professional conduct, and comply with the school's policies, safeguarding requirements, confidentiality obligations, and lawful instructions.`,
        "This letter records the appointment terms stated above. Any additional terms must be confirmed in writing by the school.",
      ];
    case "experience":
      return [
        `This is to certify that ${name}${content.employeeCode ? ` (Employee ID: ${content.employeeCode})` : ""} was employed by ${schoolName} as ${designation}${content.department ? ` in ${content.department}` : ""} from ${startDate} until ${endDate}.`,
        content.responsibilities
          ? `During this period, the employee's principal responsibilities included: ${content.responsibilities}`
          : `During this period, the employee carried out the duties and responsibilities assigned to the position.`,
        content.performance
          ? `The employee's recorded performance / conduct was: ${content.performance}.`
          : "This letter confirms the period and position of service and does not make representations beyond the information recorded in the school's employment records.",
        "We thank the employee for the service rendered and wish them success in future endeavours.",
      ];
    case "employment_verification":
      return [
        `To ${content.recipientName || "Whom It May Concern"},`,
        `At the employee's request, this letter confirms that ${schoolName}'s employment records identify ${name}${content.employeeCode ? ` (Employee ID: ${content.employeeCode})` : ""} as ${designation}${content.department ? ` in ${content.department}` : ""}.`,
        content.joiningDate
          ? `The employee's recorded joining date is ${formatDate(content.joiningDate)}. Current employment status in the school record is ${content.employmentStatus?.replaceAll("_", " ") || "not specified"}.`
          : `Current employment status in the school record is ${content.employmentStatus?.replaceAll("_", " ") || "not specified"}.`,
        content.purpose ? `This verification is issued for the stated purpose: ${content.purpose}.` : "This verification is issued for the recipient's review. Please contact the school using the official contact details above if further verification is required.",
      ];
    case "promotion":
      return [
        `Following review of the employee's service and responsibilities, ${schoolName} is pleased to promote ${name}${content.previousDesignation ? ` from ${content.previousDesignation}` : ""} to ${designation}${content.department ? ` in ${content.department}` : ""}, effective ${startDate}.`,
        content.reason ? `This promotion recognizes: ${content.reason}` : "The employee is entrusted with the responsibilities and expectations associated with the new position.",
        content.reportingTo ? `In the new role, the employee will report to ${content.reportingTo}.` : "The employee should coordinate with the relevant supervisor regarding duties and transition arrangements.",
        "All other terms of employment remain subject to the existing appointment terms and applicable school policies, except where the school confirms a change in writing.",
      ];
    case "relieving":
      return [
        `This is to confirm that ${name}${content.employeeCode ? ` (Employee ID: ${content.employeeCode})` : ""}, who served as ${designation}${content.department ? ` in ${content.department}` : ""} at ${schoolName}${content.joiningDate ? ` from ${formatDate(content.joiningDate)}` : ""}, has been relieved from assigned duties effective ${endDate}.`,
        content.reason ? `Reason recorded for separation: ${content.reason}.` : "This letter confirms the separation date recorded by the school.",
        content.clearanceStatus ? `Clearance status recorded at issuance: ${content.clearanceStatus}.` : "This letter does not certify settlement of outstanding dues or completion of asset / records clearance unless separately confirmed in writing.",
        content.handoverDetails ? `Handover / clearance notes: ${content.handoverDetails}` : "The employee and relevant departments should complete any outstanding handover and clearance requirements in accordance with school policy.",
        "We thank the employee for the service rendered and wish them well in future endeavours.",
      ];
  }
}

function detailsFor(type: DocumentType, content: GeneratedContent) {
  const details: Array<[string, string | undefined]> = [["Employee ID", content.employeeCode]];
  if (content.department) details.push(["Department / subject", content.department]);
  switch (type) {
    case "appointment":
      details.push(
        ["Joining date", formatDate(content.effectiveDate)],
        ["Employment type", labelForEmploymentType(content.employmentType)],
        ["Probation period", content.probationPeriod],
        ["Compensation", content.salary],
        ["Reporting to", content.reportingTo],
        ["Working hours", content.workingHours],
      );
      break;
    case "experience":
      details.push(
        ["Service start date", formatDate(content.effectiveDate || content.joiningDate)],
        ["Last working date", formatDate(content.endDate)],
        ["Responsibilities", content.responsibilities],
        ["Performance / conduct", content.performance],
      );
      break;
    case "employment_verification":
      details.push(
        ["Joining date", formatDate(content.joiningDate)],
        ["Employment status", content.employmentStatus?.replaceAll("_", " ")],
        ["Purpose", content.purpose],
        ["Compensation", content.salary],
      );
      break;
    case "promotion":
      details.push(
        ["Previous designation", content.previousDesignation],
        ["New designation", content.designation],
        ["Effective date", formatDate(content.effectiveDate)],
        ["Revised compensation", content.salary],
        ["Reporting to", content.reportingTo],
        ["Promotion remarks", content.reason],
      );
      break;
    case "relieving":
      details.push(
        ["Designation held", content.designation],
        ["Joining date", formatDate(content.joiningDate)],
        ["Last working date", formatDate(content.endDate)],
        ["Reason for leaving", content.reason],
        ["Clearance status", content.clearanceStatus],
        ["Handover details", content.handoverDetails],
      );
      break;
  }
  return details.filter(([, value]) => value && value !== "—");
}

export default async function GeneratedEmployeeDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, schoolId } = await requireHrmContext("view");
  const { data: document, error } = await supabase.from("hrm_employee_generated_documents")
    .select("id,employee_type,employee_id,document_type,document_number,issued_on,content")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) {
    console.error("Generated employee document could not be loaded.", error);
    throw new Error("Generated employee document could not be loaded.");
  }
  if (!document || !Object.hasOwn(documentTitles, document.document_type)) notFound();

  const school = await getSchoolDocumentIdentity(supabase, schoolId);
  const content = asContent(document.content);
  const documentType = document.document_type as DocumentType;
  const employeeType = document.employee_type === "teacher" ? "Teacher" : "Staff";
  const schoolAddress = [school.address, school.city, school.state, school.postal_code, school.country].filter(Boolean).join(", ");
  const paragraphs = paragraphsFor(documentType, content, school.name);
  const details = detailsFor(documentType, content);

  return <main className="employee-letter-page">
    <nav className="employee-letter-toolbar" aria-label="Document actions">
      <Link href="/documents">← Employee documents</Link>
      <PrintButton label="Print employee letter" />
    </nav>
    <article className="employee-letter">
      <header className="employee-letter__school">
        {school.logoUrl && <Image src={school.logoUrl} alt={`${school.name} logo`} width={82} height={82} unoptimized />}
        <div>
          <h1>{school.name}</h1>
          {schoolAddress && <p>{schoolAddress}</p>}
          {(school.phone || school.email) && <p>{[school.phone, school.email].filter(Boolean).join(" · ")}</p>}
        </div>
      </header>
      <div className="employee-letter__rule" />
      <div className="employee-letter__meta">
        <span>Ref: {document.document_number}</span>
        <span>Date: {formatDate(document.issued_on)}</span>
      </div>
      <h2>{documentTitles[documentType]}</h2>
      <div className="employee-letter__subject">
        <span>To</span>
        <strong>{content.employeeName || "Employee"}</strong>
        <span>{employeeType} · {content.employeeCode || "—"}</span>
      </div>
      <div className="employee-letter__body">
        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
      {details.length > 0 && <section className="employee-letter__details">
        <h3>Employment details</h3>
        <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section>}
      {content.notes && <section className="employee-letter__notes"><h3>Additional note</h3><p>{content.notes}</p></section>}
      <p className="employee-letter__closing">Yours sincerely,</p>
      <footer className="employee-letter__signatures">
        <div><span /><strong>Authorized signature</strong><small>{school.name}</small></div>
        <div><span /><strong>Official stamp</strong></div>
      </footer>
      <p className="employee-letter__footer">Issued by {school.name} · {document.document_number}</p>
    </article>
  </main>;
}
