import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GlobalSearchBar } from "@/components/search/global-search";

export default async function SearchPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const { data: membership } = await supabase.from("user_roles").select("school_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership?.school_id) redirect("/setup?onboarding=1");
  return <main className="students-shell"><header className="students-header"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>schooliva</span></Link><Link className="text-action" href="/dashboard">Dashboard -&gt;</Link></header><section className="students-heading"><div><p className="eyebrow">Global search</p><h1>Search authorized records.</h1><p>Search students, teachers, parents, classes, invoices, books, and assignments without exposing unauthorized results.</p></div></section><GlobalSearchBar /></main>;
}
