import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";

import { PrintAction } from "@/components/print/print-action";
import { getEmployeePhotoUrl, isEmployeeIdCardReady } from "@/components/hrm/employee-verification-panel";
import { requireHrmContext } from "@/lib/hrm/context";
import { getSchoolDocumentIdentity } from "@/lib/print/school-document";

type EmployeeType = "teacher" | "staff";

export default async function EmployeeIdCardPage({
  params,
}: {
  params: Promise<{ employeeType: string; employeeId: string }>;
}) {
  const { employeeType, employeeId } = await params;
  if (employeeType !== "teacher" && employeeType !== "staff") notFound();
  const { supabase, schoolId } = await requireHrmContext("view");
  const type: EmployeeType = employeeType;
  const [{ data: employee, error }, school] = await Promise.all([
    type === "teacher"
      ? supabase.from("teachers")
        .select("id,employee_code,first_name,last_name,specialization,joining_date,employment_status,is_active,photo_path")
        .eq("id", employeeId)
        .eq("school_id", schoolId)
        .maybeSingle()
      : supabase.from("staff")
        .select("id,employee_code,first_name,last_name,designation,department,joining_date,employment_status,is_active,photo_path")
        .eq("id", employeeId)
        .eq("school_id", schoolId)
        .maybeSingle(),
    getSchoolDocumentIdentity(supabase, schoolId),
  ]);
  if (error) throw new Error("Employee details could not be loaded for the ID card.");
  if (!employee) notFound();

  const employeeData = employee as {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    specialization?: string | null;
    designation?: string | null;
    department?: string | null;
    joining_date: string | null;
    employment_status?: string | null;
    is_active: boolean;
    photo_path?: string | null;
  };
  const idCardReady = await isEmployeeIdCardReady(supabase, schoolId, type, employeeId, employeeData.photo_path ?? null);
  if (!idCardReady) {
    const profileHref = type === "teacher" ? `/teachers/${employeeId}` : `/staff/${employeeId}`;
    return <main className="student-id-card-page employee-id-card-page">
      <p className="student-error">The employee ID card is available after the photo and all required and uploaded documents have been verified.</p>
      <Link href={profileHref}>Return to employee profile</Link>
    </main>;
  }

  const photoUrl = await getEmployeePhotoUrl(employeeData.photo_path ?? null);
  const fullName = `${employeeData.first_name} ${employeeData.last_name}`;
  const roleTitle = type === "teacher"
    ? employeeData.specialization || "Teacher"
    : employeeData.designation || "Staff";
  const department = type === "teacher" ? "Academics" : employeeData.department || "General";
  const status = employeeData.employment_status ?? (employeeData.is_active ? "active" : "inactive");
  const schoolLocation = [school.address, school.city, school.state, school.postal_code, school.country]
    .filter(Boolean)
    .join(", ");
  const qrCode = await QRCode.toDataURL(
    `Schooliva employee card\nSchool: ${school.code}\nEmployee ID: ${employeeData.employee_code}`,
    { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: "#102a4c", light: "#ffffff" } },
  );

  return <main className="student-id-card-page employee-id-card-page">
    <div className="student-id-card-toolbar no-print">
      <Link href="/hrm/candidates">Back to candidates</Link>
      <PrintAction label="Print both sides / Save PDF" />
    </div>
    <div className="employee-id-card-sides">
    <article className="student-id-card employee-id-card employee-id-card--side employee-id-card--front" aria-label={`${fullName} employee ID card front`}>
      <header className="student-id-card__school">
        {school.logoUrl && <Image src={school.logoUrl} alt="" width={48} height={42} unoptimized />}
        <div><strong>{school.name}</strong><span>EMPLOYEE ID CARD</span></div>
      </header>
      <div className="student-id-card__body">
        {photoUrl
          ? <Image className="student-id-card__photo" src={photoUrl} alt={`${fullName} employee photo`} width={96} height={112} unoptimized />
          : <div className="student-id-card__photo student-id-card__photo--empty" aria-hidden="true">
            {fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
          </div>}
        <div className="student-id-card__details">
          <h1>{fullName}</h1>
          <p><span>Employee ID</span><strong>{employeeData.employee_code}</strong></p>
          <p><span>Role</span><strong>{roleTitle}</strong></p>
          <p><span>Department</span><strong>{department}</strong></p>
          <p><span>Employee type</span><strong>{type === "teacher" ? "Teacher" : "Staff"}</strong></p>
          <p><span>Status</span><strong>{status.replaceAll("_", " ")}</strong></p>
          {employeeData.joining_date && <p><span>Joining date</span><strong>{new Date(`${employeeData.joining_date}T00:00:00`).toLocaleDateString()}</strong></p>}
        </div>
      </div>
      <footer className="student-id-card__footer">
        <span>{school.phone ?? school.email ?? school.code}</span>
        <span>{school.code}</span>
      </footer>
    </article>
    <article className="employee-id-card__back employee-id-card--side" aria-label={`${fullName} employee ID card back`}>
      <header className="employee-id-card__back-heading">
        {school.logoUrl && <Image src={school.logoUrl} alt="" width={42} height={38} unoptimized />}
        <div><strong>{school.name}</strong><span>STAFF IDENTIFICATION</span></div>
      </header>
      <div className="employee-id-card__back-content">
        <div className="employee-id-card__qr-wrap">
          <Image className="employee-id-card__qr" src={qrCode} alt="QR code with the school code and employee ID" width={88} height={88} unoptimized />
          <span>Scan for card details</span>
        </div>
        <div className="employee-id-card__back-details">
          <span className="employee-id-card__back-label">SCHOOL LOCATION</span>
          <strong>{schoolLocation || `School code: ${school.code}`}</strong>
          <span className="employee-id-card__back-label">CARD POLICY</span>
          <p>This card remains the property of {school.name} and must be returned when employment ends.</p>
          <p>If found, please return it to {school.phone ?? school.email ?? school.name}.</p>
        </div>
      </div>
      <footer className="employee-id-card__back-footer">
        <span>Powered by</span><strong>Schooliva</strong>
      </footer>
    </article>
    </div>
    <p className="student-id-card-note no-print">Print double-sided at 100% scale (flip on the long edge). Each side is 85.6 × 54 mm.</p>
  </main>;
}
