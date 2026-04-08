
CREATE TABLE public.vault_favourites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_id UUID NOT NULL REFERENCES public.shared_drive_files(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'nres_vault',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, file_id)
);

ALTER TABLE public.vault_favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favourites"
ON public.vault_favourites FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own favourites"
ON public.vault_favourites FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favourites"
ON public.vault_favourites FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_vault_favourites_user_scope ON public.vault_favourites(user_id, scope);
CREATE INDEX idx_vault_favourites_file ON public.vault_favourites(file_id);
