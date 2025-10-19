-- Add standard_minutes_variations column to meetings table for alternative formatting styles
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS standard_minutes_variations JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.meetings.standard_minutes_variations IS 'Stores alternative formatting variations of the standard minutes (no_actions, black_white, concise, detailed, executive_brief)';