-- Add practice_id column to complaint_team_members so each team member is scoped to a single practice
ALTER TABLE public.complaint_team_members
ADD COLUMN practice_id uuid REFERENCES public.practice_details(id) ON DELETE CASCADE;

-- Index for practice lookups
CREATE INDEX idx_complaint_team_members_practice_id ON public.complaint_team_members(practice_id);

-- Drop existing policy
DROP POLICY IF EXISTS "complaint_team_members_all_authenticated" ON public.complaint_team_members;

-- Allow SELECT for anyone in the same practice OR the creator
CREATE POLICY "complaint_team_members_select"
ON public.complaint_team_members
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid())
  OR (practice_id = ANY (public.get_user_practice_ids(auth.uid())))
);

-- Allow INSERT for anyone whose practice list includes target practice (or owner)
CREATE POLICY "complaint_team_members_insert"
ON public.complaint_team_members
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid())
  OR (practice_id = ANY (public.get_user_practice_ids(auth.uid())))
);

-- Allow UPDATE for anyone in the same practice or owner
CREATE POLICY "complaint_team_members_update"
ON public.complaint_team_members
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid())
  OR (practice_id = ANY (public.get_user_practice_ids(auth.uid())))
);

-- Allow DELETE for anyone in the same practice or owner
CREATE POLICY "complaint_team_members_delete"
ON public.complaint_team_members
FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid())
  OR (practice_id = ANY (public.get_user_practice_ids(auth.uid())))
);