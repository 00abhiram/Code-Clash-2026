import { getAuthUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;

    const { supabase } = auth;
    const { searchParams } = new URL(request.url);
    const examNumber = searchParams.get("exam");

    if (!examNumber || (examNumber !== "1" && examNumber !== "2")) {
      return NextResponse.json(
        { error: "exam parameter is required (1 or 2)" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("get_leaderboard_data", {
      exam_number_param: Number(examNumber),
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = (data || []).map(
      (
        row: {
          user_id: string;
          full_name: string;
          roll_no: string;
          branch: string;
          hidden_passed: number;
          hidden_total: number;
          sample_passed: number;
          sample_total: number;
          exec_time_ms: number;
          time_taken_secs: number;
          attempted: number;
        },
        index: number
      ) => ({
        rank: index + 1,
        user_id: row.user_id,
        full_name: row.full_name,
        roll_no: row.roll_no,
        branch: row.branch,
        total_hidden_passed: row.hidden_passed,
        total_hidden_total: row.hidden_total,
        total_sample_passed: row.sample_passed,
        total_sample_total: row.sample_total,
        total_execution_time_ms: row.exec_time_ms,
        time_taken_seconds: row.time_taken_secs,
        questions_attempted: row.attempted,
      })
    );

    return NextResponse.json({
      exam: Number(examNumber),
      entries,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
