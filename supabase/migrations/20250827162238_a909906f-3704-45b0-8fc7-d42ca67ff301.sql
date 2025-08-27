-- Add Super Save (protection) and flagging fields to ai_4_pm_searches table
ALTER TABLE public.ai_4_pm_searches 
ADD COLUMN is_protected BOOLEAN DEFAULT FALSE,
ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE;

-- Add indexes for better performance on filtering
CREATE INDEX idx_ai_4_pm_searches_is_protected ON public.ai_4_pm_searches(is_protected);
CREATE INDEX idx_ai_4_pm_searches_is_flagged ON public.ai_4_pm_searches(is_flagged);

-- Add composite index for efficient sorting (protected first, then flagged, then by date)
CREATE INDEX idx_ai_4_pm_searches_priority_sort ON public.ai_4_pm_searches(is_protected DESC, is_flagged DESC, created_at DESC);