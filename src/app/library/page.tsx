import Link from "next/link";

import { LibraryActionsPanel } from "@/components/library/library-actions-panel";
import { LibraryRegister, type LibraryBookRow, type LibraryCopyRow, type LibraryLoanRow, type LibraryMemberRow } from "@/components/library/library-register";
import { ProgressWheel } from "@/components/progress-wheel";
import { requireLibraryContext } from "@/lib/library/context";

type Relation<T> = T | T[] | null;
type Named = { name: string | null };
type PersonName = { first_name: string | null; last_name: string | null };

function relation<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function localDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function LibraryPage() {
  const { supabase, schoolId } = await requireLibraryContext("view");
  const permissionKeys = ["manage", "issue", "return"] as const;
  const permissionChecks = await Promise.all(permissionKeys.map((action) => supabase.rpc("has_permission", {
    target_school_id: schoolId,
    target_resource: "library",
    target_action: action,
  })));
  const permissionError = permissionChecks.find((result) => result.error)?.error;
  if (permissionError) {
    console.error("Library operation permissions could not be checked.", permissionError);
    throw new Error("Library operation permissions could not be verified.");
  }
  const [canManage, canIssue, canReturn] = permissionChecks.map((result) => Boolean(result.data));

  const [
    { data: authors, error: authorsError },
    { data: categories, error: categoriesError },
    { data: publishers, error: publishersError },
    { data: bookRecords, error: booksError },
    { data: copyRecords, error: copiesError },
    { data: memberRecords, error: membersError },
    { data: transactionRecords, error: transactionsError },
    { data: students, error: studentsError },
    { data: teachers, error: teachersError },
  ] = await Promise.all([
    supabase.from("library_authors").select("id,name").eq("school_id", schoolId).order("name"),
    supabase.from("library_categories").select("id,name").eq("school_id", schoolId).order("name"),
    supabase.from("library_publishers").select("id,name").eq("school_id", schoolId).order("name"),
    supabase.from("library_books")
      .select("id,title,isbn,rack_location,library_authors(name),library_categories(name),library_publishers(name)")
      .eq("school_id", schoolId).order("title").limit(2000),
    supabase.from("library_book_copies").select("id,copy_number,status,condition_note,book_id").eq("school_id", schoolId).order("copy_number").limit(5000),
    supabase.from("library_members")
      .select("id,membership_number,member_type,status,student_id,teacher_id,students(first_name,last_name),teachers(first_name,last_name)")
      .eq("school_id", schoolId).order("membership_number").limit(2000),
    supabase.from("library_transactions")
      .select("id,copy_id,member_id,status,issued_on,due_date,returned_on,fine_amount,library_book_copies(copy_number,library_books(title)),library_members(membership_number,member_type,status,students(first_name,last_name),teachers(first_name,last_name))")
      .eq("school_id", schoolId).order("issued_on", { ascending: false }).limit(3000),
    supabase.from("students").select("id,first_name,last_name,admission_number").eq("school_id", schoolId).eq("is_active", true).order("last_name").limit(2000),
    supabase.from("teachers").select("id,first_name,last_name,employee_code,profile_id").eq("school_id", schoolId).eq("is_active", true).eq("employment_status", "active").is("deleted_at", null).order("last_name").limit(1000),
  ]);
  const loadError = authorsError || categoriesError || publishersError || booksError || copiesError || membersError || transactionsError || studentsError || teachersError;
  if (loadError) {
    console.error("Library workspace could not be loaded.", { authorsError, categoriesError, publishersError, booksError, copiesError, membersError, transactionsError, studentsError, teachersError });
    throw new Error("Library workspace data could not be loaded.");
  }

  const authorOptions = (authors ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  const categoryOptions = (categories ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  const publisherOptions = (publishers ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  const studentOptions = (students ?? []).map((item) => ({
    id: String(item.id),
    name: `${item.first_name ?? ""} ${item.last_name ?? ""}${item.admission_number ? ` · ${item.admission_number}` : ""}`.trim(),
  }));
  const teacherOptions = (teachers ?? []).map((item) => ({
    id: String(item.id),
    name: `${item.first_name ?? ""} ${item.last_name ?? ""}${item.employee_code ? ` · ${item.employee_code}` : ""}`.trim(),
  }));

  const copiesByBook = new Map<string, typeof copyRecords>();
  for (const copy of copyRecords ?? []) {
    const rows = copiesByBook.get(String(copy.book_id)) ?? [];
    rows.push(copy);
    copiesByBook.set(String(copy.book_id), rows);
  }
  const books: LibraryBookRow[] = (bookRecords ?? []).map((book) => {
    const copies = copiesByBook.get(String(book.id)) ?? [];
    return {
      id: String(book.id),
      title: String(book.title),
      isbn: String(book.isbn),
      author: relation<Named>(book.library_authors)?.name ?? "Unknown author",
      category: relation<Named>(book.library_categories)?.name ?? "Uncategorised",
      publisher: relation<Named>(book.library_publishers)?.name ?? "Unknown publisher",
      rackLocation: String(book.rack_location ?? ""),
      totalCopies: copies.length,
      availableCopies: copies.filter((copy) => copy.status === "available").length,
      onLoanCopies: copies.filter((copy) => copy.status === "issued").length,
    };
  });

  const membersById = new Map<string, LibraryMemberRow>();
  const members: LibraryMemberRow[] = (memberRecords ?? []).map((record) => {
    const person = record.member_type === "student"
      ? relation<PersonName>(record.students)
      : relation<PersonName>(record.teachers);
    const member = {
      id: String(record.id),
      name: [person?.first_name, person?.last_name].filter(Boolean).join(" ") || `${record.member_type} member`,
      memberType: String(record.member_type),
      membershipNumber: String(record.membership_number),
      status: String(record.status),
      activeLoans: 0,
    };
    membersById.set(member.id, member);
    return member;
  });
  const copyById = new Map((copyRecords ?? []).map((copy) => [String(copy.id), copy]));
  const loans: LibraryLoanRow[] = (transactionRecords ?? []).map((record) => {
    const copy = copyById.get(String(record.copy_id));
    const bookCopy = relation<{ copy_number: string | null; library_books: Relation<{ title: string | null }> }>(record.library_book_copies);
    const bookTitle = relation<{ title: string | null }>(bookCopy?.library_books ?? null)?.title ?? "Unknown title";
    const memberRecord = relation<{ membership_number: string; member_type: string; status: string; students: Relation<PersonName>; teachers: Relation<PersonName> }>(record.library_members);
    const person = memberRecord?.member_type === "student" ? relation<PersonName>(memberRecord.students) : relation<PersonName>(memberRecord?.teachers ?? null);
    const memberName = [person?.first_name, person?.last_name].filter(Boolean).join(" ");
    const member = membersById.get(String(record.member_id));
    if (member && ["issued", "overdue"].includes(String(record.status)) && !record.returned_on) member.activeLoans += 1;
    return {
      id: String(record.id),
      title: bookTitle,
      copyNumber: String(copy?.copy_number ?? bookCopy?.copy_number ?? "—"),
      memberName: memberName || `${memberRecord?.member_type ?? "Member"} ${memberRecord?.membership_number ?? ""}`.trim(),
      memberNumber: String(memberRecord?.membership_number ?? "—"),
      memberStatus: String(memberRecord?.status ?? "unknown"),
      issuedOn: String(record.issued_on),
      dueDate: String(record.due_date),
      returnedOn: record.returned_on ? String(record.returned_on) : null,
      status: String(record.status),
      fineAmount: Number(record.fine_amount),
    };
  });

  const memberOptions = members.filter((member) => member.status === "active").map((member) => ({
    id: member.id,
    name: `${member.name} · ${member.membershipNumber}`,
  }));
  const copyOptions = (copyRecords ?? []).map((copy) => {
    const book = books.find((item) => item.id === String(copy.book_id));
    return {
      id: String(copy.id),
      name: `${book?.title ?? "Book"} · ${String(copy.copy_number)} · ${String(copy.status)}`,
      available: copy.status === "available",
    };
  });
  const inventoryCopies: LibraryCopyRow[] = (copyRecords ?? []).map((copy) => ({
    id: String(copy.id),
    title: books.find((book) => book.id === String(copy.book_id))?.title ?? "Unknown title",
    copyNumber: String(copy.copy_number),
    status: String(copy.status),
    conditionNote: String(copy.condition_note ?? ""),
  }));
  const totalCopies = (copyRecords ?? []).length;
  const availableCopies = (copyRecords ?? []).filter((copy) => copy.status === "available").length;
  const issuedCopies = (copyRecords ?? []).filter((copy) => copy.status === "issued").length;
  const today = localDate();
  const openLoans = loans.filter((loan) => !loan.returnedOn && ["issued", "overdue"].includes(loan.status));
  const overdueLoans = openLoans.filter((loan) => loan.dueDate < today);
  const percent = (count: number, total: number) => total ? Math.round(count / total * 100) : 0;
  const bookOptions = books.map((book) => ({ id: book.id, name: book.title }));

  return <main className="students-shell library-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header>
    <section className="module-page-header library-page-header"><div className="module-page-header__row"><div>
      <p className="module-page-header__eyebrow">Library management</p>
      <h1>Your reading room, at a glance.</h1>
      <p>Manage the book catalog, membership, borrowing and returns from one workspace.</p>
    </div><a className="library-page-header__action" href="#library-actions">+ Add to library</a></div></section>
    <section className="module-kpi-grid library-kpi-grid" aria-label="Library summary">
      <article className="module-kpi library-kpi"><span>Catalog titles</span><strong>{books.length}</strong><small>{totalCopies} total physical copies</small></article>
      <ProgressWheel label="Available" value={availableCopies} percentage={percent(availableCopies, totalCopies)} color="#047857" detail={`${availableCopies} of ${totalCopies} copies`} />
      <ProgressWheel label="On loan" value={issuedCopies} percentage={percent(issuedCopies, totalCopies)} color="#1d4ed8" detail={`${openLoans.length} active loans`} />
      <article className={`module-kpi library-kpi${overdueLoans.length ? " library-kpi--alert" : ""}`}><span>Overdue loans</span><strong>{overdueLoans.length}</strong><small>Needs follow-up</small></article>
    </section>

    <LibraryActionsPanel
      authors={authorOptions}
      categories={categoryOptions}
      publishers={publisherOptions}
      books={bookOptions}
      students={studentOptions}
      teachers={teacherOptions}
      copies={copyOptions}
      members={memberOptions}
      today={today}
      canManage={canManage}
      canIssue={canIssue}
    />
    <LibraryRegister books={books} copies={inventoryCopies} loans={loans} members={members} canReturn={canReturn} canManage={canManage} today={today} />
  </main>;
}
