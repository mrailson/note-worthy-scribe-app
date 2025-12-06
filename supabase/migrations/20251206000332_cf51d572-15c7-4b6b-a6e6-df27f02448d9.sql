-- Enable RLS on lg_ocr_batches table
ALTER TABLE public.lg_ocr_batches ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view OCR batches for their patients" ON public.lg_ocr_batches;
DROP POLICY IF EXISTS "System admins can view all OCR batches" ON public.lg_ocr_batches;
DROP POLICY IF EXISTS "Users can insert OCR batches for their patients" ON public.lg_ocr_batches;

-- Create policy for users to view OCR batches for their own patients
CREATE POLICY "Users can view OCR batches for their patients"
ON public.lg_ocr_batches
FOR SELECT
USING (
  patient_id IN (
    SELECT lp.id FROM public.lg_patients lp
    WHERE lp.user_id = auth.uid()
  )
);

-- Create policy for system admins to view all OCR batches
CREATE POLICY "System admins can view all OCR batches"
ON public.lg_ocr_batches
FOR SELECT
USING (public.is_system_admin(auth.uid()));

-- Create policy for users to insert OCR batches for their patients
CREATE POLICY "Users can insert OCR batches for their patients"
ON public.lg_ocr_batches
FOR INSERT
WITH CHECK (
  patient_id IN (
    SELECT lp.id FROM public.lg_patients lp
    WHERE lp.user_id = auth.uid()
  ) OR public.is_system_admin(auth.uid())
);

-- Create policy for system admins to manage all OCR batches
CREATE POLICY "System admins can manage OCR batches"
ON public.lg_ocr_batches
FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

-- Allow service role insert (for edge functions)
CREATE POLICY "Service role can insert OCR batches"
ON public.lg_ocr_batches
FOR INSERT
WITH CHECK (true);