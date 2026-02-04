-- Create table for mock inspection capture sessions
CREATE TABLE public.mock_inspection_capture_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL,
  short_code TEXT DEFAULT NULL,
  element_id UUID NOT NULL REFERENCES public.mock_inspection_elements(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '60 minutes'),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for captured images
CREATE TABLE public.mock_inspection_captured_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.mock_inspection_capture_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Generate short code trigger function
CREATE OR REPLACE FUNCTION generate_mock_inspection_short_code()
RETURNS TRIGGER AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  attempts INTEGER := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.mock_inspection_capture_sessions 
      WHERE short_code = result AND is_active = true
    );
    
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique short code';
    END IF;
  END LOOP;
  
  NEW.short_code := result;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-generate short code
CREATE TRIGGER set_mock_inspection_short_code
  BEFORE INSERT ON public.mock_inspection_capture_sessions
  FOR EACH ROW
  EXECUTE FUNCTION generate_mock_inspection_short_code();

-- Enable RLS
ALTER TABLE public.mock_inspection_capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_inspection_captured_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for sessions
CREATE POLICY "Users can view their own sessions"
  ON public.mock_inspection_capture_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON public.mock_inspection_capture_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.mock_inspection_capture_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Public SELECT policy for mobile validation (needed for unauthenticated mobile access)
CREATE POLICY "Anyone can validate session by short code"
  ON public.mock_inspection_capture_sessions FOR SELECT
  USING (true);

-- RLS policies for captured images
CREATE POLICY "Users can view images from their sessions"
  ON public.mock_inspection_captured_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mock_inspection_capture_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Allow insert via service role"
  ON public.mock_inspection_captured_images FOR INSERT
  WITH CHECK (true);

-- Create storage bucket for inspection captures if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-captures', 'inspection-captures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for inspection captures
CREATE POLICY "Anyone can view inspection captures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inspection-captures');

CREATE POLICY "Service role can upload inspection captures"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'inspection-captures');