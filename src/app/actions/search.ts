"use server";

import { requireSearchContext } from "@/lib/search/context";

export async function globalSearchAction(query: string, scope?: string) {
  const { supabase, schoolId } = await requireSearchContext();
  const term = query.trim();
  if (!term || term.length < 2) {
    return { students: [], teachers: [], parents: [], classes: [], invoices: [], books: [], assignments: [] };
  }
  const { data } = await supabase.rpc("global_search", { target_school_id: schoolId, search_term: term, entity_scope: scope ?? null });
  return data ?? { students: [], teachers: [], parents: [], classes: [], invoices: [], books: [], assignments: [] };
}
