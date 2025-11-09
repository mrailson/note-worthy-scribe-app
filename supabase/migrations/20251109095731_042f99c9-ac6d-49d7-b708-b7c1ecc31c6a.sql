-- Create complaint team members table for quick staff selection
CREATE TABLE public.complaint_team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.complaint_team_members ENABLE ROW LEVEL SECURITY;

-- Users can view their own team members
CREATE POLICY "Users can view their own team members"
ON public.complaint_team_members
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own team members
CREATE POLICY "Users can insert their own team members"
ON public.complaint_team_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own team members
CREATE POLICY "Users can update their own team members"
ON public.complaint_team_members
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own team members
CREATE POLICY "Users can delete their own team members"
ON public.complaint_team_members
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_complaint_team_members_updated_at
BEFORE UPDATE ON public.complaint_team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on user_id for faster lookups
CREATE INDEX idx_complaint_team_members_user_id ON public.complaint_team_members(user_id);

-- Create index on active team members
CREATE INDEX idx_complaint_team_members_active ON public.complaint_team_members(user_id, is_active) WHERE is_active = true;