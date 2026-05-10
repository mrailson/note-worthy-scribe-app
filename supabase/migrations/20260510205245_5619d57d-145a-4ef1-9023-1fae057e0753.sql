
CREATE TABLE public.complaint_letter_lab_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES public.complaint_letter_lab_drafts(id) ON DELETE CASCADE,
  version_number integer,
  format text NOT NULL CHECK (format IN ('docx','pdf','email','print','plaintext')),
  exported_by uuid,
  exported_at timestamptz NOT NULL DEFAULT now(),
  recipient_email text,
  file_size_bytes integer,
  notes text
);

CREATE INDEX idx_clle_draft ON public.complaint_letter_lab_exports(draft_id, exported_at DESC);

ALTER TABLE public.complaint_letter_lab_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View lab exports for accessible drafts"
  ON public.complaint_letter_lab_exports FOR SELECT
  USING (
    is_system_admin(auth.uid())
    OR has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'complaints_manager'::app_role)
    OR draft_id IN (
      SELECT d.id FROM public.complaint_letter_lab_drafts d
      JOIN public.complaints c ON c.id = d.complaint_id
      WHERE c.created_by = auth.uid()
         OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
  );

CREATE POLICY "Insert lab exports for accessible drafts"
  ON public.complaint_letter_lab_exports FOR INSERT
  WITH CHECK (
    is_system_admin(auth.uid())
    OR has_role(auth.uid(), 'practice_manager'::app_role)
    OR has_role(auth.uid(), 'complaints_manager'::app_role)
    OR draft_id IN (
      SELECT d.id FROM public.complaint_letter_lab_drafts d
      JOIN public.complaints c ON c.id = d.complaint_id
      WHERE c.created_by = auth.uid()
         OR c.practice_id = ANY (get_user_practice_ids(auth.uid()))
    )
  );
