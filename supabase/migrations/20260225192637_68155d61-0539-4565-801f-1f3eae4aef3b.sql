
-- Drop with CASCADE and recreate
DROP FUNCTION IF EXISTS public.is_nres_admin(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.is_nres_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
      AND lower(email) IN (
        'm.green28@nhs.net',
        'mark.gray1@nhs.net',
        'amanda.taylor75@nhs.net',
        'carolyn.abbisogni@nhs.net',
        'malcolm.railson@nhs.net'
      )
  )
$$;

-- Re-create the dependent policies that were dropped by CASCADE
CREATE POLICY "NRES admins can insert estates config"
  ON public.nres_estates_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_nres_admin(auth.uid()));

CREATE POLICY "NRES admins can update estates config"
  ON public.nres_estates_config FOR UPDATE
  TO authenticated
  USING (public.is_nres_admin(auth.uid()))
  WITH CHECK (public.is_nres_admin(auth.uid()));

CREATE POLICY "NRES admins can insert recruitment config"
  ON public.nres_recruitment_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_nres_admin(auth.uid()));

CREATE POLICY "NRES admins can update recruitment config"
  ON public.nres_recruitment_config FOR UPDATE
  TO authenticated
  USING (public.is_nres_admin(auth.uid()))
  WITH CHECK (public.is_nres_admin(auth.uid()));

CREATE POLICY "NRES admins can delete recruitment config"
  ON public.nres_recruitment_config FOR DELETE
  TO authenticated
  USING (public.is_nres_admin(auth.uid()));

-- Create the access control table
CREATE TABLE public.nres_buyback_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_key TEXT NOT NULL,
  access_role TEXT NOT NULL CHECK (access_role IN ('submit', 'view', 'approver')),
  granted_by TEXT,
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, practice_key, access_role)
);

ALTER TABLE public.nres_buyback_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own buyback access"
  ON public.nres_buyback_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all buyback access"
  ON public.nres_buyback_access FOR SELECT
  TO authenticated
  USING (public.is_nres_admin(auth.uid()));

CREATE POLICY "Admins can insert buyback access"
  ON public.nres_buyback_access FOR INSERT
  TO authenticated
  WITH CHECK (public.is_nres_admin(auth.uid()));

CREATE POLICY "Admins can delete buyback access"
  ON public.nres_buyback_access FOR DELETE
  TO authenticated
  USING (public.is_nres_admin(auth.uid()));
