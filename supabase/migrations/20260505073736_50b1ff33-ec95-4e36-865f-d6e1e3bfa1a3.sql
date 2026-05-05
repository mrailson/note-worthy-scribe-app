
CREATE TABLE public.nres_time_entry_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id UUID NOT NULL REFERENCES public.nres_time_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nres_time_entry_attachments_entry ON public.nres_time_entry_attachments(entry_id);
CREATE INDEX idx_nres_time_entry_attachments_user ON public.nres_time_entry_attachments(user_id);

ALTER TABLE public.nres_time_entry_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own time entry attachments"
  ON public.nres_time_entry_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own time entry attachments"
  ON public.nres_time_entry_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own time entry attachments"
  ON public.nres_time_entry_attachments FOR DELETE
  USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('nres-time-tracker-attachments', 'nres-time-tracker-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users view own time tracker attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'nres-time-tracker-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users upload own time tracker attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'nres-time-tracker-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own time tracker attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'nres-time-tracker-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
