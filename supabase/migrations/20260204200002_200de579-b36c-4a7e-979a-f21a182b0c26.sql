-- Make element_id nullable for site walkthrough use case (no specific element)
ALTER TABLE public.mock_inspection_capture_sessions
ALTER COLUMN element_id DROP NOT NULL;