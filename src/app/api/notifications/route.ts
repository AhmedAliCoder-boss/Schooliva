import { NextResponse } from "next/server";

import { getActiveSchoolContext } from "@/lib/admin/school-context";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const { schoolId } = await getActiveSchoolContext(supabase, user.id);
  if (!schoolId) return NextResponse.json({ unreadCount: 0, notifications: [] }, { headers: { "Cache-Control": "no-store" } });

  const [
    { data: notifications, error: notificationsError },
    { count: unreadCount, error: countError },
  ] = await Promise.all([
    supabase.from("notifications")
      .select("id,event_type,title,message,entity_type,entity_id,read_at,created_at")
      .eq("school_id", schoolId)
      .eq("recipient_profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("recipient_profile_id", user.id)
      .is("read_at", null),
  ]);
  if (notificationsError || countError) {
    console.error("Notification bell data could not be loaded.", { notificationsError, countError });
    return NextResponse.json({ error: "Notifications could not be loaded." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ unreadCount: unreadCount ?? 0, notifications: notifications ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
