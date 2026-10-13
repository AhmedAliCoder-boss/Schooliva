import type { createClient } from "@/lib/supabase/server";
import { getSchoolBrandingForSchool } from "@/lib/school-branding";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function getSchoolDocumentIdentity(supabase: SupabaseClient, schoolId: string) {
  const [{ data: school, error }, branding] = await Promise.all([
    supabase.from("schools").select("name,code,email,phone,address,city,state,country,postal_code,logo_path").eq("id", schoolId).maybeSingle(),
    getSchoolBrandingForSchool(supabase, schoolId),
  ]);
  if (error) throw new Error("School identity could not be loaded for this document.");
  if (!school) throw new Error("School identity is unavailable for this document.");

  let logoUrl = branding?.logoUrl ?? null;
  if (!logoUrl && school.logo_path) {
    const { data, error: logoError } = await supabase.storage.from("school-branding").createSignedUrl(school.logo_path, 3600);
    if (logoError) throw new Error("School logo could not be prepared for this document.");
    logoUrl = data?.signedUrl ?? null;
  }

  return { ...school, logoUrl };
}
