-- ============================================================================
-- Phase 8: Leaderboard fix + Student assignment enforcement
--
-- DEPENDENCIES: Requires 20260819, 20260820, 20260821, 20260822
-- ============================================================================


-- ============================================================================
-- 1. LEADERBOARD: is_submitted → status = 'completed'
--
-- The previous filter used is_submitted = true. While functionally equivalent
-- (complete_exam_session sets both), status = 'completed' is the authoritative
-- state and semantically clearer.
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
    AND es.status = 'completed'
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
-- 2. START_EXAM_SESSION: Add student assignment enforcement
--
-- Before transitioning pending → in_progress, verify the student is assigned
-- to this exam via the student_assignments table. If no assignments exist for
-- this exam (exam not yet restricted), allow all students.
-- ============================================================================

CREATE OR REPLACE FUNCTION start_exam_session(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS SETOF exam_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_number integer;
  v_assignment_count bigint;
BEGIN
  -- Get the exam number for this session
  SELECT es.exam_number INTO v_exam_number
  FROM exam_sessions es
  WHERE es.id = p_session_id
    AND es.user_id = p_user_id
    AND es.status = 'pending';

  IF v_exam_number IS NULL THEN
    RAISE EXCEPTION 'Session not found or not in pending status';
  END IF;

  -- Check if assignments exist for this exam
  SELECT count(*) INTO v_assignment_count
  FROM student_assignments sa
  WHERE sa.exam_number = v_exam_number;

  -- If assignments exist, verify this student is assigned
  IF v_assignment_count > 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM student_assignments sa
      WHERE sa.user_id = p_user_id
        AND sa.exam_number = v_exam_number
    ) THEN
      RAISE EXCEPTION 'You are not assigned to this exam';
    END IF;
  END IF;

  -- Transition pending → in_progress
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
