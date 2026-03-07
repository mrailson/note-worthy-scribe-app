-- 1. Create access level enum (skip if exists)
DO $$ BEGIN
  CREATE TYPE public.policy_access_level AS ENUM ('none', 'read', 'edit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create the policy_library_access table
CREATE TABLE IF NOT EXISTS public.policy_library_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id uuid NOT NULL REFERENCES practice_details(id) ON DELETE CASCADE,
  access_level policy_access_level NOT NULL DEFAULT 'none',
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, practice_id)
);

ALTER TABLE public.policy_library_access ENABLE ROW LEVEL SECURITY;

-- 3. Security definer function
CREATE OR REPLACE FUNCTION public.get_policy_library_access(_user_id uuid, _practice_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT access_level::text
  FROM public.policy_library_access
  WHERE user_id = _user_id
    AND practice_id = _practice_id
  LIMIT 1;
$$;

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_policy_library_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS policy_library_access_updated_at ON public.policy_library_access;
CREATE TRIGGER policy_library_access_updated_at
  BEFORE UPDATE ON public.policy_library_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_policy_library_access_updated_at();