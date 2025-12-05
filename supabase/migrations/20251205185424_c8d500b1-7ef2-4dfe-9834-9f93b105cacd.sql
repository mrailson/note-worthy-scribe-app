-- Create plaud_integrations table for storing user Plaud webhook configuration
CREATE TABLE public.plaud_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  webhook_secret TEXT,
  auto_generate_notes BOOLEAN NOT NULL DEFAULT true,
  default_meeting_type TEXT DEFAULT 'imported',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.plaud_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only manage their own integration
CREATE POLICY "Users can view their own Plaud integration"
  ON public.plaud_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Plaud integration"
  ON public.plaud_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Plaud integration"
  ON public.plaud_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Plaud integration"
  ON public.plaud_integrations FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_plaud_integrations_updated_at
  BEFORE UPDATE ON public.plaud_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add import_source column to meetings table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'meetings' 
    AND column_name = 'import_source') THEN
    ALTER TABLE public.meetings ADD COLUMN import_source TEXT;
  END IF;
END $$;