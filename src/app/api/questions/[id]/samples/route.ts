import { getAuthUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const { supabase } = auth;

    const { error: qError } = await supabase
      .from("questions")
      .select("id")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (qError) {
      return NextResponse.json(
        { error: "Question not found or inactive" },
        { status: 404 }
      );
    }

    const { data: testCases, error: tcError } = await supabase
      .from("test_cases")
      .select("id, is_sample, stdin, expected_stdout, description, sort_order")
      .eq("question_id", id)
      .eq("is_sample", true)
      .order("sort_order");

    if (tcError) {
      return NextResponse.json(
        { error: tcError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(testCases || []);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
