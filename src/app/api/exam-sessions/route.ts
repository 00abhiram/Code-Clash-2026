import { getAuthUser, requireRoundUnlocked, getDurationMinutes } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;

    const { user, supabase } = auth;
    const body = await request.json();
    const { exam_number } = body;

    if (!exam_number || (exam_number !== 1 && exam_number !== 2)) {
      return NextResponse.json(
        { error: "exam_number must be 1 or 2" },
        { status: 400 }
      );
    }

    // Server-side unlock enforcement — reject before round opens
    const unlockCheck = await requireRoundUnlocked(supabase, exam_number);
    if (!unlockCheck.ok) return unlockCheck.response;

    const { settings } = unlockCheck;
    const durationMinutes = getDurationMinutes(settings, exam_number);

    // Check if session already exists
    const { data: existing } = await supabase
      .from("exam_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("exam_number", exam_number)
      .single();

    if (existing) {
      // If already completed, block re-entry
      if (existing.status === "completed") {
        return NextResponse.json(existing);
      }

      // If in_progress, resume (don't create new)
      if (existing.status === "in_progress") {
        return NextResponse.json(existing);
      }

      // If pending, transition to in_progress via SECURITY DEFINER function
      const { data, error } = await supabase
        .rpc("start_exam_session", {
          p_session_id: existing.id,
          p_user_id: user.id,
        })
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Failed to start session" },
          { status: 500 }
        );
      }

      return NextResponse.json(data);
    }

    // Create new session — snapshot duration at creation time
    // INSERT is allowed by RLS (auth.uid() = user_id check)
    const { data, error } = await supabase
      .from("exam_sessions")
      .insert({
        user_id: user.id,
        exam_number,
        status: "in_progress",
        duration_minutes: durationMinutes,
        ip_address: request.headers.get("x-forwarded-for") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      })
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

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;

    const { user, supabase } = auth;
    const body = await request.json();
    const { id, status: newStatus } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Session id is required" },
        { status: 400 }
      );
    }

    if (!newStatus) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    // Fetch current session and verify ownership
    const { data: current } = await supabase
      .from("exam_sessions")
      .select("id, user_id, status, exam_number")
      .eq("id", id)
      .single();

    if (!current) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (current.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Route to appropriate SECURITY DEFINER function based on transition
    let result;
    if (newStatus === "in_progress" && current.status === "pending") {
      // pending → in_progress: use start_exam_session
      const { data, error } = await supabase
        .rpc("start_exam_session", {
          p_session_id: id,
          p_user_id: user.id,
        })
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Failed to start session" },
          { status: 500 }
        );
      }
      result = data;
    } else if (newStatus === "completed" && current.status === "in_progress") {
      // in_progress → completed: use complete_exam_session
      const { data, error } = await supabase
        .rpc("complete_exam_session", {
          p_session_id: id,
          p_user_id: user.id,
          p_auto_submitted: false,
        })
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: error?.message || "Failed to complete session" },
          { status: 500 }
        );
      }
      result = data;
    } else {
      return NextResponse.json(
        {
          error: `Invalid status transition: ${current.status} → ${newStatus}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
