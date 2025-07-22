-- Create enum types for ReplyWell AI
CREATE TYPE communication_mode AS ENUM ('create', 'improve');
CREATE TYPE communication_tone AS ENUM ('friendly', 'professional', 'empathetic', 'clinical', 'informative', 'reassuring', 'apologetic', 'urgent', 'firm', 'diplomatic');

-- Create communications table
CREATE TABLE public.communications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    email_text TEXT,
    uploaded_files JSONB DEFAULT '[]'::jsonb,
    context_notes TEXT,
    response_guidance TEXT,
    tone communication_tone DEFAULT 'professional',
    reply_length INTEGER DEFAULT 3 CHECK (reply_length >= 1 AND reply_length <= 5),
    mode communication_mode DEFAULT 'create',
    draft_text TEXT,
    generated_reply TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create communication_files table for file metadata
CREATE TABLE public.communication_files (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    communication_id UUID NOT NULL REFERENCES public.communications(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for communications
CREATE POLICY "Users can view their own communications" 
ON public.communications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own communications" 
ON public.communications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own communications" 
ON public.communications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own communications" 
ON public.communications 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for communication_files
CREATE POLICY "Users can view files for their communications" 
ON public.communication_files 
FOR SELECT 
USING (communication_id IN (
    SELECT id FROM public.communications WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create files for their communications" 
ON public.communication_files 
FOR INSERT 
WITH CHECK (communication_id IN (
    SELECT id FROM public.communications WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete files for their communications" 
ON public.communication_files 
FOR DELETE 
USING (communication_id IN (
    SELECT id FROM public.communications WHERE user_id = auth.uid()
));

-- Create storage bucket for communication files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('communication-files', 'communication-files', false);

-- Create storage policies
CREATE POLICY "Users can upload their own communication files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'communication-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own communication files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'communication-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own communication files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'communication-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updated_at
CREATE TRIGGER update_communications_updated_at
    BEFORE UPDATE ON public.communications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert demo data (optional)
INSERT INTO public.communications (user_id, email_text, context_notes, response_guidance, tone, reply_length, mode) VALUES
(gen_random_uuid(), 'Dear Practice Manager, I am writing to inquire about the ARRS funding allocation for our practice. We submitted our application last month but have not received any updates. Could you please provide an update on the status?', 'ARRS funding inquiry from partner practice', 'Provide professional update on funding status and next steps', 'professional', 3, 'create'),
(gen_random_uuid(), 'To Whom It May Concern, We are conducting a routine CQC inspection of your practice next month. Please prepare all necessary documentation including patient safety records, staff training certificates, and quality assurance processes.', 'CQC inspection preparation request', 'Acknowledge receipt and confirm preparation timeline', 'professional', 4, 'create');