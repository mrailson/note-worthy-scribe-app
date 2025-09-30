-- Add is_online column to practice_fridges table
ALTER TABLE public.practice_fridges 
ADD COLUMN is_online boolean NOT NULL DEFAULT true;

-- Create table to track fridge status changes
CREATE TABLE public.fridge_status_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fridge_id uuid NOT NULL REFERENCES public.practice_fridges(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  previous_status boolean NOT NULL,
  new_status boolean NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text
);

-- Enable RLS on fridge_status_changes
ALTER TABLE public.fridge_status_changes ENABLE ROW LEVEL SECURITY;

-- Allow users with fridge access to view status changes
CREATE POLICY "Users can view fridge status changes"
ON public.fridge_status_changes
FOR SELECT
USING (
  fridge_id IN (
    SELECT pf.id 
    FROM public.practice_fridges pf
    WHERE pf.practice_id = ANY (get_user_practice_ids(auth.uid()))
  )
);

-- Allow users with fridge access to insert status changes
CREATE POLICY "Users can insert fridge status changes"
ON public.fridge_status_changes
FOR INSERT
WITH CHECK (
  auth.uid() = changed_by 
  AND fridge_id IN (
    SELECT pf.id 
    FROM public.practice_fridges pf
    WHERE pf.practice_id = ANY (get_user_practice_ids(auth.uid()))
  )
);

-- Create index for better query performance
CREATE INDEX idx_fridge_status_changes_fridge_id ON public.fridge_status_changes(fridge_id);
CREATE INDEX idx_fridge_status_changes_changed_at ON public.fridge_status_changes(changed_at DESC);