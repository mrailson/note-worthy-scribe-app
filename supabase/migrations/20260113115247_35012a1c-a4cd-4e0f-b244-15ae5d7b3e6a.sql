-- Fix attendees INSERT RLS so users can always create their own attendee rows.
-- Root cause: existing policy requires practice_id to be in user_roles, which fails when practice_id is NULL.

DROP POLICY IF EXISTS "Users can insert attendees for their practices" ON public.attendees;

CREATE POLICY "attendees_insert_own_or_practice"
ON public.attendees
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    practice_id IS NULL
    OR practice_id = ANY (public.get_user_practice_ids(auth.uid()))
  )
);

-- (Optional hardening) ensure scope is valid already via CHECK constraint, nothing else changed.