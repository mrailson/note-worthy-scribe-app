-- Add inspection_type column to sessions
ALTER TABLE public.mock_inspection_sessions
ADD COLUMN inspection_type TEXT NOT NULL DEFAULT 'long' 
CHECK (inspection_type IN ('short', 'mid', 'long'));

-- Add comment explaining the types
COMMENT ON COLUMN public.mock_inspection_sessions.inspection_type IS 
'Inspection duration type: short (max 3 hours, priority items only), mid (standard items), long (comprehensive)';