"use server";

import { revalidatePath } from "next/cache";
import { requireLibraryContext } from "@/lib/library/context";
import { authorSchema, bookSchema, categorySchema, issueSchema, memberSchema, publisherSchema, type LibraryFormState } from "@/lib/library/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function saveAuthor(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = authorSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Author form invalid hai." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const { error } = await supabase.from("library_authors").insert({ school_id: schoolId, name: parsed.data.name, bio: parsed.data.bio || null });
  if (error) return { error: error.code === "23505" ? "Author already exists." : "Author add nahi ho saka." };
  revalidatePath("/library"); return { success: "Author add ho gaya." };
}

export async function saveCategory(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = categorySchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Category form invalid hai." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const { error } = await supabase.from("library_categories").insert({ school_id: schoolId, name: parsed.data.name });
  if (error) return { error: error.code === "23505" ? "Category already exists." : "Category add nahi ho saka." };
  revalidatePath("/library"); return { success: "Category add ho gaya." };
}

export async function savePublisher(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = publisherSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Publisher form invalid hai." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const { error } = await supabase.from("library_publishers").insert({ school_id: schoolId, name: parsed.data.name });
  if (error) return { error: error.code === "23505" ? "Publisher already exists." : "Publisher add nahi ho saka." };
  revalidatePath("/library"); return { success: "Publisher add ho gaya." };
}

export async function saveBook(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = bookSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Book form invalid hai." };
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
  if (error) return { error: error.code === "23505" ? "ISBN already exists." : "Book add nahi ho saka." };
  revalidatePath("/library"); return { success: "Book add ho gaya." };
}

export async function saveMember(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = memberSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Member form invalid hai." };
  const { supabase, schoolId } = await requireLibraryContext("manage");
  const studentId = parsed.data.studentId === "" ? null : parsed.data.studentId;
  const teacherId = parsed.data.teacherId === "" ? null : parsed.data.teacherId;
  const { error } = await supabase.from("library_members").insert({
    school_id: schoolId,
    member_type: parsed.data.memberType,
    profile_id: parsed.data.profileId,
    student_id: studentId,
    teacher_id: teacherId,
    membership_number: parsed.data.membershipNumber,
    join_date: new Date().toISOString().slice(0, 10),
  });
  if (error) return { error: error.code === "23505" ? "Membership already exists." : "Library member create nahi ho saka." };
  revalidatePath("/library"); return { success: "Library member add ho gaya." };
}

export async function issueBook(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const parsed = issueSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Issue form invalid hai." };
  const { supabase, schoolId } = await requireLibraryContext("issue");
  const { error } = await supabase.from("library_transactions").insert({
    school_id: schoolId,
    copy_id: parsed.data.copyId,
    member_id: parsed.data.memberId,
    due_date: parsed.data.dueDate,
    status: "issued",
  });
  if (error) return { error: error.message.includes("available") ? "Selected copy currently unavailable." : "Book issue nahi ho saka." };
  revalidatePath("/library"); return { success: "Book issue ho gaya." };
}

export async function returnBook(_: LibraryFormState | undefined, formData: FormData): Promise<LibraryFormState> {
  const transactionId = String(formData.get("transactionId") ?? "");
  const { supabase, schoolId } = await requireLibraryContext("return");
  const { error } = await supabase.from("library_transactions").update({ returned_on: new Date().toISOString().slice(0, 10), status: "returned" }).eq("id", transactionId).eq("school_id", schoolId);
  if (error) return { error: "Book return update nahi ho saka." };
  revalidatePath("/library"); return { success: "Book return ho gaya." };
}
