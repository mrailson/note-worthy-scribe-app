-- Drop overly permissive policies on lg_ocr_batches
DROP POLICY IF EXISTS "Service role can insert OCR batches" ON public.lg_ocr_batches;
DROP POLICY IF EXISTS "Service role full access" ON public.lg_ocr_batches;
DROP POLICY IF EXISTS "System admins can manage OCR batches" ON public.lg_ocr_batches;
DROP POLICY IF EXISTS "System admins can view all OCR batches" ON public.lg_ocr_batches;
DROP POLICY IF EXISTS "Users can insert OCR batches for their patients" ON public.lg_ocr_batches;
DROP POLICY IF EXISTS "Users can view OCR batches for their patients" ON public.lg_ocr_batches;

-- Recreate policies with proper authentication requirements
-- Users can only access OCR batches for patients they own
CREATE POLICY "Users can view OCR batches for their patients"
ON public.lg_ocr_batches
FOR SELECT
TO authenticated
USING (
  patient_id IN (
    SELECT lp.id FROM public.lg_patients lp WHERE lp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert OCR batches for their patients"
ON public.lg_ocr_batches
FOR INSERT
TO authenticated
WITH CHECK (
  patient_id IN (
    SELECT lp.id FROM public.lg_patients lp WHERE lp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update OCR batches for their patients"
ON public.lg_ocr_batches
FOR UPDATE
TO authenticated
USING (
  patient_id IN (
    SELECT lp.id FROM public.lg_patients lp WHERE lp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete OCR batches for their patients"
ON public.lg_ocr_batches
FOR DELETE
TO authenticated
USING (
  patient_id IN (
    SELECT lp.id FROM public.lg_patients lp WHERE lp.user_id = auth.uid()
  )
);

-- System admins have full access for support
CREATE POLICY "System admins can manage all OCR batches"
ON public.lg_ocr_batches
FOR ALL
TO authenticated
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));