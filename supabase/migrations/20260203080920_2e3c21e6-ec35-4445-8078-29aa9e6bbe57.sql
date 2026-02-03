-- Create complaint capture sessions table
CREATE TABLE public.complaint_capture_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL,
  short_code TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '60 minutes'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create complaint captured images table
CREATE TABLE public.complaint_captured_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.complaint_capture_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  ocr_text TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_captured_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for complaint_capture_sessions
CREATE POLICY "Users can view their own capture sessions"
  ON public.complaint_capture_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own capture sessions"
  ON public.complaint_capture_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own capture sessions"
  ON public.complaint_capture_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for complaint_captured_images (based on session ownership)
CREATE POLICY "Users can view images from their sessions"
  ON public.complaint_captured_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.complaint_capture_sessions
      WHERE id = complaint_captured_images.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert via edge function"
  ON public.complaint_captured_images
  FOR INSERT
  WITH CHECK (true);

-- Function to generate short code
CREATE OR REPLACE FUNCTION public.generate_complaint_capture_short_code()
RETURNS TRIGGER AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  NEW.short_code := result;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-generate short code
CREATE TRIGGER set_complaint_capture_short_code
  BEFORE INSERT ON public.complaint_capture_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_complaint_capture_short_code();

-- Create indexes
CREATE INDEX idx_complaint_capture_sessions_short_code ON public.complaint_capture_sessions(short_code);
CREATE INDEX idx_complaint_capture_sessions_token ON public.complaint_capture_sessions(session_token);
CREATE INDEX idx_complaint_captured_images_session ON public.complaint_captured_images(session_id);

-- Create storage bucket for complaint captures
INSERT INTO storage.buckets (id, name, public) VALUES ('complaint-captures', 'complaint-captures', true);

-- Storage policies
CREATE POLICY "Anyone can view complaint capture images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'complaint-captures');

CREATE POLICY "Authenticated users can upload complaint captures"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'complaint-captures');