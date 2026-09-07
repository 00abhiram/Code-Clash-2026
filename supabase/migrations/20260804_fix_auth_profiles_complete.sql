-- ============================================================
-- CODE CLASH 2026 — Auth & Profiles Fix
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- 1. Add 'year' column if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS year text DEFAULT '1';

-- 2. Drop old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Recreate handle_new_user to handle BOTH Email and Google signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  meta jsonb;
  v_full_name text;
  v_email text;
  v_roll_no text;
  v_branch text;
  v_year text;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  -- Extract email
  v_email := COALESCE(NEW.email, '');

  -- Extract full name (Google uses 'full_name' or 'name')
  v_full_name := COALESCE(
    meta ->> 'full_name',
    meta ->> 'name',
    meta ->> 'preferred_name',
    split_part(v_email, '@', 1)
  );

  -- If roll_no exists in metadata → Email signup path
  -- If not → Google signup path (use 'EMPTY')
  v_roll_no := COALESCE(meta ->> 'roll_no', 'EMPTY');
  v_branch  := COALESCE(meta ->> 'branch',  'EMPTY');
  v_year    := COALESCE(meta ->> 'year',    '1');

  INSERT INTO public.profiles (id, full_name, email, roll_no, branch, year, role, is_active)
  VALUES (
    NEW.id,
    v_full_name,
    v_email,
    v_roll_no,
    v_branch,
    v_year,
    'student',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email     = EXCLUDED.email,
    roll_no   = CASE
                  WHEN profiles.roll_no = 'EMPTY' AND EXCLUDED.roll_no != 'EMPTY'
                  THEN EXCLUDED.roll_no
                  ELSE profiles.roll_no
                END,
    branch    = CASE
                  WHEN profiles.branch = 'EMPTY' AND EXCLUDED.branch != 'EMPTY'
                  THEN EXCLUDED.branch
                  ELSE profiles.branch
                END,
    year      = CASE
                  WHEN profiles.year = '1' AND EXCLUDED.year != '1'
                  THEN EXCLUDED.year
                  ELSE profiles.year
                END,
    updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 4. Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 6. Drop old policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON profiles;

-- 7. Create RLS policies — authenticated users can read/update their own row
CREATE POLICY "Authenticated users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Authenticated users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 8. Allow service_role (used by admin routes) full access
DROP POLICY IF EXISTS "Service role full access" ON profiles;
CREATE POLICY "Service role full access"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
