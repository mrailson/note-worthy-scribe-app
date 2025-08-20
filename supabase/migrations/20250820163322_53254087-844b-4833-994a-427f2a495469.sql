-- Phase 1: Database Schema Enhancements

-- First, let's add practice_id to the attendees table and make it practice-scoped
ALTER TABLE public.attendees 
ADD COLUMN practice_id UUID REFERENCES public.practice_details(id);

-- Add index for performance
CREATE INDEX idx_attendees_practice_id ON public.attendees(practice_id);

-- Create meeting attendee templates table
CREATE TABLE public.meeting_attendee_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID NOT NULL,
  template_name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes and constraints
CREATE INDEX idx_meeting_attendee_templates_practice_id ON public.meeting_attendee_templates(practice_id);
CREATE UNIQUE INDEX idx_meeting_attendee_templates_practice_default 
  ON public.meeting_attendee_templates(practice_id) 
  WHERE is_default = true;

-- Create template attendees linking table
CREATE TABLE public.template_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.meeting_attendee_templates(id) ON DELETE CASCADE,
  attendee_id UUID NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_template_attendees_template_id ON public.template_attendees(template_id);
CREATE INDEX idx_template_attendees_attendee_id ON public.template_attendees(attendee_id);
CREATE UNIQUE INDEX idx_template_attendees_unique ON public.template_attendees(template_id, attendee_id);

-- Create meeting attendees linking table
CREATE TABLE public.meeting_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL,
  attendee_id UUID NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_meeting_attendees_meeting_id ON public.meeting_attendees(meeting_id);
CREATE INDEX idx_meeting_attendees_attendee_id ON public.meeting_attendees(attendee_id);
CREATE UNIQUE INDEX idx_meeting_attendees_unique ON public.meeting_attendees(meeting_id, attendee_id);

-- Enhance meetings table with new context fields
ALTER TABLE public.meetings 
ADD COLUMN participants TEXT[],
ADD COLUMN agenda TEXT,
ADD COLUMN auto_generated_name TEXT,
ADD COLUMN meeting_context JSONB DEFAULT '{}'::jsonb,
ADD COLUMN meeting_format TEXT,
ADD COLUMN meeting_location TEXT;

-- Enhance audio_chunks table
ALTER TABLE public.audio_chunks 
ADD COLUMN chunk_duration_ms INTEGER,
ALTER COLUMN audio_blob_path TYPE TEXT,
ALTER COLUMN processing_status SET DEFAULT 'pending';

-- Create storage bucket for audio chunks
INSERT INTO storage.buckets (id, name, public) 
VALUES ('meeting-audio-chunks', 'meeting-audio-chunks', false);

-- Enable RLS on new tables
ALTER TABLE public.meeting_attendee_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_attendee_templates
CREATE POLICY "Practice managers can manage attendee templates" 
ON public.meeting_attendee_templates 
FOR ALL 
USING (
  practice_id = ANY (get_user_practice_ids()) AND 
  (has_role(auth.uid(), 'practice_manager'::app_role) OR has_role(auth.uid(), 'system_admin'::app_role))
);

CREATE POLICY "Practice users can view attendee templates" 
ON public.meeting_attendee_templates 
FOR SELECT 
USING (practice_id = ANY (get_user_practice_ids()));

-- RLS Policies for template_attendees
CREATE POLICY "Users can manage template attendees for their practice templates" 
ON public.template_attendees 
FOR ALL 
USING (
  template_id IN (
    SELECT id FROM public.meeting_attendee_templates 
    WHERE practice_id = ANY (get_user_practice_ids())
  )
);

-- RLS Policies for meeting_attendees
CREATE POLICY "Users can manage meeting attendees for accessible meetings" 
ON public.meeting_attendees 
FOR ALL 
USING (user_has_meeting_access(meeting_id, auth.uid()));

-- Update attendees table RLS to be practice-scoped
DROP POLICY IF EXISTS "Users can create their own attendees" ON public.attendees;
DROP POLICY IF EXISTS "Users can view their own attendees" ON public.attendees;
DROP POLICY IF EXISTS "Users can update their own attendees" ON public.attendees;
DROP POLICY IF EXISTS "Users can delete their own attendees" ON public.attendees;

CREATE POLICY "Practice users can manage attendees" 
ON public.attendees 
FOR ALL 
USING (
  practice_id = ANY (get_user_practice_ids()) OR 
  (practice_id IS NULL AND user_id = auth.uid())
);

-- Storage policies for audio chunks
CREATE POLICY "Users can upload audio chunks for their meetings" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'meeting-audio-chunks' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view audio chunks for accessible meetings" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'meeting-audio-chunks' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete audio chunks for their meetings" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'meeting-audio-chunks' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create triggers for updated_at
CREATE TRIGGER update_meeting_attendee_templates_updated_at
  BEFORE UPDATE ON public.meeting_attendee_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create default templates for a practice
CREATE OR REPLACE FUNCTION public.create_default_attendee_templates(p_practice_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Create a default "Regular Meeting" template
  INSERT INTO public.meeting_attendee_templates (
    practice_id, 
    template_name, 
    description, 
    is_default, 
    created_by
  ) VALUES (
    p_practice_id,
    'Regular Meeting',
    'Standard attendee list for regular practice meetings',
    true,
    p_user_id
  );
END;
$$;