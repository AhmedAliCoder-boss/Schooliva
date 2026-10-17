import { AdminShell, AdminWorkflowNotice } from "@/components/admin/admin-shell";
import { AdminSchoolsWorkspace } from "@/components/admin/admin-schools-workspace";
import { requireMasterAdmin } from "@/lib/admin/guard";
import { resolveSchoolLifecycle } from "@/lib/school-lifecycle";

export default async function AdminSchoolsPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string; page?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireMasterAdmin();
  const search = String(params.search ?? "").trim();
  const requestedStatus = String(params.status ?? "all");
  const status = ["all", "active", "inactive"].includes(requestedStatus) ? requestedStatus : "all";
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 12;
  let schoolQuery = supabase.from("schools").select("id,name,code,email,phone,is_active,created_at", { count: "exact" });
  if (search) schoolQuery = schoolQuery.or(`name.ilike.%${search}%,code.ilike.%${search}%,email.ilike.%${search}%`);
  if (status !== "all") schoolQuery = schoolQuery.eq("is_active", status === "active");
  const [{ data: schools, count, error: schoolsError }, { count: totalCount, error: totalError }, { count: activeCount, error: activeError }] = await Promise.all([
    schoolQuery.order("name").range((page - 1) * pageSize, page * pageSize - 1),
    supabase.from("schools").select("id", { count: "exact", head: true }),
    supabase.from("schools").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);
  if (schoolsError || totalError || activeError) {
    console.error("Master Admin school portfolio could not be loaded.", { schoolsError, totalError, activeError });
    throw new Error("Master Admin school portfolio could not be loaded.");
  }
  const currentSchoolIds = (schools ?? []).map((school) => school.id);
  const [
    { data: memberships, error: membershipsError },
    { data: students, error: studentsError },
    { data: documents, error: documentsError },
    { data: contracts, error: contractsError },
    { data: trials, error: trialsError },
  ] = currentSchoolIds.length
    ? await Promise.all([
      supabase.from("user_roles").select("school_id,user_id").in("school_id", currentSchoolIds).limit(10000),
      supabase.from("students").select("id,school_id").in("school_id", currentSchoolIds).limit(10000),
      supabase.from("school_documents").select("school_id,file_size").in("school_id", currentSchoolIds).limit(10000),
      supabase.from("platform_contracts").select("school_id,status,plan_name,renewal_date,created_at").in("school_id", currentSchoolIds).order("created_at", { ascending: false }),
      supabase.from("school_trials").select("school_id,status,trial_name,ends_on,starts_on").in("school_id", currentSchoolIds).order("starts_on", { ascending: false }),
    ])
    : [
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ];
  if (membershipsError || studentsError || documentsError || contractsError || trialsError) {
    console.error("Master Admin school metrics could not be loaded.", { membershipsError, studentsError, documentsError, contractsError, trialsError });
    throw new Error("Master Admin school metrics could not be loaded.");
  }
  const accountIds = new Map<string, Set<string>>();
  for (const membership of memberships ?? []) {
    const schoolAccounts = accountIds.get(membership.school_id) ?? new Set<string>();
    schoolAccounts.add(membership.user_id);
    accountIds.set(membership.school_id, schoolAccounts);
  }
  const studentCounts = new Map<string, number>();
  for (const student of students ?? []) {
    studentCounts.set(student.school_id, (studentCounts.get(student.school_id) ?? 0) + 1);
  }
  const storageTotals = new Map<string, number>();
  for (const document of documents ?? []) {
    storageTotals.set(document.school_id, (storageTotals.get(document.school_id) ?? 0) + Number(document.file_size ?? 0));
  }
  const schoolsWithPortfolio = (schools ?? []).map((school) => {
    const schoolContracts = (contracts ?? []).filter((contract) => contract.school_id === school.id);
    const schoolTrials = (trials ?? []).filter((trial) => trial.school_id === school.id);
    const contract = schoolContracts.find((item) => item.status === "active") ?? schoolContracts[0];
    const trial = schoolTrials.find((item) => item.status === "active" || item.status === "pending") ?? schoolTrials[0];
    const lifecycle = resolveSchoolLifecycle({
      contractStatus: contract?.status,
      trialStatus: trial?.status,
      contractPlanName: contract?.plan_name,
      trialName: trial?.trial_name,
    });
    return {
      id: school.id,
      name: school.name,
      code: school.code,
      email: school.email,
      phone: school.phone,
      isActive: school.is_active,
      createdAt: String(school.created_at),
      accounts: accountIds.get(school.id)?.size ?? 0,
      students: studentCounts.get(school.id) ?? 0,
      storageBytes: storageTotals.get(school.id) ?? 0,
      lifecycle: lifecycle.label,
      planName: lifecycle.planName,
    };
  });

  return <AdminShell title="Schools" description="The central tenant portfolio. Select a school to inspect its environment or explicitly open its existing dashboard." breadcrumbs={[{ label: "Schools" }]}>
    <AdminWorkflowNotice code={params.success} success />
    <AdminWorkflowNotice code={params.error} />
    <AdminSchoolsWorkspace
      schools={schoolsWithPortfolio}
      totalCount={totalCount ?? 0}
      activeCount={activeCount ?? 0}
      search={search}
      status={status}
      page={page}
      pageSize={pageSize}
      filteredCount={count ?? 0}
    />
  </AdminShell>;
}
