-- Create tables for manual translation sessions and entries
CREATE TABLE IF NOT EXISTS public.manual_translation_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    session_title TEXT,
    target_language_code TEXT NOT NULL,
    target_language_name TEXT NOT NULL,
    total_exchanges INTEGER DEFAULT 0,
    session_duration_seconds INTEGER DEFAULT 0,
    average_accuracy NUMERIC(5,2) DEFAULT 0,
    average_confidence NUMERIC(5,2) DEFAULT 0,
    overall_safety_rating TEXT CHECK (overall_safety_rating IN ('safe', 'warning', 'unsafe')) DEFAULT 'safe',
    session_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
    session_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_completed BOOLEAN DEFAULT false,
    session_metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.manual_translation_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.manual_translation_sessions(id) ON DELETE CASCADE,
    exchange_number INTEGER NOT NULL,
    speaker TEXT CHECK (speaker IN ('gp', 'patient')) NOT NULL,
    original_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    original_language_detected TEXT NOT NULL,
    target_language TEXT NOT NULL,
    detection_confidence NUMERIC(5,2) DEFAULT 0,
    translation_accuracy NUMERIC(5,2) DEFAULT 0,
    translation_confidence NUMERIC(5,2) DEFAULT 0,
    safety_flag TEXT CHECK (safety_flag IN ('safe', 'warning', 'unsafe')) DEFAULT 'safe',
    medical_terms_detected TEXT[] DEFAULT '{}',
    processing_time_ms INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.manual_translation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_translation_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for manual_translation_sessions
CREATE POLICY "Users can create their own manual translation sessions" 
    ON public.manual_translation_sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own manual translation sessions" 
    ON public.manual_translation_sessions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own manual translation sessions" 
    ON public.manual_translation_sessions FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own manual translation sessions" 
    ON public.manual_translation_sessions FOR DELETE 
    USING (auth.uid() = user_id);

-- Create RLS policies for manual_translation_entries  
CREATE POLICY "Users can create entries in their own sessions" 
    ON public.manual_translation_entries FOR INSERT 
    WITH CHECK (
        session_id IN (
            SELECT id FROM public.manual_translation_sessions 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view entries from their own sessions" 
    ON public.manual_translation_entries FOR SELECT 
    USING (
        session_id IN (
            SELECT id FROM public.manual_translation_sessions 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update entries in their own sessions" 
    ON public.manual_translation_entries FOR UPDATE 
    USING (
        session_id IN (
            SELECT id FROM public.manual_translation_sessions 
            WHERE user_id = auth.uid()
        )
    );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_translation_sessions_user_id ON public.manual_translation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_translation_sessions_created_at ON public.manual_translation_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_manual_translation_entries_session_id ON public.manual_translation_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_manual_translation_entries_timestamp ON public.manual_translation_entries(timestamp);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_manual_translation_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_manual_translation_sessions_updated_at
    BEFORE UPDATE ON public.manual_translation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_manual_translation_sessions_updated_at();