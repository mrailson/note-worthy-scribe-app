-- Create table for NRES Board Actions
CREATE TABLE public.nres_board_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_title TEXT NOT NULL,
  description TEXT,
  responsible_person TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'overdue')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.nres_board_actions ENABLE ROW LEVEL SECURITY;

-- Create policies - all authenticated users can view (shared across team)
CREATE POLICY "Authenticated users can view all board actions" 
ON public.nres_board_actions 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert board actions" 
ON public.nres_board_actions 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update board actions" 
ON public.nres_board_actions 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete board actions" 
ON public.nres_board_actions 
FOR DELETE 
TO authenticated
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_nres_board_actions_updated_at
BEFORE UPDATE ON public.nres_board_actions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();