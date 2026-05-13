-- Relax RLS on complaint_indemnity_considerations so any user with access to the
-- parent complaint can record / update the indemnity consideration (e.g. ticking
-- "MDU contacted"). Previously only the complaint creator could insert and only
-- the original setter could update, causing silent failures for colleagues.

DROP POLICY IF EXISTS "Users can insert indemnity considerations" ON public.complaint_indemnity_considerations;
DROP POLICY IF EXISTS "Users can update indemnity considerations" ON public.complaint_indemnity_considerations;
DROP POLICY IF EXISTS "Users can view indemnity considerations for their complaints" ON public.complaint_indemnity_considerations;

CREATE POLICY "View indemnity considerations for accessible complaints"
ON public.complaint_indemnity_considerations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_indemnity_considerations.complaint_id
  )
);

CREATE POLICY "Insert indemnity considerations for accessible complaints"
ON public.complaint_indemnity_considerations
FOR INSERT
TO authenticated
WITH CHECK (
  selected_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_indemnity_considerations.complaint_id
  )
);

CREATE POLICY "Update indemnity considerations when not locked"
ON public.complaint_indemnity_considerations
FOR UPDATE
TO authenticated
USING (
  is_locked = false
  AND EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_indemnity_considerations.complaint_id
  )
)
WITH CHECK (
  selected_by = auth.uid()
  AND is_locked = false
);