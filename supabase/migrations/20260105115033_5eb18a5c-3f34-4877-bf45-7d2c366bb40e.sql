-- Add audit tracking columns to nres_board_actions
ALTER TABLE public.nres_board_actions ADD COLUMN IF NOT EXISTS created_by_email text;
ALTER TABLE public.nres_board_actions ADD COLUMN IF NOT EXISTS updated_by_email text;
ALTER TABLE public.nres_board_actions ADD COLUMN IF NOT EXISTS original_status text;
ALTER TABLE public.nres_board_actions ADD COLUMN IF NOT EXISTS original_status_date timestamptz;
ALTER TABLE public.nres_board_actions ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;