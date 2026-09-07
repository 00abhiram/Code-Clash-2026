-- ============================================================
-- CODE CLASH 2026 — Unique constraint on submissions
-- Prevents duplicate graded submissions per question per session.
--
-- This is a DEFENSIVE constraint. The application layer already
-- performs idempotent upserts, but this ensures correctness at
-- the database level even if application logic has bugs.
--
-- BEFORE APPLYING:
--   - Check for existing duplicates:
--     SELECT question_id, exam_session_id, user_id, COUNT(*)
--     FROM submissions
--     GROUP BY question_id, exam_session_id, user_id
--     HAVING COUNT(*) > 1;
--
--   - If duplicates exist, deduplicate first (keep latest by submitted_at).
--
-- DO NOT APPLY to live Supabase without explicit approval.
-- ============================================================

-- Partial unique index: one submission row per (question, session, user)
-- WHERE status is not 'pending' (only graded submissions are constrained)
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique_graded
  ON submissions (question_id, exam_session_id, user_id)
  WHERE status IN ('passed', 'failed');

-- Comment for documentation
COMMENT ON INDEX idx_submissions_unique_graded IS
  'Ensures at most one graded submission per question per exam session per user. Defensive constraint — application layer already performs idempotent upserts.';
