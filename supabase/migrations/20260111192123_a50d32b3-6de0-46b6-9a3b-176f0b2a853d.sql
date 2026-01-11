-- Create meeting_action_items table for structured action item storage
CREATE TABLE public.meeting_action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action_text TEXT NOT NULL,
  assignee_name TEXT DEFAULT 'TBC',
  assignee_type TEXT DEFAULT 'tbc' CHECK (assignee_type IN ('me', 'chair', 'attendee', 'custom', 'tbc')),
  due_date TEXT DEFAULT 'TBC',
  due_date_actual DATE,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Completed')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own action items"
ON public.meeting_action_items
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own action items"
ON public.meeting_action_items
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own action items"
ON public.meeting_action_items
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own action items"
ON public.meeting_action_items
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_meeting_action_items_meeting_id ON public.meeting_action_items(meeting_id);
CREATE INDEX idx_meeting_action_items_user_id ON public.meeting_action_items(user_id);
CREATE INDEX idx_meeting_action_items_status ON public.meeting_action_items(status);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_meeting_action_items_updated_at
BEFORE UPDATE ON public.meeting_action_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();