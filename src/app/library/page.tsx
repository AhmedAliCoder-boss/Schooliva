import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthorForm, BookForm, CategoryForm, IssueBookForm, MemberForm, PublisherForm, ReturnBookForm } from "@/components/library/library-forms";

function relation<T>(value: unknown): T | null { return Array.isArray(value) ? (value[0] ?? null) as T : value as T | null; }

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  const schoolId = membership.school_id as string;

  const [{ data: authors }, { data: categories }, { data: publishers }, { data: books }, { data: copies }, { data: members }, { data: transactions }, { data: students }, { data: teachers }] = await Promise.all([
    supabase.from("library_authors").select("id,name").eq("school_id", schoolId).order("name"),
    supabase.from("library_categories").select("id,name").eq("school_id", schoolId).order("name"),
    supabase.from("library_publishers").select("id,name").eq("school_id", schoolId).order("name"),
    supabase.from("library_books").select("id,title,isbn,library_authors(name),library_categories(name),library_publishers(name)").eq("school_id", schoolId).order("title"),
    supabase.from("library_book_copies").select("id,copy_number,status,book_id,library_books(title)").eq("school_id", schoolId).order("copy_number"),
    supabase.from("library_members").select("id,membership_number,member_type,status,profile_id").eq("school_id", schoolId).order("membership_number"),
    supabase.from("library_transactions").select("id,copy_id,member_id,status,due_date,returned_on,fine_amount,library_members(membership_number)").eq("school_id", schoolId).order("due_date", { ascending: false }),
    supabase.from("students").select("id,first_name,last_name,admission_number").eq("school_id", schoolId).order("last_name"),
    supabase.from("teachers").select("id,profile_id").eq("school_id", schoolId).order("id"),
  ]);

  const authorOptions = (authors ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  const categoryOptions = (categories ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  const publisherOptions = (publishers ?? []).map((item) => ({ id: String(item.id), name: String(item.name) }));
  const studentOptions = (students ?? []).map((item) => ({ id: String(item.id), name: `${item.first_name ?? ""} ${item.last_name ?? ""} (${item.admission_number ?? "-"})`.trim() }));
  const teacherOptions = (teachers ?? []).map((item) => ({ id: String(item.id), name: `Teacher ${String(item.id).slice(0, 8)}` }));
  const copyOptions = (copies ?? []).map((item) => ({ id: String(item.id), name: `${String((relation<{ title: string }>(item.library_books))?.title ?? "Book")} · ${String(item.copy_number)} · ${String(item.status)}` }));
  const memberOptions = (members ?? []).map((item) => ({ id: String(item.id), name: `${String(item.member_type)} · ${String(item.membership_number)}` }));

  const activeCopies = (copies ?? []).filter((copy) => String(copy.status).toLowerCase() === "available").length;
  const issuedCopies = (copies ?? []).filter((copy) => String(copy.status).toLowerCase() === "issued").length;
  const overdueCount = (transactions ?? []).filter((transaction) => String(transaction.status).toLowerCase() === "overdue").length;
  return <main className="students-shell">
    <header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header>
    <section className="module-page-header"><div className="module-page-header__row"><div><p className="module-page-header__eyebrow">Library</p><h1>Books, members, and circulation.</h1><p>Manage inventory, availability, circulation, and overdue handling with transactional safeguards.</p></div></div></section>
    <section className="module-kpi-grid"><article className="module-kpi"><span>Books</span><strong>{(books ?? []).length}</strong></article><article className="module-kpi"><span>Available</span><strong>{activeCopies}</strong></article><article className="module-kpi"><span>Issued</span><strong>{issuedCopies}</strong></article><article className="module-kpi"><span>Overdue</span><strong>{overdueCount}</strong></article></section>
    <section className="setup-card"><h3>Catalog</h3><AuthorForm /><CategoryForm /><PublisherForm /><BookForm authors={authorOptions} categories={categoryOptions} publishers={publisherOptions} /></section>
    <section className="setup-card"><h3>Members</h3><MemberForm students={studentOptions} teachers={teacherOptions} /></section>
    <section className="setup-card"><h3>Issue / return</h3><IssueBookForm copies={copyOptions} members={memberOptions} /></section>
    <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Publisher</th><th>ISBN</th><th>Status</th></tr></thead><tbody>{(books ?? []).length ? (books ?? []).map((book) => { const author = relation<{ name: string }>(book.library_authors); const category = relation<{ name: string }>(book.library_categories); const publisher = relation<{ name: string }>(book.library_publishers); return <tr key={String(book.id)}><td>{String(book.title)}</td><td>{author?.name ?? "-"}</td><td>{category?.name ?? "-"}</td><td>{publisher?.name ?? "-"}</td><td>{String(book.isbn)}</td><td><span className="status-pill active">Catalogued</span></td></tr>; }) : <tr><td colSpan={6}><div className="student-empty"><h3>No books yet</h3><p>Add books to build the library catalog.</p></div></td></tr>}</tbody></table></div>
    <div className="student-table-wrap" style={{ marginTop: 24 }}><table className="student-table"><thead><tr><th>Copy</th><th>Member</th><th>Due</th><th>Status</th><th>Fine</th><th>Action</th></tr></thead><tbody>{(transactions ?? []).length ? (transactions ?? []).map((transaction) => { const member = relation<{ membership_number: string }>(transaction.library_members); return <tr key={String(transaction.id)}><td>{String(transaction.copy_id)}</td><td>{member?.membership_number ?? "-"}</td><td>{String(transaction.due_date)}</td><td>{String(transaction.status)}</td><td>{String(transaction.fine_amount)}</td><td><ReturnBookForm transactionId={String(transaction.id)} /></td></tr>; }) : <tr><td colSpan={6}><div className="student-empty"><h3>No circulation records</h3><p>Issued books will appear here.</p></div></td></tr>}</tbody></table></div>
  </main>;
}
