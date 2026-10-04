import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !adminKey) return null;

  return createClient(url, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
