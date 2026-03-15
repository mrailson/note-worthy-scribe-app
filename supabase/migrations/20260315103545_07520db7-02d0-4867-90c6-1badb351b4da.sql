
-- user_logos table
CREATE TABLE public.user_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('practice','pcn','neighbourhood','organisation')),
  image_url text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own logos" ON public.user_logos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logos" ON public.user_logos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logos" ON public.user_logos
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own logos" ON public.user_logos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- user_document_settings table
CREATE TABLE public.user_document_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  logo_on boolean DEFAULT true,
  footer_on boolean DEFAULT true,
  logo_position text DEFAULT 'centre',
  exec_summary_on boolean DEFAULT true,
  action_items_on boolean DEFAULT true,
  open_items_on boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_document_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own doc settings" ON public.user_document_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own doc settings" ON public.user_document_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own doc settings" ON public.user_document_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
