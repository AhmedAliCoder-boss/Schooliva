import Link from "next/link";
import { redirect } from "next/navigation";

import { getActiveSchoolContext } from "@/lib/admin/school-context";
import {
  calculatePublishedResultStatistics,
  getPublishedResultStudentOutcomes,
  type PublishedResultFilter,
  type PublishedResultMark,
} from "@/lib/results/statistics";
import { formatStudentPosition } from "@/lib/results/report-card";
import { createClient } from "@/lib/supabase/server";

function relation<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] ?? null) as T | null : value as T | null;
}

type SearchParams = Promise<{ q?: string; sessionId?: string; resultFilter?: string }>;

export default async function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const search = filters.q?.trim() ?? "";
  const selectedSessionId = filters.sessionId ?? "";
  const resultFilter = ["passed", "failed", "top3"].includes(filters.resultFilter ?? "")
    ? filters.resultFilter as PublishedResultFilter
    : null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { schoolId, isMasterAdmin } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) redirect(isMasterAdmin ? "/admin" : "/setup?onboarding=1");

  const { data: exams, error } = await supabase.from("exams")
    .select("id,name,status,starts_on,ends_on,academic_session_id,academic_sessions(name)")
    .eq("school_id", schoolId).eq("status", "published").order("starts_on", { ascending: false });
  if (error) {
    console.error("Published exams could not be loaded for results.", error);
    return <main className="students-shell"><p className="student-error">Published results could not be loaded. Refresh and try again.</p></main>;
  }

  const rows = exams ?? [];
  const sessionsById = new Map<string, { id: string; name: string }>();
  for (const exam of rows) {
    const session = relation<{ name: string }>(exam.academic_sessions);
    if (session && exam.academic_session_id) {
      sessionsById.set(String(exam.academic_session_id), {
        id: String(exam.academic_session_id),
        name: session.name,
      });
    }
  }
  const sessions = [...sessionsById.values()].sort((left, right) => left.name.localeCompare(right.name));
  const visibleExams = rows.filter((exam) => {
    const session = relation<{ name: string }>(exam.academic_sessions);
    const matchesSession = !selectedSessionId || String(exam.academic_session_id) === selectedSessionId;
    const matchesSearch = !search
      || `${exam.name} ${session?.name ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase());
    return matchesSession && matchesSearch;
  });

  const resultMarks: PublishedResultMark[] = [];
  const visibleExamIds = visibleExams.map((exam) => String(exam.id));
  for (let offset = 0; visibleExamIds.length; offset += 1000) {
    const { data, error: resultError } = await supabase.from("published_exam_results")
      .select("exam_id,student_id,class_id,section_id,obtained_marks,maximum_marks,passing_marks,first_name,middle_name,last_name,student_identifier,class_name,section_name")
      .eq("school_id", schoolId).in("exam_id", visibleExamIds)
      .order("exam_id").order("student_id").range(offset, offset + 999);
    if (resultError) {
      console.error("Published result statistics could not be loaded.", resultError);
      return <main className="students-shell"><p className="student-error">Result statistics could not be loaded. Refresh and try again.</p></main>;
    }
    resultMarks.push(...(data ?? []) as PublishedResultMark[]);
    if (!data || data.length < 1000) break;
  }

  const statistics = calculatePublishedResultStatistics(resultMarks);
  const outcomes = resultFilter ? getPublishedResultStudentOutcomes(resultMarks) : [];
  const matchingOutcomes = outcomes.filter((outcome) => resultFilter === "passed"
    ? outcome.passed
    : resultFilter === "failed"
      ? !outcome.passed
      : outcome.position <= 3);
  const resultFilterStudentKeys = resultFilter
    ? new Set(matchingOutcomes.map((outcome) => `${outcome.examId}:${outcome.studentId}`))
    : null;
  const outcomeByStudentKey = new Map(matchingOutcomes.map((outcome) => [
    `${outcome.examId}:${outcome.studentId}`,
    outcome,
  ]));
  const examsById = new Map(rows.map((exam) => [String(exam.id), exam]));
  const matchedSchoolResults = new Map<string, {
    examId: string;
    examName: string;
    studentId: string;
    studentName: string;
    studentIdentifier: string;
    className: string;
    sectionName: string;
    position: number;
  }>();
  if (resultFilterStudentKeys) {
    for (const mark of resultMarks) {
      const key = `${mark.exam_id}:${mark.student_id}`;
      if (!resultFilterStudentKeys.has(key) || matchedSchoolResults.has(key)) continue;
      const exam = examsById.get(mark.exam_id);
      if (!exam) continue;
      const studentName = [mark.first_name, mark.middle_name, mark.last_name].filter(Boolean).join(" ");
      matchedSchoolResults.set(key, {
        examId: mark.exam_id,
        examName: String(exam.name),
        studentId: mark.student_id,
        studentName: studentName || "Student",
        studentIdentifier: mark.student_identifier ?? "",
        className: mark.class_name ?? "Class not assigned",
        sectionName: mark.section_name ?? "Section not assigned",
        position: outcomeByStudentKey.get(key)?.position ?? Infinity,
      });
    }
  }
  const filteredSchoolResults = [...matchedSchoolResults.values()].sort((left, right) =>
    left.examName.localeCompare(right.examName)
      || left.className.localeCompare(right.className)
      || left.sectionName.localeCompare(right.sectionName)
      || left.studentName.localeCompare(right.studentName),
  );
  const buildFilterHref = (filter: PublishedResultFilter) => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (selectedSessionId) query.set("sessionId", selectedSessionId);
    query.set("resultFilter", filter);
    return `/results?${query.toString()}`;
  };
  const clearFilterHref = (() => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (selectedSessionId) query.set("sessionId", selectedSessionId);
    return query.size ? `/results?${query.toString()}` : "/results";
  })();
  return <main className="students-shell">
    <header className="students-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link>
      <Link className="text-action" href="/dashboard">Dashboard -&gt;</Link>
    </header>
    <section className="students-heading">
      <div>
        <p className="eyebrow">Results overview</p>
        <h1>Published results.</h1>
        <p>Filter published exams and track student outcomes, passes, failures, and class position holders.</p>
      </div>
    </section>
    <section className="results-overview" aria-label="Published result statistics">
      <article className="results-stat">
        <span>Students with results</span>
        <strong>{statistics.students}</strong>
        <small>Across {visibleExams.length} filtered exams</small>
      </article>
      <Link className={`results-stat results-stat--pass${resultFilter === "passed" ? " results-stat--selected" : ""}`} href={buildFilterHref("passed")} aria-label={`Filter all school results to passed students: ${statistics.passed}`} aria-current={resultFilter === "passed" ? "page" : undefined}>
        <span>Passed</span>
        <strong>{statistics.passed}</strong>
        <small>Passed every subject</small>
      </Link>
      <Link className={`results-stat results-stat--fail${resultFilter === "failed" ? " results-stat--selected" : ""}`} href={buildFilterHref("failed")} aria-label={`Filter all school results to failed students: ${statistics.failed}`} aria-current={resultFilter === "failed" ? "page" : undefined}>
        <span>Failed</span>
        <strong>{statistics.failed}</strong>
        <small>Below pass mark in at least one subject</small>
      </Link>
      <Link className={`results-stat results-stat--holders${resultFilter === "top3" ? " results-stat--selected" : ""}`} href={buildFilterHref("top3")} aria-label={`Filter all school results to position holders: ${statistics.positionHolders}`} aria-current={resultFilter === "top3" ? "page" : undefined}>
        <span>Position holders</span>
        <strong>{statistics.positionHolders}</strong>
        <small>Top three per class and section, per exam</small>
      </Link>
    </section>
    <form className="results-search-form" action="/results" method="get" role="search">
      <label htmlFor="published-exam-search">Find published exams</label>
      <input
        id="published-exam-search"
        type="search"
        name="q"
        placeholder="Search by exam or academic session"
        defaultValue={search}
      />
      <label className="results-filter-label" htmlFor="result-session-filter">Academic session</label>
      <select id="result-session-filter" name="sessionId" defaultValue={selectedSessionId}>
        <option value="">All sessions</option>
        {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
      </select>
      <button type="submit">Apply filters</button>
      {(search || selectedSessionId || resultFilter) && <Link className="text-action" href="/results">Clear filters</Link>}
    </form>
    <p className="results-search-count" aria-live="polite">
      {resultFilter
        ? `Showing ${filteredSchoolResults.length} matching student results across ${visibleExams.length} school exams.`
        : `Showing ${visibleExams.length} of ${rows.length} published exams.`}
      {resultFilter && <>{" "}<Link className="text-action" href={clearFilterHref}>Clear result filter</Link></>}
    </p>
    {resultFilter ? <div className="student-table-wrap">
      <table className="student-table">
        <thead><tr><th>Exam</th><th>Student</th><th>Class</th><th>Section</th><th>Result</th></tr></thead>
        <tbody>{filteredSchoolResults.length ? filteredSchoolResults.map((result) => (
          <tr key={`${result.examId}:${result.studentId}`}>
            <td><Link className="text-action" href={`/results/${result.examId}`}>{result.examName}</Link></td>
            <td>
              <Link className="results-school-student" href={`/results/${result.examId}/${result.studentId}`}>
                <strong>{result.studentName}</strong>
                <small>{result.studentIdentifier || "—"}</small>
              </Link>
            </td>
            <td>{result.className}</td>
            <td>{result.sectionName}</td>
            <td>{resultFilter === "top3" ? `${formatStudentPosition(result.position)} · Position holder` : resultFilter === "passed" ? "Passed" : "Failed"}</td>
          </tr>
        )) : <tr><td colSpan={5}>
          <div className="student-empty">
            <h3>No matching student results</h3>
            <p>No published students match this result filter in the selected exams.</p>
          </div>
        </td></tr>}</tbody>
      </table>
    </div> : <div className="student-table-wrap">
      <table className="student-table">
        <thead><tr><th>Exam</th><th>Session</th><th>Range</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{visibleExams.length ? visibleExams.map((exam) => {
          const session = relation<{ name: string }>(exam.academic_sessions);
          return <tr key={String(exam.id)}>
            <td><strong>{String(exam.name)}</strong></td>
            <td>{session?.name ?? "-"}</td>
            <td>{String(exam.starts_on)} - {String(exam.ends_on)}</td>
            <td><span className="status-pill active">{String(exam.status)}</span></td>
            <td><Link href={`/results/${exam.id}`} className="text-action">View student results -&gt;</Link></td>
          </tr>;
        }) : <tr><td colSpan={5}>
          <div className="student-empty">
            <h3>{rows.length ? "No matching exams" : "No published results"}</h3>
            <p>{resultFilter ? "No published exam contains students matching this result filter." : rows.length ? "Try another exam name or academic session." : "Published results will appear here after review and publication."}</p>
          </div>
        </td></tr>}</tbody>
      </table>
    </div>}
  </main>;
}
