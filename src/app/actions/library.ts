"use server";

import { revalidatePath } from "next/cache";
import { requireLibraryContext } from "@/lib/library/context";
import { authorSchema, bookSchema, categorySchema, copyBatchSchema, copyStatusSchema, issueSchema, memberSchema, memberStatusSchema, publisherSchema, returnSchema, type LibraryFormState } from "@/lib/library/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

function schoolLocalDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function saveAuthor(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = authorSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Author form is invalid." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const { error } = await supabase.from("library_authors").insert({ school_id: schoolId, name: parsed.data.name, bio: parsed.data.bio || null });
  if (error) return { error: error.code === "23505" ? "Author already exists." : "Author could not be added." };
  revalidatePath("/library"); return { success: "Author added." };
}

export async function saveCategory(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = categorySchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Category form is invalid." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const { error } = await supabase.from("library_categories").insert({ school_id: schoolId, name: parsed.data.name });
  if (error) return { error: error.code === "23505" ? "Category already exists." : "Category could not be added." };
  revalidatePath("/library"); return { success: "Category added." };
}

export async function savePublisher(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = publisherSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Publisher form is invalid." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const { error } = await supabase.from("library_publishers").insert({ school_id: schoolId, name: parsed.data.name });
  if (error) return { error: error.code === "23505" ? "Publisher already exists." : "Publisher could not be added." };
  revalidatePath("/library"); return { success: "Publisher added." };
}

export async function saveBook(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = bookSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Book form is invalid." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const { error } = await supabase.from("library_books").insert({
    school_id: schoolId,
    title: parsed.data.title,
    isbn: parsed.data.isbn,
    author_id: parsed.data.authorId,
    category_id: parsed.data.categoryId,
    publisher_id: parsed.data.publisherId,
    edition: parsed.data.edition || null,
    year_published: parsed.data.yearPublished === "" ? null : parsed.data.yearPublished,
    summary: parsed.data.summary || null,
    rack_location: parsed.data.rackLocation || null,
  });
  if (error) return { error: error.code === "23505" ? "ISBN already exists." : "Book could not be added." };
  revalidatePath("/library"); return { success: "Book added." };
}

export async function addBookCopies(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = copyBatchSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Copy details are invalid." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const { data: book, error: bookError } = await supabase.from("library_books")
    .select("id,title")
    .eq("id", parsed.data.bookId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (bookError) {
    console.error("Library book could not be loaded for copy intake.", bookError);
    return { error: "Book inventory could not be verified." };
  }
  const copies: Array<{ copy_number: string }> = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("library_book_copies")
      .select("copy_number")
      .eq("book_id", parsed.data.bookId)
      .eq("school_id", schoolId)
      .like("copy_number", `${parsed.data.prefix.replaceAll("_", "\\_")}%`)
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Library copy numbers could not be loaded.", error);
      return { error: "Book inventory could not be verified." };
    }
    copies.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) break;
  }
  if (!book) return { error: "Select a book in this school's catalog." };

  const prefix = parsed.data.prefix;
  const highestNumber = (copies ?? []).reduce((highest, copy) => {
    const copyNumber = String(copy.copy_number);
    if (!copyNumber.startsWith(prefix)) return highest;
    const suffix = copyNumber.slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(highest, Number(suffix)) : highest;
  }, 0);
  const rows = Array.from({ length: parsed.data.quantity }, (_, index) => ({
    school_id: schoolId,
    book_id: book.id,
    copy_number: `${prefix}${String(highestNumber + index + 1).padStart(3, "0")}`,
    status: "available",
  }));
  const { error } = await supabase.from("library_book_copies").insert(rows);
  if (error) {
    console.error("Library copy batch could not be added.", error);
    return { error: error.code === "23505" ? "Copy numbers were added concurrently. Refresh and try again." : "Copies could not be added to inventory." };
  }
  revalidatePath("/library");
  return { success: `${rows.length} ${rows.length === 1 ? "copy" : "copies"} added for ${book.title}.` };
}

export async function saveMember(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = memberSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Member form is invalid." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const studentId = parsed.data.memberType === "student" ? parsed.data.studentId : null;
  const teacherId = parsed.data.memberType === "teacher" ? parsed.data.teacherId : null;
  const { data: person, error: personError } = parsed.data.memberType === "student"
    ? await supabase.from("students").select("profile_id").eq("id", studentId!).eq("school_id", schoolId).maybeSingle()
    : await supabase.from("teachers").select("profile_id").eq("id", teacherId!).eq("school_id", schoolId).maybeSingle();
  if (personError) {
    console.error("Library member profile could not be verified.", personError);
    return { error: "Selected student or teacher could not be verified." };
  }
  if (!person?.profile_id) return { error: "Selected student or teacher does not have a linked Schooliva profile." };
  const { error } = await supabase.from("library_members").insert({
    school_id: schoolId,
    member_type: parsed.data.memberType,
    profile_id: person.profile_id,
    student_id: studentId,
    teacher_id: teacherId,
    membership_number: parsed.data.membershipNumber,
    join_date: schoolLocalDate(),
  });
  if (error) return { error: error.code === "23505" ? "Membership already exists." : "Library member could not be created." };
  revalidatePath("/library"); return { success: "Library member added." };
}

export async function issueBook(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = issueSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Issue form is invalid." };
  if (parsed.data.dueDate < schoolLocalDate()) return { error: "Due date must be today or later." };
  const { supabase, schoolId } = await requireLibraryContext("issue");
  const [{ data: copy, error: copyError }, { data: member, error: memberError }] = await Promise.all([
    supabase.from("library_book_copies").select("id,status").eq("id", parsed.data.copyId).eq("school_id", schoolId).maybeSingle(),
    supabase.from("library_members").select("id,status").eq("id", parsed.data.memberId).eq("school_id", schoolId).maybeSingle(),
  ]);
  if (copyError || memberError) {
    console.error("Library loan eligibility could not be verified.", { copyError, memberError });
    return { error: "Selected copy and member could not be verified." };
  }
  if (!copy || copy.status !== "available") return { error: "Selected copy currently unavailable." };
  if (!member || member.status !== "active") return { error: "Only active library members can borrow books." };
  const { error } = await supabase.from("library_transactions").insert({
    school_id: schoolId,
    copy_id: parsed.data.copyId,
    member_id: parsed.data.memberId,
    due_date: parsed.data.dueDate,
    status: "issued",
  });
  if (error) {
    console.error("Library book issue failed.", error);
    return { error: error.message.toLowerCase().includes("available") ? "Selected copy currently unavailable." : "Book could not be issued." };
  }
  revalidatePath("/library"); return { success: "Book issued." };
}

export async function returnBook(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = returnSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Return details are invalid." };
  const { supabase, schoolId } = await requireLibraryContext("return");
  const { data, error } = await supabase.from("library_transactions")
    .update({ returned_on: schoolLocalDate(), status: "returned", fine_amount: parsed.data.fineAmount })
    .eq("id", parsed.data.transactionId)
    .eq("school_id", schoolId)
    .in("status", ["issued", "overdue"])
    .is("returned_on", null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Library book return could not be saved.", error);
    return { error: "Book return could not be recorded." };
  }
  if (!data) return { error: "This loan was already returned or is no longer active. Refresh the page." };
  revalidatePath("/library");
  return { success: parsed.data.fineAmount > 0 ? `Book returned. Fine recorded: ${parsed.data.fineAmount.toFixed(2)}.` : "Book returned; no fine recorded." };
}

export async function updateMemberStatus(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = memberStatusSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Member status is invalid." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const { data, error } = await supabase.from("library_members")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.memberId)
    .eq("school_id", schoolId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Library member status could not be updated.", error);
    return { error: "Member status could not be updated." };
  }
  if (!data) return { error: "Member was not found in this school's library." };
  revalidatePath("/library");
  return { success: `Member marked ${parsed.data.status}.` };
}

export async function updateCopyStatus(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = copyStatusSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Copy status is invalid." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const { data: copy, error: copyError } = await supabase.from("library_book_copies")
    .select("id,status")
    .eq("id", parsed.data.copyId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (copyError) {
    console.error("Library copy status could not be checked.", copyError);
    return { error: "Copy status could not be verified." };
  }
  if (!copy) return { error: "Copy was not found in this school's inventory." };
  if (copy.status === "issued") return { error: "Return this copy before changing its inventory status." };
  if (parsed.data.status === "available") {
    const { data: activeLoan, error: loanError } = await supabase.from("library_transactions")
      .select("id")
      .eq("copy_id", parsed.data.copyId)
      .eq("school_id", schoolId)
      .in("status", ["issued", "overdue"])
      .is("returned_on", null)
      .limit(1)
      .maybeSingle();
    if (loanError) {
      console.error("Active loans for this library copy could not be checked.", loanError);
      return { error: "The copy's active loan status could not be verified." };
    }
    if (activeLoan) return { error: "Return this copy's active loan before marking it available." };
  }
  const { data, error } = await supabase.from("library_book_copies")
    .update({ status: parsed.data.status, condition_note: parsed.data.conditionNote || null })
    .eq("id", parsed.data.copyId)
    .eq("school_id", schoolId)
    .eq("status", copy.status)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Library copy status could not be updated.", error);
    return { error: "Copy inventory status could not be updated." };
  }
  if (!data) return { error: "Copy status changed in another session. Refresh and try again." };
  revalidatePath("/library");
  return { success: `Copy marked ${parsed.data.status}.` };
}
