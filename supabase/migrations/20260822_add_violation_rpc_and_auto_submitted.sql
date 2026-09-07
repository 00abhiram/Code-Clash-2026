-- Migration: Add increment_violation_count RPC and auto_submitted column
-- Phase 5 + Phase 6 correction: Anti-cheat enforcement + ownership verification
-- Status: PREPARED, NOT APPLIED (requires Supabase approval)
--
-- ORDERING: Apply BEFORE the RLS migration (20260819)
-- DEPENDENCY: Must be applied AFTER 20260820 and 20260821

-- 1. Add auto_submitted column to exam_sessions
ALTER TABLE exam_sessions
ADD COLUMN IF NOT EXISTS auto_submitted boolean DEFAULT false;

-- 2. Create atomic increment_violation_count RPC
-- SECURITY DEFINER: runs as function owner, bypasses RLS.
-- SET search_path = public: prevents search_path manipulation attacks.
-- Ownership verification: checks that the session belongs to the caller.
CREATE OR REPLACE FUNCTION increment_violation_count(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- Verify session ownership
  SELECT user_id INTO v_owner
  FROM exam_sessions WHERE id = p_session_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_owner != p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Atomic increment
  UPDATE exam_sessions
  SET violation_count = violation_count + 1
  WHERE id = p_session_id;
END;
$$;

-- 3. Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_violation_count(uuid, uuid) TO authenticated;
