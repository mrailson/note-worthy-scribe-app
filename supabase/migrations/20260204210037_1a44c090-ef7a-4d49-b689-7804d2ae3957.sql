-- Drop the foreign key constraint that's causing the error
-- The element_id can reference either mock_inspection_elements OR mock_inspection_fundamentals
ALTER TABLE public.mock_inspection_capture_sessions 
DROP CONSTRAINT IF EXISTS mock_inspection_capture_sessions_element_id_fkey;

-- Add a comment to clarify the column can reference multiple tables
COMMENT ON COLUMN public.mock_inspection_capture_sessions.element_id IS 'Can reference either mock_inspection_elements.id or mock_inspection_fundamentals.id';