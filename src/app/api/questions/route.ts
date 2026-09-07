import { getAuthUser, requireAdmin, requireRoundUnlocked } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;

    const { supabase } = auth;
    const { searchParams } = new URL(request.url);
    const examNumber = searchParams.get("exam");

    // If requesting questions for a specific exam, enforce unlock time
    if (examNumber) {
      const num = Number(examNumber);
      if (num === 1 || num === 2) {
        const unlockCheck = await requireRoundUnlocked(supabase, num);
        if (!unlockCheck.ok) return unlockCheck.response;
      }
    }

    let query = supabase
      .from("questions")
      .select(
        "id, exam_number, question_type, title, description, starter_code, language, difficulty, sort_order, is_active, created_at, updated_at"
      )
      .eq("is_active", true)
      .order("sort_order");

    if (examNumber) {
      query = query.eq("exam_number", Number(examNumber));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;

    const { supabase } = admin;
    const body = await request.json();

    const { data, error } = await supabase
      .from("questions")
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
