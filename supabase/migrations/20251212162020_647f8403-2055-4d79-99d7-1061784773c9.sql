-- Add source_page_count to track original PDF pages before any processing/removal
ALTER TABLE public.lg_patients 
ADD COLUMN IF NOT EXISTS source_page_count integer DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.lg_patients.source_page_count IS 'Original page count from source PDF before blank/patch page removal';