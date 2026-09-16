"use server";

import { revalidatePath } from "next/cache";
import { requireDocumentContext } from "@/lib/documents/context";
import { certificateSchema, type DocumentFormState } from "@/lib/documents/schemas";

function values(formData: FormData) { return Object.fromEntries(formData.entries()); }

export async function issueCertificate(_: DocumentFormState | undefined, formData: FormData): Promise<DocumentFormState> {
  const parsed = certificateSchema.safeParse(values(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Certificate form invalid hai." };
  const { supabase, schoolId, user } = await requireDocumentContext("manage");
  const content = parsed.data.content ? { text: parsed.data.content } : {};
  const { error } = await supabase.from("certificate_records").insert({
    school_id: schoolId,
    student_id: parsed.data.studentId,
    certificate_type: parsed.data.certificateType,
    certificate_number: parsed.data.certificateNumber,
    issued_on: parsed.data.issuedOn,
    content,
    status: "issued",
    issued_by: user.id,
  });
  if (error) return { error: error.code === "23505" ? "Certificate number already exists." : "Certificate issue nahi hua." };
  revalidatePath("/documents"); return { success: "Certificate issue ho gaya." };
}
