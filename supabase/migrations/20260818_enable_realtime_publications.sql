-- ============================================================
-- CODE CLASH 2026 — Realtime Publications
-- Enables Supabase Realtime for the admin dashboard live feeds
-- (profiles, exam_sessions, submissions, violations).
--
-- This is the SQL equivalent of toggling "Realtime" on each table
-- in the Supabase Dashboard > Database > Replication.
-- Idempotent: safe to run multiple times in the SQL Editor.
--
-- Run: Supabase SQL Editor (postgres role)
-- Verify afterwards:
--   SELECT schemaname, tablename
--   FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
--   ORDER BY tablename;
-- ============================================================

-- 1. Ensure the Realtime publication exists (older projects may lack it)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- 2. Add each table to the publication (idempotent per table)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles', 'exam_sessions', 'submissions', 'violations']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      -- Drop first so re-running this migration never errors
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.%I', tbl);
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      -- Replica identity FULL: broadcasts the complete row on UPDATE,
      -- required for session status changes / leaderboard recompute
      -- to arrive intact on the admin dashboard
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', tbl);
    END IF;
  END LOOP;
END $$;
