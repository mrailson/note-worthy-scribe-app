-- Create meeting_overviews table for storing concise meeting summaries
CREATE TABLE public.meeting_overviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  overview TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(meeting_id)
);

-- Enable Row Level Security
ALTER TABLE public.meeting_overviews ENABLE ROW LEVEL SECURITY;

-- Create policies for meeting overviews
CREATE POLICY "Users can view overviews for their meetings" 
ON public.meeting_overviews 
FOR SELECT 
USING (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create overviews for their meetings" 
ON public.meeting_overviews 
FOR INSERT 
WITH CHECK (
  meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid()) 
  AND auth.uid() = created_by
);

CREATE POLICY "Users can update overviews for their meetings" 
ON public.meeting_overviews 
FOR UPDATE 
USING (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = auth.uid()
));

CREATE POLICY "Users can delete overviews for their meetings" 
ON public.meeting_overviews 
FOR DELETE 
USING (meeting_id IN (
  SELECT id FROM public.meetings WHERE user_id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meeting_overviews_updated_at
BEFORE UPDATE ON public.meeting_overviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_meeting_overviews_meeting_id ON public.meeting_overviews(meeting_id);