
-- Add practice_id to nres_hours_entries and nres_expenses for practice-wide visibility
ALTER TABLE public.nres_hours_entries 
ADD COLUMN practice_id uuid REFERENCES public.gp_practices(id);

ALTER TABLE public.nres_expenses 
ADD COLUMN practice_id uuid REFERENCES public.gp_practices(id);

-- Backfill practice_id from user_roles for existing entries
UPDATE public.nres_hours_entries e
SET practice_id = (
  SELECT ur.practice_id FROM public.user_roles ur 
  WHERE ur.user_id = e.user_id 
  LIMIT 1
)
WHERE e.practice_id IS NULL;

UPDATE public.nres_expenses ex
SET practice_id = (
  SELECT ur.practice_id FROM public.user_roles ur 
  WHERE ur.user_id = ex.user_id 
  LIMIT 1
)
WHERE ex.practice_id IS NULL;

-- RLS: Allow users in the same practice to view hours entries
CREATE POLICY "Practice members can view practice hours entries"
ON public.nres_hours_entries FOR SELECT
TO authenticated
USING (
  practice_id IN (
    SELECT ur.practice_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
);

-- RLS: Allow users in the same practice to view expenses
CREATE POLICY "Practice members can view practice expenses"
ON public.nres_expenses FOR SELECT
TO authenticated
USING (
  practice_id IN (
    SELECT ur.practice_id FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
);

-- Add comments
COMMENT ON COLUMN public.nres_hours_entries.practice_id IS 'The practice this entry belongs to, enabling practice-wide visibility';
COMMENT ON COLUMN public.nres_expenses.practice_id IS 'The practice this expense belongs to, enabling practice-wide visibility';
