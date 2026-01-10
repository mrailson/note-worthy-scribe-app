-- Phase 1: Create dedicated GP Consultation tables (completely separate from meetings)

-- 1. Main consultations table
CREATE TABLE public.gp_consultations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'GP Consultation',
  consultation_type TEXT NOT NULL DEFAULT 'f2f', -- 'f2f', 'telephone', 'video'
  consultation_category TEXT DEFAULT 'general', -- 'general', 'agewell', 'social_prescriber'
  status TEXT NOT NULL DEFAULT 'recording', -- 'recording', 'completed', 'archived'
  patient_consent BOOLEAN DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Transcripts table (1:1 with consultations)
CREATE TABLE public.gp_consultation_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES public.gp_consultations(id) ON DELETE CASCADE,
  transcript_text TEXT,
  cleaned_transcript TEXT,
  confidence_score REAL,
  transcription_service TEXT DEFAULT 'whisper', -- 'whisper', 'assembly', 'dual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_consultation_transcript UNIQUE (consultation_id)
);

-- 3. Notes table (1:1 with consultations)
CREATE TABLE public.gp_consultation_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES public.gp_consultations(id) ON DELETE CASCADE,
  note_format TEXT DEFAULT 'heidi', -- 'heidi', 'soap'
  note_style TEXT DEFAULT 'standard', -- 'shorthand', 'standard'
  soap_notes JSONB, -- {S, O, A, P}
  heidi_notes JSONB, -- {consultationHeader, history, examination, impression, plan}
  patient_letter TEXT,
  referral_letter TEXT,
  trainee_feedback TEXT,
  snomed_codes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_consultation_notes UNIQUE (consultation_id)
);

-- 4. Context files table (1:many with consultations)
CREATE TABLE public.gp_consultation_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id UUID NOT NULL REFERENCES public.gp_consultations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'image', 'document'
  extracted_text TEXT,
  preview_url TEXT,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.gp_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gp_consultation_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gp_consultation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gp_consultation_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gp_consultations
CREATE POLICY "Users can view their own consultations"
ON public.gp_consultations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own consultations"
ON public.gp_consultations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consultations"
ON public.gp_consultations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own consultations"
ON public.gp_consultations FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for gp_consultation_transcripts (via consultation ownership)
CREATE POLICY "Users can view their consultation transcripts"
ON public.gp_consultation_transcripts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their consultation transcripts"
ON public.gp_consultation_transcripts FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their consultation transcripts"
ON public.gp_consultation_transcripts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their consultation transcripts"
ON public.gp_consultation_transcripts FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

-- RLS Policies for gp_consultation_notes (via consultation ownership)
CREATE POLICY "Users can view their consultation notes"
ON public.gp_consultation_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their consultation notes"
ON public.gp_consultation_notes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their consultation notes"
ON public.gp_consultation_notes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their consultation notes"
ON public.gp_consultation_notes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

-- RLS Policies for gp_consultation_context (via consultation ownership)
CREATE POLICY "Users can view their consultation context"
ON public.gp_consultation_context FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their consultation context"
ON public.gp_consultation_context FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their consultation context"
ON public.gp_consultation_context FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their consultation context"
ON public.gp_consultation_context FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.gp_consultations
    WHERE id = consultation_id AND user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_gp_consultations_user_id ON public.gp_consultations(user_id);
CREATE INDEX idx_gp_consultations_created_at ON public.gp_consultations(created_at DESC);
CREATE INDEX idx_gp_consultations_status ON public.gp_consultations(status);
CREATE INDEX idx_gp_consultation_transcripts_consultation_id ON public.gp_consultation_transcripts(consultation_id);
CREATE INDEX idx_gp_consultation_notes_consultation_id ON public.gp_consultation_notes(consultation_id);
CREATE INDEX idx_gp_consultation_context_consultation_id ON public.gp_consultation_context(consultation_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_gp_consultations_updated_at
BEFORE UPDATE ON public.gp_consultations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gp_consultation_notes_updated_at
BEFORE UPDATE ON public.gp_consultation_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();