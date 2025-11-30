-- Create meeting_folders table
CREATE TABLE public.meeting_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  colour TEXT DEFAULT '#3b82f6',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for meeting_folders
CREATE POLICY "Users can view their own folders"
  ON public.meeting_folders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own folders"
  ON public.meeting_folders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON public.meeting_folders
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON public.meeting_folders
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add folder_id column to meetings table
ALTER TABLE public.meetings
ADD COLUMN folder_id UUID REFERENCES public.meeting_folders(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_meetings_folder_id ON public.meetings(folder_id);

-- Create trigger for updated_at
CREATE TRIGGER update_meeting_folders_updated_at
  BEFORE UPDATE ON public.meeting_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();