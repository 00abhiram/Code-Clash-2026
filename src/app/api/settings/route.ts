import { getAuthUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;

    const { supabase } = auth;
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      // Return defaults if settings table is empty
      return NextResponse.json({
        id: 1,
        is_anti_cheat_enabled: true,
        exam1_unlock_at: "2026-08-07T08:15:00Z",
        exam2_unlock_at: "2026-08-07T09:00:00Z",
        exam1_duration_minutes: 30,
        exam2_duration_minutes: 30,
        exam1_pool_questions: false,
        exam2_pool_questions: false,
      });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
