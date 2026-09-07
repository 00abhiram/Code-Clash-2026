import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore errors in Server Components (read-only)
        }
      },
    },
  });
}

/**
 * Create a Supabase client with the service_role key.
 * Bypasses RLS — use ONLY for server-side operations that need elevated access
 * (e.g., calling SECURITY DEFINER functions that are restricted to service_role).
 * NEVER expose this client to the browser.
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service-role operations");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export type AuthUser = { id: string; email: string };
export type AuthProfile = AuthUser & { role: "student" | "admin"; full_name: string };

export type AuthError =
  | { ok: false; response: NextResponse; user?: null; profile?: null }
  | { ok: true; user: AuthUser; supabase: Awaited<ReturnType<typeof createClient>> };

/**
 * Get the authenticated user from the Supabase session cookie.
 * Returns { ok: false, response } with a 401 if unauthenticated.
 * Returns { ok: true, user, supabase } with the authenticated user.
 */
export async function getAuthUser(): Promise<AuthError> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  return { ok: true, user: { id: user.id, email: user.email ?? "" }, supabase };
}

/**
 * Require an authenticated admin user.
 * Returns { ok: true, user, profile, supabase } if the user is an admin.
 * Returns { ok: false, response } with 401/403 otherwise.
 */
export async function requireAdmin(): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; user: AuthUser; profile: AuthProfile; supabase: Awaited<ReturnType<typeof createClient>> }
> {
  const auth = await getAuthUser();
  if (!auth.ok) return auth;

  const { supabase, user } = auth;

  const { data: profile, error: pError } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (pError || !profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Profile not found" },
        { status: 403 }
      ),
    };
  }

  if (profile.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user,
    profile: { ...user, role: profile.role, full_name: profile.full_name },
    supabase,
  };
}

/**
 * Require the authenticated user to own the specified exam session.
 * Fetches the session and verifies user_id matches the authenticated user.
 * Returns the session if authorized, or a 403/404 response if not.
 */
export async function requireSessionOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string
): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; session: { id: string; user_id: string; status: string; exam_number: number } }
> {
  const { data: session, error } = await supabase
    .from("exam_sessions")
    .select("id, user_id, status, exam_number")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      ),
    };
  }

  if (session.user_id !== userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      ),
    };
  }

  return { ok: true, session };
}

// ---------------------------------------------------------------------------
// Timing helpers (Phase 3)
// ---------------------------------------------------------------------------

export type Settings = {
  id: number;
  is_anti_cheat_enabled: boolean;
  exam1_unlock_at: string;
  exam2_unlock_at: string;
  exam1_duration_minutes: number;
  exam2_duration_minutes: number;
  exam1_pool_questions: boolean;
  exam2_pool_questions: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  is_anti_cheat_enabled: true,
  exam1_unlock_at: "2026-08-07T08:15:00Z",
  exam2_unlock_at: "2026-08-07T09:00:00Z",
  exam1_duration_minutes: 30,
  exam2_duration_minutes: 30,
  exam1_pool_questions: false,
  exam2_pool_questions: false,
};

/**
 * Fetch exam settings from the database.
 * Returns default settings if the row doesn't exist.
 */
export async function getSettings(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) return DEFAULT_SETTINGS;
  return data as Settings;
}

export type RoundUnlockedResult =
  | { ok: true; settings: Settings }
  | { ok: false; response: NextResponse };

/**
 * Check whether a given exam round is unlocked (server-time authoritative).
 * Returns the settings if unlocked, or a 403 response if not yet unlocked.
 */
export async function requireRoundUnlocked(
  supabase: Awaited<ReturnType<typeof createClient>>,
  examNumber: number
): Promise<RoundUnlockedResult> {
  const settings = await getSettings(supabase);

  const unlockAt =
    examNumber === 1 ? settings.exam1_unlock_at : settings.exam2_unlock_at;

  const now = new Date();
  const unlock = new Date(unlockAt);

  if (now < unlock) {
    const diffMs = unlock.getTime() - now.getTime();
    const minutes = Math.ceil(diffMs / 60000);
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Exam not yet unlocked",
          unlock_at: unlockAt,
          minutes_until_unlock: minutes,
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, settings };
}

/**
 * Get the configured duration in minutes for a given exam number.
 */
export function getDurationMinutes(
  settings: Settings,
  examNumber: number
): number {
  return examNumber === 1
    ? settings.exam1_duration_minutes
    : settings.exam2_duration_minutes;
}

/**
 * Check whether an in-progress session has expired based on
 * server-authoritative started_at + duration_minutes.
 *
 * Duration changes by an admin after session start do NOT affect
 * existing sessions — we use the snapshot stored on the session.
 */
export function isSessionExpired(
  session: { started_at: string; duration_minutes: number | null },
  settings: Settings,
  examNumber: number
): boolean {
  const durationMin =
    session.duration_minutes ??
    getDurationMinutes(settings, examNumber);

  const startMs = new Date(session.started_at).getTime();
  const endMs = startMs + durationMin * 60 * 1000;
  return Date.now() > endMs;
}
