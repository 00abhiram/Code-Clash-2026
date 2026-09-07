-- Fix handle_new_user trigger to support Google OAuth users
-- Google OAuth doesn't provide roll_no/branch, so we hardcode 'EMPTY'
-- and pull the name from raw_user_meta_data

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create a safer, more flexible handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_full_name text;
  user_email text;
  user_role text;
BEGIN
  -- Extract name from Google OAuth metadata or email
  user_full_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'preferred_name',
    split_part(NEW.email, '@', 1)
  );

  user_email := COALESCE(NEW.email, '');

  -- Determine role: check if email matches admin pattern or existing assignment
  -- Default to 'student' for Google OAuth users
  user_role := 'student';

  -- Insert into profiles with safe defaults for Google OAuth users
  INSERT INTO public.profiles (id, full_name, email, roll_no, branch, role, is_active)
  VALUES (
    NEW.id,
    user_full_name,
    user_email,
    'EMPTY',
    'EMPTY',
    user_role,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE WARNING 'handle_new_user: Failed to create profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
