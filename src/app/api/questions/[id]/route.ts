import { getAuthUser, requireAdmin, requireRoundUnlocked } from "@/lib/supabase/server";
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

    const { data: question, error: qError } = await supabase
      .from("questions")
      .select(
        "id, exam_number, question_type, title, description, starter_code, language, difficulty, sort_order, is_active, created_at, updated_at"
      )
      .eq("id", id)
      .single();

    if (qError) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Enforce unlock time for the question's exam round
    const unlockCheck = await requireRoundUnlocked(supabase, question.exam_number);
    if (!unlockCheck.ok) return unlockCheck.response;

    const { data: testCases, error: tError } = await supabase
      .from("test_cases")
      .select("id, question_id, is_sample, stdin, expected_stdout, description, sort_order")
      .eq("question_id", id)
      .eq("is_sample", true)
      .order("sort_order");

    if (tError) {
      return NextResponse.json({ error: tError.message }, { status: 500 });
    }

    return NextResponse.json({ ...question, test_cases: testCases });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;

    const { id } = await params;
    const { supabase } = admin;
    const body = await request.json();

    const { data, error } = await supabase
      .from("questions")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;

    const { id } = await params;
    const { supabase } = admin;

    const { error } = await supabase.from("questions").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
