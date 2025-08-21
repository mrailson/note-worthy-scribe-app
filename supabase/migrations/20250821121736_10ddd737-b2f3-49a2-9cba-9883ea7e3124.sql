-- Create table for auto-generated meeting notes
CREATE TABLE IF NOT EXISTS public.meeting_auto_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    generated_notes TEXT,
    error_message TEXT,
    generation_started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    generation_completed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    detail_level TEXT DEFAULT 'standard',
    word_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on the table
ALTER TABLE public.meeting_auto_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view auto notes for accessible meetings" ON public.meeting_auto_notes
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM public.meetings 
            WHERE user_id = auth.uid() 
               OR id IN (
                   SELECT meeting_id FROM public.meeting_shares 
                   WHERE shared_with_user_id = auth.uid() 
                      OR shared_with_email = auth.email()
               )
        )
    );

CREATE POLICY "System can manage auto notes" ON public.meeting_auto_notes
    FOR ALL USING (true);

-- Create function to trigger auto-generation
CREATE OR REPLACE FUNCTION public.trigger_auto_meeting_notes()
RETURNS TRIGGER AS $$
DECLARE
    transcript_count INTEGER;
    min_word_threshold INTEGER := 50; -- Minimum words to trigger auto-generation
BEGIN
    -- Check if meeting has sufficient transcript content
    SELECT COUNT(*) INTO transcript_count
    FROM public.meeting_transcripts mt
    WHERE mt.meeting_id = NEW.id;
    
    -- Also check meeting_transcription_chunks for content
    IF transcript_count = 0 THEN
        SELECT COUNT(*) INTO transcript_count
        FROM public.meeting_transcription_chunks mtc
        WHERE mtc.meeting_id = NEW.id;
    END IF;
    
    -- Only trigger if we have transcript content and status is 'completed'
    IF transcript_count > 0 AND NEW.status = 'completed' THEN
        -- Insert auto-notes record to trigger background processing
        INSERT INTO public.meeting_auto_notes (meeting_id, status, detail_level)
        VALUES (NEW.id, 'pending', 'standard')
        ON CONFLICT DO NOTHING; -- Prevent duplicates if trigger fires multiple times
        
        -- Call the background processing function (will be handled by edge function)
        PERFORM pg_notify('auto_generate_notes', NEW.id::text);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on meetings table
DROP TRIGGER IF EXISTS meeting_auto_notes_trigger ON public.meetings;
CREATE TRIGGER meeting_auto_notes_trigger
    AFTER INSERT OR UPDATE OF status ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_meeting_notes();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meeting_auto_notes_meeting_id ON public.meeting_auto_notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_auto_notes_status ON public.meeting_auto_notes(status);

-- Create updated_at trigger
CREATE TRIGGER update_meeting_auto_notes_updated_at
    BEFORE UPDATE ON public.meeting_auto_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();