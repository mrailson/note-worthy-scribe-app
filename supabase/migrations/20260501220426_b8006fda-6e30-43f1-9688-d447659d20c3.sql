CREATE TABLE public.meeting_metadata_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  edited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_metadata_audit_meeting_id
  ON public.meeting_metadata_audit(meeting_id);
CREATE INDEX idx_meeting_metadata_audit_edited_at
  ON public.meeting_metadata_audit(edited_at DESC);

ALTER TABLE public.meeting_metadata_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view audit for their meetings"
  ON public.meeting_metadata_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_metadata_audit.meeting_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can insert audit for their meetings"
  ON public.meeting_metadata_audit
  FOR INSERT
  WITH CHECK (
    edited_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_metadata_audit.meeting_id
        AND m.user_id = auth.uid()
    )
  );