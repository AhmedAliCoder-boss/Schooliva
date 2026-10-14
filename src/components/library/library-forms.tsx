"use client";

import { useActionState, useState } from "react";

import { addBookCopies, issueBook, returnBook, saveAuthor, saveBook, saveCategory, saveMember, savePublisher, updateCopyStatus, updateMemberStatus } from "@/app/actions/library";
import { SubmitButton } from "@/components/auth/submit-button";
import type { LibraryFormState } from "@/lib/library/schemas";

type Option = { id: string; name: string };
type CopyOption = Option & { available: boolean };

function Feedback({ state }: { state: LibraryFormState | undefined }) {
  return <>{state?.error && <p className="student-error" role="alert">{state.error}</p>}{state?.success && <p className="student-success" role="status">{state.success}</p>}</>;
}

function Select({ label, name, options, required = true }: { label: string; name: string; options: Option[]; required?: boolean }) {
  return <label className="student-field">{label}<select name={name} required={required}><option value="">Select {label.toLowerCase()}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

export function AuthorForm() {
  const [state, action] = useActionState(saveAuthor, undefined);
  return <form action={action} className="student-form library-form"><Feedback state={state} /><div className="student-form-grid">
    <label className="student-field">Author name<input name="name" required maxLength={160} /></label>
    <label className="student-field student-field-wide">Biography<textarea name="bio" rows={3} maxLength={2000} /></label>
  </div><SubmitButton>Add author</SubmitButton></form>;
}

export function CategoryForm() {
  const [state, action] = useActionState(saveCategory, undefined);
  return <form action={action} className="student-form library-form"><Feedback state={state} /><div className="student-form-grid"><label className="student-field">Category name<input name="name" required maxLength={120} /></label></div><SubmitButton>Add category</SubmitButton></form>;
}

export function PublisherForm() {
  const [state, action] = useActionState(savePublisher, undefined);
  return <form action={action} className="student-form library-form"><Feedback state={state} /><div className="student-form-grid"><label className="student-field">Publisher name<input name="name" required maxLength={160} /></label></div><SubmitButton>Add publisher</SubmitButton></form>;
}

export function BookForm({ authors, categories, publishers }: { authors: Option[]; categories: Option[]; publishers: Option[] }) {
  const [state, action] = useActionState(saveBook, undefined);
  return <form action={action} className="student-form library-form"><Feedback state={state} /><div className="student-form-grid">
    <label className="student-field student-field-wide">Book title<input name="title" required maxLength={240} /></label>
    <label className="student-field">ISBN<input name="isbn" required maxLength={40} /></label>
    <Select label="Author" name="authorId" options={authors} />
    <Select label="Category" name="categoryId" options={categories} />
    <Select label="Publisher" name="publisherId" options={publishers} />
    <label className="student-field">Edition<input name="edition" maxLength={80} /></label>
    <label className="student-field">Publication year<input name="yearPublished" type="number" min="0" max="9999" /></label>
    <label className="student-field">Rack / shelf<input name="rackLocation" maxLength={80} /></label>
    <label className="student-field student-field-wide">Description<textarea name="summary" rows={3} maxLength={2000} /></label>
  </div><SubmitButton>Add to catalog</SubmitButton></form>;
}

export function AddCopiesForm({ books }: { books: Option[] }) {
  const [state, action] = useActionState(addBookCopies, undefined);
  return <form action={action} className="student-form library-form"><Feedback state={state} /><div className="student-form-grid">
    <Select label="Book" name="bookId" options={books} />
    <label className="student-field">Copy code prefix<input name="prefix" defaultValue="LIB-" required maxLength={24} /></label>
    <label className="student-field">Number of copies<input name="quantity" type="number" min="1" max="100" defaultValue="1" required /></label>
  </div><p className="library-form__hint">New copy numbers continue from the latest number using this prefix, e.g. LIB-001.</p><SubmitButton>Add copies</SubmitButton></form>;
}

export function MemberForm({ students, teachers }: { students: Option[]; teachers: Option[] }) {
  const [state, action] = useActionState(saveMember, undefined);
  const [type, setType] = useState<"student" | "teacher">("student");
  return <form action={action} className="student-form library-form"><Feedback state={state} /><div className="student-form-grid">
    <label className="student-field">Member type<select name="memberType" value={type} onChange={(event) => {
      if (event.target.value === "student" || event.target.value === "teacher") setType(event.target.value);
    }} required><option value="student">Student</option><option value="teacher">Teacher</option></select></label>
    {type === "student" ? <Select label="Student" name="studentId" options={students} /> : <Select label="Teacher" name="teacherId" options={teachers} />}
    <label className="student-field">Membership number<input name="membershipNumber" required maxLength={50} /></label>
  </div><p className="library-form__hint">The member’s linked Schooliva profile is used automatically.</p><SubmitButton>Register member</SubmitButton></form>;
}

export function IssueBookForm({ copies, members, today }: { copies: CopyOption[]; members: Option[]; today: string }) {
  const [state, action] = useActionState(issueBook, undefined);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date(`${today}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 14);
    return date.toISOString().slice(0, 10);
  });
  return <form action={action} className="student-form library-form"><Feedback state={state} /><div className="student-form-grid">
    <label className="student-field">Available copy<select name="copyId" required disabled={!copies.some((copy) => copy.available)}><option value="">Select an available book copy</option>{copies.filter((copy) => copy.available).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <Select label="Member" name="memberId" options={members} />
    <label className="student-field">Due date<input name="dueDate" type="date" min={today} value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label>
  </div><p className="library-form__hint">A standard 14-day loan period is prefilled; update the due date if needed.</p><SubmitButton disabled={!copies.some((copy) => copy.available) || !members.length}>Issue book</SubmitButton></form>;
}

export function ReturnBookForm({ transactionId, suggestedFine = 0 }: { transactionId: string; suggestedFine?: number }) {
  const [state, action] = useActionState(returnBook, undefined);
  return <form action={action} className="library-return-form">
    <input type="hidden" name="transactionId" value={transactionId} />
    <label>Fine<input name="fineAmount" type="number" min="0" max="10000000" step="0.01" defaultValue={suggestedFine} aria-label="Fine amount" /></label>
    <SubmitButton>Return</SubmitButton><Feedback state={state} />
  </form>;
}

export function MemberStatusForm({ memberId, status }: { memberId: string; status: string }) {
  const [state, action] = useActionState(updateMemberStatus, undefined);
  const nextStatus = status === "active" ? "blocked" : "active";
  return <form action={action} className="library-member-status">
    <input type="hidden" name="memberId" value={memberId} /><input type="hidden" name="status" value={nextStatus} />
    <SubmitButton>{nextStatus === "active" ? "Reactivate" : "Block member"}</SubmitButton><Feedback state={state} />
  </form>;
}

export function CopyStatusForm({ copyId, status, conditionNote }: { copyId: string; status: string; conditionNote: string }) {
  const [state, action] = useActionState(updateCopyStatus, undefined);
  return <form action={action} className="library-copy-status">
    <input type="hidden" name="copyId" value={copyId} />
    <label>Status<select name="status" defaultValue={status === "issued" ? "available" : status}><option value="available">Available</option><option value="reserved">Reserved</option><option value="lost">Lost</option><option value="damaged">Damaged</option></select></label>
    <label>Condition note<input name="conditionNote" defaultValue={conditionNote} maxLength={500} placeholder="Optional note" /></label>
    <SubmitButton>Save</SubmitButton><Feedback state={state} />
  </form>;
}
