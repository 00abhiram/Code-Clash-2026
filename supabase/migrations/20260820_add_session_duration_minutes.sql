-- ============================================================
-- CODE CLASH 2026 — Add duration_minutes to exam_sessions
-- Snapshots the configured duration at session creation time.
-- Admin duration changes after session start do NOT affect
-- existing sessions.
-- ============================================================

ALTER TABLE exam_sessions
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

COMMENT ON COLUMN exam_sessions.duration_minutes IS
  'Duration in minutes, snapshot from settings at session creation. Null = use settings default.';
