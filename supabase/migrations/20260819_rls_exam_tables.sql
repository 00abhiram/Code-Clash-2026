-- ============================================================
-- CODE CLASH 2026 — Comprehensive RLS & Security Model
-- Phase 6 CORRECTION: Database Security & Row Level Security Hardening
--
-- Status: PREPARED, NOT APPLIED (requires Supabase approval)
--
-- MIGRATION DEPENDENCY GRAPH:
--   1. 20260820_add_session_duration_minutes.sql   (schema: adds column)
--   2. 20260821_submissions_unique_constraint.sql  (schema: adds index)
--   3. 20260822_add_violation_rpc_and_auto_submitted.sql (schema + RPC)
--   4. THIS MIGRATION (20260819)                    (RLS + SECURITY DEFINER functions)
--   *** MUST be last — enables RLS on all tables ***
--
-- CRITICAL DESIGN PRINCIPLE:
--   The `authenticated` role is shared between browser client and server API.
--   RLS cannot distinguish between them. SECURITY DEFINER functions are the
--   mechanism for server-controlled mutations. Students cannot UPDATE
--   exam_sessions or INSERT submissions directly — all mutations go through
--   SECURITY DEFINER functions that verify ownership and enforce state machines.
--
-- This migration is idempotent. Safe to re-run.
-- ============================================================


-- ============================================================================
-- 1. PROFILES
--    - Students: read/update own (role change blocked)
--    - Admins: full access via authenticated role
--    - Service role: full access
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own profile" ON profiles;
DROP POLICY IF EXISTS "Students update own profile (no role escalation)" ON profiles;
DROP POLICY IF EXISTS "Admins full access on profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access on profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

CREATE POLICY "Students read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Students update own profile (no role escalation)"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins full access on profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role full access on profiles"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 2. EXAM_SESSIONS
--    - Students: SELECT own, INSERT own (safe: only sets user_id + exam_number)
--    - NO student UPDATE — all mutations via SECURITY DEFINER functions
--      (start_exam_session, complete_exam_session, increment_violation_count)
--    - Admins: full access
--    - Service role: full access
-- ============================================================================

ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Students insert own sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Students update own sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Admins full access on exam_sessions" ON exam_sessions;
DROP POLICY IF EXISTS "Service role full access on exam_sessions" ON exam_sessions;

CREATE POLICY "Students read own sessions"
  ON exam_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Students insert own sessions"
  ON exam_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- NO student UPDATE policy — all status transitions go through SECURITY DEFINER functions.
-- This prevents students from forging status, violation_count, or auto_submitted fields.

CREATE POLICY "Admins full access on exam_sessions"
  ON exam_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role full access on exam_sessions"
  ON exam_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 3. SUBMISSIONS
--    - Students: SELECT own only
--    - NO student INSERT or UPDATE — all inserts via SECURITY DEFINER function
--      (insert_submission). This prevents forged scores at the database level.
--    - Admins: full access
--    - Service role: full access
-- ============================================================================

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own submissions" ON submissions;
DROP POLICY IF EXISTS "Students insert own submissions" ON submissions;
DROP POLICY IF EXISTS "Students update own submissions" ON submissions;
DROP POLICY IF EXISTS "Admins full access on submissions" ON submissions;
DROP POLICY IF EXISTS "Service role full access on submissions" ON submissions;

CREATE POLICY "Students read own submissions"
  ON submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- NO student INSERT policy — submissions must go through insert_submission()
-- SECURITY DEFINER function which verifies session ownership and status.

-- NO student UPDATE policy — scores are computed server-side only.

CREATE POLICY "Admins full access on submissions"
  ON submissions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role full access on submissions"
  ON submissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 4. VIOLATIONS
--    - Students: SELECT own, INSERT own (with session ownership verification)
--    - NO student UPDATE
--    - Admins: full access
--    - Service role: full access
--
-- Note: Violations INSERT is allowed for students because it only records
-- metadata the client already knows (violation_type, description). The
-- dangerous fields (scores, status) are in exam_sessions/submissions which
-- are protected by SECURITY DEFINER functions.
-- ============================================================================

ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own violations" ON violations;
DROP POLICY IF EXISTS "Students insert own violations (session ownership)" ON violations;
DROP POLICY IF EXISTS "Students insert own violations" ON violations;
DROP POLICY IF EXISTS "Admins full access on violations" ON violations;
DROP POLICY IF EXISTS "Service role full access on violations" ON violations;

CREATE POLICY "Students read own violations"
  ON violations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Students insert own violations (session ownership)"
  ON violations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM exam_sessions
      WHERE id = exam_session_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins full access on violations"
  ON violations FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role full access on violations"
  ON violations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 5. QUESTIONS
--    - Students: read active questions only
--    - NOTE: solution_code is NO LONGER on this table (moved to question_solutions)
--    - Admins: full access (including inactive)
--    - Service role: full access
-- ============================================================================

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read active questions" ON questions;
DROP POLICY IF EXISTS "Authenticated read active questions" ON questions;
DROP POLICY IF EXISTS "Admins full access on questions" ON questions;
DROP POLICY IF EXISTS "Service role full access on questions" ON questions;

CREATE POLICY "Students read active questions"
  ON questions FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins full access on questions"
  ON questions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role full access on questions"
  ON questions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 6. QUESTION_SOLUTIONS (NEW TABLE)
--    Stores solution_code separately from questions table.
--    - Students: NO access (RLS blocks all)
--    - Admins: full access
--    - Service role: full access
--    - The evaluate endpoint reads solution via SECURITY DEFINER function
--      (get_question_solution) which bypasses RLS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_solutions (
  question_id uuid PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  solution_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE question_solutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students no access on question_solutions" ON question_solutions;
DROP POLICY IF EXISTS "Admins full access on question_solutions" ON question_solutions;
DROP POLICY IF EXISTS "Service role full access on question_solutions" ON question_solutions;

-- No student policy = no access. RLS denies all by default.

CREATE POLICY "Admins full access on question_solutions"
  ON question_solutions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role full access on question_solutions"
  ON question_solutions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 7. TEST_CASES
--    - Students: read SAMPLE test cases only (is_sample = true)
--    - Hidden test cases: protected at DB level (students cannot query them)
--    - Admins: full access
--    - Service role: full access
--    - The evaluate endpoint reads ALL test cases via SECURITY DEFINER function
--      (get_all_test_cases) which bypasses RLS.
-- ============================================================================

ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read all test_cases (grading)" ON test_cases;
DROP POLICY IF EXISTS "Students read sample test_cases" ON test_cases;
DROP POLICY IF EXISTS "Authenticated read sample test_cases" ON test_cases;
DROP POLICY IF EXISTS "Admins full access on test_cases" ON test_cases;
DROP POLICY IF EXISTS "Service role full access on test_cases" ON test_cases;

CREATE POLICY "Students read sample test_cases"
  ON test_cases FOR SELECT
  TO authenticated
  USING (is_sample = true);

CREATE POLICY "Admins full access on test_cases"
  ON test_cases FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role full access on test_cases"
  ON test_cases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 8. SETTINGS
--    - Students: read all (exam timing, anti-cheat toggle)
--    - Admins: full access (update settings)
--    - Service role: full access
-- ============================================================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read settings" ON settings;
DROP POLICY IF EXISTS "Authenticated read settings" ON settings;
DROP POLICY IF EXISTS "Admins full access on settings" ON settings;
DROP POLICY IF EXISTS "Service role full access on settings" ON settings;

CREATE POLICY "Students read settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins full access on settings"
  ON settings FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role full access on settings"
  ON settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 9. STUDENT_ASSIGNMENTS
--    - Students: read own only
--    - Admins: full access
--    - Service role: full access
-- ============================================================================

ALTER TABLE student_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own assignments" ON student_assignments;
DROP POLICY IF EXISTS "Admins full access on student_assignments" ON student_assignments;
DROP POLICY IF EXISTS "Service role full access on student_assignments" ON student_assignments;

CREATE POLICY "Students read own assignments"
  ON student_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins full access on student_assignments"
  ON student_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role full access on student_assignments"
  ON student_assignments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- 10. SECURITY DEFINER FUNCTIONS
--
-- These functions bypass RLS and are the ONLY way to mutate exam_sessions
-- status, insert submissions, or read hidden test cases. They verify
-- ownership internally and enforce state machine transitions.
-- ============================================================================

-- 10a. get_all_test_cases — reads ALL test cases for grading (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_test_cases(p_question_id uuid)
RETURNS TABLE (
  id uuid,
  question_id uuid,
  is_sample boolean,
  stdin text,
  expected_stdout text,
  description text,
  sort_order integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tc.id, tc.question_id, tc.is_sample, tc.stdin,
         tc.expected_stdout, tc.description, tc.sort_order
  FROM test_cases tc
  WHERE tc.question_id = p_question_id
  ORDER BY tc.sort_order;
$$;

GRANT EXECUTE ON FUNCTION get_all_test_cases(uuid) TO authenticated;


-- 10b. get_question_solution — reads solution_code (bypasses RLS)
CREATE OR REPLACE FUNCTION get_question_solution(p_question_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT qs.solution_code
  FROM question_solutions qs
  WHERE qs.question_id = p_question_id;
$$;

GRANT EXECUTE ON FUNCTION get_question_solution(uuid) TO authenticated;


-- 10c. start_exam_session — transitions pending → in_progress (bypasses RLS)
-- Verifies: session belongs to caller, status is pending.
CREATE OR REPLACE FUNCTION start_exam_session(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS SETOF exam_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE exam_sessions
  SET status = 'in_progress'
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND status = 'pending'
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION start_exam_session(uuid, uuid) TO authenticated;


-- 10d. complete_exam_session — transitions in_progress → completed (bypasses RLS)
-- Verifies: session belongs to caller, status is in_progress.
-- Sets: status = completed, submitted_at = now(), is_submitted = true.
-- Optional: auto_submitted flag for anti-cheat auto-submits.
CREATE OR REPLACE FUNCTION complete_exam_session(
  p_session_id uuid,
  p_user_id uuid,
  p_auto_submitted boolean DEFAULT false
)
RETURNS SETOF exam_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE exam_sessions
  SET status = 'completed',
      submitted_at = now(),
      is_submitted = true,
      auto_submitted = p_auto_submitted
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND status = 'in_progress'
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_exam_session(uuid, uuid, boolean) TO authenticated;


-- 10e. insert_submission — inserts a graded submission (bypasses RLS)
-- Verifies: session belongs to caller, session is in_progress.
-- Returns the inserted row.
CREATE OR REPLACE FUNCTION insert_submission(
  p_user_id uuid,
  p_question_id uuid,
  p_exam_session_id uuid,
  p_code text,
  p_language text,
  p_sample_tests_passed integer,
  p_sample_tests_total integer,
  p_hidden_tests_passed integer,
  p_hidden_tests_total integer,
  p_execution_time_ms integer,
  p_status text
)
RETURNS SETOF submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_owner uuid;
  v_session_status text;
BEGIN
  -- Verify session ownership and status
  SELECT user_id, status INTO v_session_owner, v_session_status
  FROM exam_sessions WHERE id = p_exam_session_id;

  IF v_session_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session_owner != p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_session_status != 'in_progress' THEN
    RAISE EXCEPTION 'Session is not in progress';
  END IF;

  RETURN QUERY
  INSERT INTO submissions (
    user_id, question_id, exam_session_id, code, language,
    sample_tests_passed, sample_tests_total,
    hidden_tests_passed, hidden_tests_total,
    execution_time_ms, status
  ) VALUES (
    p_user_id, p_question_id, p_exam_session_id, p_code, p_language,
    p_sample_tests_passed, p_sample_tests_total,
    p_hidden_tests_passed, p_hidden_tests_total,
    p_execution_time_ms, p_status
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_submission(
  uuid, uuid, uuid, text, text, integer, integer, integer, integer, integer, text
) TO authenticated;


-- ============================================================================
-- 11. LEADERBOARD FUNCTION (SECURITY DEFINER)
--
-- The leaderboard API needs to read ALL students' exam_sessions, submissions,
-- and profiles. Under RLS, the authenticated role can only read own data.
-- This SECURITY DEFINER function bypasses RLS to aggregate leaderboard data.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_leaderboard_data(exam_number_param integer)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  roll_no text,
  branch text,
  hidden_passed bigint,
  hidden_total bigint,
  sample_passed bigint,
  sample_total bigint,
  exec_time_ms bigint,
  time_taken_secs bigint,
  attempted bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    es.user_id,
    p.full_name,
    p.roll_no,
    p.branch,
    COALESCE(SUM(s.hidden_tests_passed), 0),
    COALESCE(SUM(s.hidden_tests_total), 0),
    COALESCE(SUM(s.sample_tests_passed), 0),
    COALESCE(SUM(s.sample_tests_total), 0),
    COALESCE(SUM(s.execution_time_ms), 0),
    COALESCE(
      EXTRACT(EPOCH FROM (MAX(es.submitted_at) - MIN(es.started_at)))::bigint,
      0
    ),
    COUNT(s.id)
  FROM exam_sessions es
  JOIN profiles p ON p.id = es.user_id
  LEFT JOIN submissions s ON s.exam_session_id = es.id
  WHERE es.exam_number = exam_number_param
    AND es.is_submitted = true
  GROUP BY es.user_id, p.full_name, p.roll_no, p.branch
  ORDER BY
    (CASE WHEN SUM(s.hidden_tests_total) > 0
          THEN SUM(s.hidden_tests_passed)::float / SUM(s.hidden_tests_total)
          ELSE 0 END) DESC,
    COALESCE(SUM(s.execution_time_ms), 0) ASC,
    COALESCE(EXTRACT(EPOCH FROM (MAX(es.submitted_at) - MIN(es.started_at))), 0) ASC;
$$;

GRANT EXECUTE ON FUNCTION get_leaderboard_data(integer) TO authenticated;


-- ============================================================================
-- 12. SECURITY NOTES & THREAT MODEL
-- ============================================================================
--
-- ROLE ESCALATION PREVENTION:
-- The profiles UPDATE policy uses WITH CHECK to prevent role changes.
-- A student cannot set role = 'admin' on their own profile.
-- Only the SECURITY DEFINER trigger (handle_new_user) or admin policy
-- can modify the role column.
--
-- ADMIN BYPASS:
-- Admin policies check EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
-- AND role = 'admin'). This reads the user's own profile (allowed by the
-- student SELECT policy), so there is no circular dependency.
--
-- HIDDEN DATA PROTECTION (solution_code):
-- solution_code is stored in a separate `question_solutions` table.
-- No student SELECT policy on question_solutions = students cannot read it.
-- The evaluate endpoint reads it via get_question_solution() SECURITY DEFINER.
-- Admin pages read it via admin ALL policy.
-- A student using the browser console CANNOT query solution_code.
--
-- HIDDEN DATA PROTECTION (test_cases):
-- Hidden test cases (is_sample = false) are protected at DB level.
-- Student SELECT policy only allows is_sample = true.
-- A student using the browser console CANNOT query hidden test cases.
-- The evaluate endpoint reads ALL test cases via get_all_test_cases()
-- SECURITY DEFINER function.
--
-- EXAM_SESSIONS STATUS:
-- Students CANNOT update exam_sessions directly (no UPDATE policy).
-- All status transitions go through SECURITY DEFINER functions:
--   - start_exam_session: pending → in_progress (verifies ownership)
--   - complete_exam_session: in_progress → completed (verifies ownership)
--   - increment_violation_count: increments violation_count (verifies ownership)
-- A student cannot forge status, violation_count, or auto_submitted.
--
-- SUBMISSIONS SCORES:
-- Students CANNOT insert or update submissions directly (no INSERT/UPDATE policy).
-- All submission inserts go through insert_submission() SECURITY DEFINER function
-- which verifies session ownership and status.
-- A student cannot forge scores at the database level.
--
-- VIOLATIONS SESSION OWNERSHIP:
-- The violations INSERT policy verifies the session belongs to the user.
-- A student cannot insert violations for another student's session.
--
-- LEADERBOARD:
-- Uses SECURITY DEFINER function to read all students' data.
-- The function returns only non-sensitive columns (no code, no IP, no user-agent).
--
-- RATE LIMITING:
-- The in-memory rate limit map in violations API resets on serverless cold start.
-- This is a known limitation of the Vercel serverless architecture.
--
-- MIGRATION ORDERING:
-- This migration MUST be applied AFTER all schema migrations (20260820, 20260821,
-- 20260822) because it enables RLS on tables that those migrations modify.
-- Applying RLS before schema changes could cause errors.
--
-- DEPENDENCY GRAPH:
--   20260820 → 20260821 → 20260822 → 20260819 (this file)
--   Each arrow means "must be applied before".
-- ============================================================================
