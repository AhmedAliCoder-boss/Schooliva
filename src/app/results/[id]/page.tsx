import Link from "next/link";
import { notFound } from "next/navigation";

import { formatStudentPosition, getEffectivePassingMarks, getStudentPositions, getStudentResultStatus } from "@/lib/results/report-card";
import { createClient } from "@/lib/supabase/server";
import { getActiveSchoolContext } from "@/lib/admin/school-context";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  q?: string;
  resultFilter?: string;
  classId?: string;
  sectionId?: string;
}>;
type ResultRow = Record<string, unknown>;
type ResultStudent = {
  studentId: string;
  name: string;
  studentIdentifier: string;
  admissionNumber: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  totalObtained: number;
  totalMaximum: number;
  subjectCount: number;
  passed: boolean;
};

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null;
}

function resultName(row: ResultRow) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ");
}

function getSectionStatistics(students: ResultStudent[]) {
  const rankedStudents = students.map((student) => ({
    student_id: student.studentId,
    percentage: student.totalMaximum > 0 ? (student.totalObtained / student.totalMaximum) * 100 : 0,
  }));
  const positions = getStudentPositions(rankedStudents);
  const positionHolders = students.filter((student) => (positions.get(student.studentId) ?? Infinity) <= 3).length;
  const passed = students.filter((student) => student.passed).length;

  return { students: students.length, passed, failed: students.length - passed, positionHolders };
}

function getExamStatistics(students: ResultStudent[]) {
  const sections = new Map<string, ResultStudent[]>();
  for (const student of students) {
    const key = `${student.classId}:${student.sectionId}`;
    const group = sections.get(key) ?? [];
    group.push(student);
    sections.set(key, group);
  }
  return [...sections.values()].reduce((total, section) => {
    const stats = getSectionStatistics(section);
    return {
      students: total.students + stats.students,
      passed: total.passed + stats.passed,
      failed: total.failed + stats.failed,
      positionHolders: total.positionHolders + stats.positionHolders,
    };
  }, { students: 0, passed: 0, failed: 0, positionHolders: 0 });
}

export default async function ExamResultsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id: examId } = await params;
  const filters = await searchParams;
  const search = filters.q?.trim() ?? "";
  const resultFilter = ["passed", "failed", "top3"].includes(filters.resultFilter ?? "")
    ? filters.resultFilter as "passed" | "failed" | "top3"
    : null;
  const filterClassId = filters.classId ?? null;
  const filterSectionId = filters.sectionId ?? null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { schoolId } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) notFound();

  const [{ data: exam, error: examError }, { data: resultRows, error: resultsError }] = await Promise.all([
    supabase.from("exams")
      .select("id,name,status,starts_on,ends_on,academic_sessions(name)")
      .eq("id", examId).eq("school_id", schoolId).eq("status", "published").maybeSingle(),
    supabase.from("published_exam_results")
      .select("student_id,first_name,middle_name,last_name,student_identifier,admission_number,class_id,class_name,section_id,section_name,obtained_marks,maximum_marks,passing_marks,percentage")
      .eq("exam_id", examId).eq("school_id", schoolId)
      .order("class_name").order("section_name").order("first_name"),
  ]);
  if (examError || resultsError) {
    console.error("Published student results could not be loaded.", examError ?? resultsError);
    return <main className="students-shell"><p className="student-error">Published results could not be loaded. Refresh and try again.</p></main>;
  }
  if (!exam) notFound();

  const students = new Map<string, ResultStudent>();
  for (const row of (resultRows ?? []) as ResultRow[]) {
    const studentId = String(row.student_id);
    const current = students.get(studentId) ?? {
      studentId,
      name: resultName(row),
      studentIdentifier: String(row.student_identifier ?? ""),
      admissionNumber: String(row.admission_number ?? ""),
      classId: String(row.class_id ?? "unassigned"),
      className: String(row.class_name ?? ""),
      sectionId: String(row.section_id ?? "unassigned"),
      sectionName: String(row.section_name ?? ""),
      totalObtained: 0,
      totalMaximum: 0,
      subjectCount: 0,
      passed: true,
    };
    current.totalObtained += Number(row.obtained_marks ?? 0);
    current.totalMaximum += Number(row.maximum_marks ?? 0);
    current.subjectCount += 1;
    current.passed &&= Number(row.obtained_marks ?? 0) >= getEffectivePassingMarks(
      String(row.maximum_marks ?? 0),
      row.passing_marks === null || row.passing_marks === undefined ? null : String(row.passing_marks),
    );
    students.set(studentId, current);
  }

  const session = relation<{ name: string }>(exam.academic_sessions);
  const orderedStudents = [...students.values()].sort((a, b) =>
    a.className.localeCompare(b.className) || a.sectionName.localeCompare(b.sectionName) || a.name.localeCompare(b.name),
  );
  const visibleStudents = search
    ? orderedStudents.filter((student) =>
      [student.name, student.studentIdentifier, student.admissionNumber, student.className, student.sectionName]
        .some((value) => value.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
    )
    : orderedStudents;
  const classGroups = new Map<string, {
    classId: string;
    className: string;
    sections: Map<string, { sectionId: string; sectionName: string; students: ResultStudent[] }>;
  }>();
  for (const student of visibleStudents) {
    const classGroup = classGroups.get(student.classId) ?? {
      classId: student.classId,
      className: student.className || "Class not assigned",
      sections: new Map(),
    };
    const section = classGroup.sections.get(student.sectionId) ?? {
      sectionId: student.sectionId,
      sectionName: student.sectionName || "Section not assigned",
      students: [],
    };
    section.students.push(student);
    classGroup.sections.set(student.sectionId, section);
    classGroups.set(student.classId, classGroup);
  }
  const groupedClasses = [...classGroups.values()]
    .filter((classGroup) => !filterClassId || classGroup.classId === filterClassId)
    .sort((left, right) => left.className.localeCompare(right.className));
  const examStatistics = getExamStatistics(orderedStudents);
  const buildFilterHref = (filter: "passed" | "failed" | "top3", classId?: string, sectionId?: string) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    query.set("resultFilter", filter);
    if (classId) query.set("classId", classId);
    if (sectionId) query.set("sectionId", sectionId);
    return `/results/${examId}?${query.toString()}`;
  };
  const clearFilterHref = search
    ? `/results/${examId}?${new URLSearchParams({ q: search }).toString()}`
    : `/results/${examId}`;

  return <main className="students-shell">
    <header className="students-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <Link className="text-action" href="/results">All published exams -&gt;</Link>
    </header>
    <section className="students-heading">
      <div>
        <p className="eyebrow">Individual student results</p>
        <h1>{String(exam.name)}</h1>
        <p>{session?.name ?? "Academic session"} · {String(exam.starts_on)} to {String(exam.ends_on)}</p>
      </div>
    </section>
    <section className="results-overview" aria-label="Exam result statistics">
      <Link className="results-stat results-stat--pass" href={buildFilterHref("passed")} aria-label={`Show all ${examStatistics.passed} passed students in this exam`}>
        <span>Passed</span><strong>{examStatistics.passed}</strong><small>Across this exam</small>
      </Link>
      <Link className="results-stat results-stat--fail" href={buildFilterHref("failed")} aria-label={`Show all ${examStatistics.failed} failed students in this exam`}>
        <span>Failed</span><strong>{examStatistics.failed}</strong><small>Across this exam</small>
      </Link>
      <Link className="results-stat results-stat--holders" href={buildFilterHref("top3")} aria-label={`Show all ${examStatistics.positionHolders} position holders in this exam`}>
        <span>Position holders</span><strong>{examStatistics.positionHolders}</strong><small>Top three per section</small>
      </Link>
    </section>
    <form className="results-search-form" action={`/results/${examId}`} method="get" role="search">
    <label htmlFor="student-result-search">Search students</label>
    <input
      id="student-result-search"
      type="search"
      name="q"
      placeholder="Name, student ID, class or section"
      defaultValue={search}
    />
    <button type="submit">Search</button>
    {search && <Link className="text-action" href={`/results/${examId}`}>Clear</Link>}
    </form>
    <p className="results-search-count" aria-live="polite">
      {search ? `${visibleStudents.length} of ${orderedStudents.length} students match “${search}”.` : `${orderedStudents.length} student report cards.`}
      {resultFilter && <>
        {` Showing ${resultFilter === "top3" ? "position holders" : resultFilter === "passed" ? "passed" : "failed"} only.`}
        {" "}<Link className="text-action" href={clearFilterHref}>Clear filter</Link>
      </>}
    </p>
    {groupedClasses.length ? <div className="results-class-groups">
      {groupedClasses.map((classGroup) => {
        const sections = [...classGroup.sections.values()].sort((left, right) => left.sectionName.localeCompare(right.sectionName));
        const classStudents = sections.reduce((count, section) => count + section.students.length, 0);
        const classStatistics = sections.reduce((total, section) => {
          const sectionStatistics = getSectionStatistics(section.students);
          return {
            passed: total.passed + sectionStatistics.passed,
            failed: total.failed + sectionStatistics.failed,
            positionHolders: total.positionHolders + sectionStatistics.positionHolders,
          };
        }, { passed: 0, failed: 0, positionHolders: 0 });
        return <details className="results-class-group" key={classGroup.classId} open={search || filterClassId === classGroup.classId ? true : undefined}>
          <summary>
            <span className="results-group-summary">
              <span><strong>{classGroup.className}</strong><small>{classStudents} students · {sections.length} sections</small></span>
              <span className="results-group-statistics" aria-label={`Filter ${classGroup.className} results`}>
                <Link className="results-group-stat results-group-stat--pass" href={buildFilterHref("passed", classGroup.classId)} aria-label={`Show ${classStatistics.passed} passed students in ${classGroup.className}`}>Pass {classStatistics.passed}</Link>
                <Link className="results-group-stat results-group-stat--fail" href={buildFilterHref("failed", classGroup.classId)} aria-label={`Show ${classStatistics.failed} failed students in ${classGroup.className}`}>Fail {classStatistics.failed}</Link>
                <Link className="results-group-stat results-group-stat--holders" href={buildFilterHref("top3", classGroup.classId)} aria-label={`Show ${classStatistics.positionHolders} position holders in ${classGroup.className}`}>Top 3 {classStatistics.positionHolders}</Link>
              </span>
            </span>
            <span className="exam-content-drawer__toggle" aria-hidden="true">⌄</span>
          </summary>
          <div className="results-section-groups">
            {sections.map((section) => {
              if (filterSectionId && section.sectionId !== filterSectionId) return null;
              const sectionStatistics = getSectionStatistics(section.students);
              const sectionPositions = getStudentPositions(section.students.map((student) => ({
                student_id: student.studentId,
                percentage: student.totalMaximum > 0 ? (student.totalObtained / student.totalMaximum) * 100 : 0,
              })));
              const filteredSectionStudents = section.students.filter((student) => {
                const position = sectionPositions.get(student.studentId) ?? null;
                return !resultFilter
                  || (resultFilter === "passed" && student.passed)
                  || (resultFilter === "failed" && !student.passed)
                  || (resultFilter === "top3" && position !== null && position <= 3);
              });
              return <details className="results-section-group" key={section.sectionId} open={search || filterSectionId === section.sectionId ? true : undefined}>
                <summary>
                  <span className="results-group-summary">
                    <span><strong>{section.sectionName}</strong><small>{sectionStatistics.students} student report cards</small></span>
                    <span className="results-group-statistics" aria-label={`Filter ${section.sectionName} results`}>
                      <Link className="results-group-stat results-group-stat--pass" href={buildFilterHref("passed", classGroup.classId, section.sectionId)} aria-label={`Show ${sectionStatistics.passed} passed students in ${section.sectionName}`}>Pass {sectionStatistics.passed}</Link>
                      <Link className="results-group-stat results-group-stat--fail" href={buildFilterHref("failed", classGroup.classId, section.sectionId)} aria-label={`Show ${sectionStatistics.failed} failed students in ${section.sectionName}`}>Fail {sectionStatistics.failed}</Link>
                      <Link className="results-group-stat results-group-stat--holders" href={buildFilterHref("top3", classGroup.classId, section.sectionId)} aria-label={`Show ${sectionStatistics.positionHolders} position holders in ${section.sectionName}`}>Top 3 {sectionStatistics.positionHolders}</Link>
                    </span>
                  </span>
                  <span className="exam-content-drawer__toggle" aria-hidden="true">⌄</span>
                </summary>
                <div className="student-table-wrap">
                  <table className="student-table">
                    <thead><tr><th>Student</th><th>Total</th><th>Average</th><th>Subjects</th><th>View</th><th>Print</th></tr></thead>
                    <tbody>{filteredSectionStudents.map((student) => {
                      const average = student.totalMaximum > 0 ? (student.totalObtained / student.totalMaximum) * 100 : 0;
                      const position = sectionPositions.get(student.studentId) ?? null;
                      const status = getStudentResultStatus(student.passed);
                      const reportPath = `/results/${examId}/${student.studentId}`;
                      return <tr key={student.studentId}>
                        <td>
                          <span className="results-student-name">
                            <strong>{student.name || "Student"}</strong>
                            <span className={`results-student-status results-student-status--${status}`}>
                              {position !== null && position <= 3 ? `${formatStudentPosition(position)} · ` : ""}
                              {status === "passed" ? "Passed" : "Failed"}
                            </span>
                          </span>
                          <small className="results-student-identifier">{student.studentIdentifier || student.admissionNumber || "—"}</small>
                        </td>
                        <td>{student.totalObtained}/{student.totalMaximum}</td>
                        <td>{average.toFixed(2)}%</td>
                        <td>{student.subjectCount}</td>
                        <td><Link className="text-action" href={reportPath}>View report</Link></td>
                        <td><Link className="text-action" href={`${reportPath}?print=1`} target="_blank" rel="noreferrer">Print report</Link></td>
                      </tr>;
                    })}
                    {filteredSectionStudents.length === 0 && <tr><td colSpan={6}>No students match this filter.</td></tr>}</tbody>
                  </table>
                </div>
              </details>;
            })}
          </div>
        </details>;
      })}
    </div> : <div className="student-empty">
      <h3>{search ? "No matching students" : "No published results yet"}</h3>
      <p>{search ? "Try a different name, student ID, class or section." : "Individual student reports appear here after results are published."}</p>
    </div>}
  </main>;
}
