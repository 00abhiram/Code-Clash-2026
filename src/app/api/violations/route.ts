import { getAuthUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const VALID_VIOLATION_TYPES = new Set([
  "tab_switch",
  "fullscreen_exit",
  "shortcut_attempt",
  "background_limit",
  "other",
]);

const VIOLATION_THRESHOLD = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;

    const { user, supabase } = auth;
    const body = await request.json();
    const { exam_session_id, violation_type, description } = body;

    if (!exam_session_id || !violation_type) {
      return NextResponse.json(
        { error: "exam_session_id and violation_type are required" },
        { status: 400 }
      );
    }

    if (!VALID_VIOLATION_TYPES.has(violation_type)) {
      return NextResponse.json(
        { error: `Invalid violation_type. Must be one of: ${[...VALID_VIOLATION_TYPES].join(", ")}` },
        { status: 400 }
      );
    }

    const rateLimitKey = `${user.id}:${exam_session_id}`;
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    // Verify session exists and belongs to user (read-only, RLS allows SELECT own)
    const { data: session, error: sError } = await supabase
      .from("exam_sessions")
      .select("id, user_id, status, violation_count")
      .eq("id", exam_session_id)
      .single();

    if (sError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    if (session.status !== "in_progress") {
      return NextResponse.json(
        { error: "Session is not active" },
        { status: 409 }
      );
    }

    // Insert violation (RLS allows: auth.uid() = user_id + session ownership check)
    const { data, error } = await supabase
      .from("violations")
      .insert({
        user_id: user.id,
        exam_session_id,
        violation_type,
        description,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Increment violation count via SECURITY DEFINER RPC (bypasses RLS)
    // Verifies session ownership internally
    const newCount = (session.violation_count || 0) + 1;

    const { error: rpcError } = await supabase.rpc("increment_violation_count", {
      p_session_id: exam_session_id,
      p_user_id: user.id,
    });

    if (rpcError) {
      // RPC failed — violation was recorded but count not incremented.
      // This is a degraded state; the violation is logged but the count
      // may be off by one. The threshold will still be triggered eventually.
      console.error("increment_violation_count RPC failed:", rpcError.message);
    }

    // Server-side auto-submit: check if threshold reached
    let autoSubmitted = false;
    if (newCount >= VIOLATION_THRESHOLD) {
      // Re-check session status before auto-submit (another request may have completed it)
      const { data: freshSession } = await supabase
        .from("exam_sessions")
        .select("status")
        .eq("id", exam_session_id)
        .single();

      if (freshSession?.status === "in_progress") {
        // Complete session via SECURITY DEFINER function (bypasses RLS)
        // Uses WHERE status = 'in_progress' internally to prevent double-completion
        const { error: completeError } = await supabase
          .rpc("complete_exam_session", {
            p_session_id: exam_session_id,
            p_user_id: user.id,
            p_auto_submitted: true,
          });

        if (!completeError) {
          autoSubmitted = true;
        }
      }
    }

    return NextResponse.json({ ...data, auto_submitted: autoSubmitted }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
