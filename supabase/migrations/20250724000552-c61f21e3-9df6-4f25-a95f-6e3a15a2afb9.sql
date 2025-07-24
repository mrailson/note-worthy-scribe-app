-- Create a table to track PCN manager practice assignments
CREATE TABLE public.pcn_manager_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES gp_practices(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, practice_id)
);

-- Enable RLS on the new table
ALTER TABLE public.pcn_manager_practices ENABLE ROW LEVEL SECURITY;

-- RLS policies for pcn_manager_practices
CREATE POLICY "System admins can manage PCN practice assignments" 
ON public.pcn_manager_practices 
FOR ALL 
USING (is_system_admin());

CREATE POLICY "PCN managers can view their practice assignments" 
ON public.pcn_manager_practices 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Practice managers can view PCN assignments for their practice" 
ON public.pcn_manager_practices 
FOR SELECT 
USING (practice_id = get_practice_manager_practice_id());