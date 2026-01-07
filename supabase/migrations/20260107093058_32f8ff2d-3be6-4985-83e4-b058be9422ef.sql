-- Add scope column to attendees table
ALTER TABLE public.attendees 
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'local' CHECK (scope IN ('global', 'local'));

-- Create distribution_lists table
CREATE TABLE IF NOT EXISTS public.distribution_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID REFERENCES public.practice_details(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  scope TEXT DEFAULT 'local' CHECK (scope IN ('global', 'local')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create distribution_list_members table
CREATE TABLE IF NOT EXISTS public.distribution_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.distribution_lists(id) ON DELETE CASCADE,
  attendee_id UUID NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, attendee_id)
);

-- Enable RLS on distribution_lists
ALTER TABLE public.distribution_lists ENABLE ROW LEVEL SECURITY;

-- Enable RLS on distribution_list_members
ALTER TABLE public.distribution_list_members ENABLE ROW LEVEL SECURITY;

-- RLS policy for distribution_lists: users can see their own lists
CREATE POLICY "Users can view their own distribution lists"
ON public.distribution_lists
FOR SELECT
USING (auth.uid() = user_id);

-- RLS policy for distribution_lists: users can insert their own lists
CREATE POLICY "Users can create their own distribution lists"
ON public.distribution_lists
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS policy for distribution_lists: users can update their own lists
CREATE POLICY "Users can update their own distribution lists"
ON public.distribution_lists
FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policy for distribution_lists: users can delete their own lists
CREATE POLICY "Users can delete their own distribution lists"
ON public.distribution_lists
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policy for distribution_list_members: users can see members of their own lists
CREATE POLICY "Users can view distribution list members"
ON public.distribution_list_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.distribution_lists dl 
    WHERE dl.id = list_id AND dl.user_id = auth.uid()
  )
);

-- RLS policy for distribution_list_members: users can insert members to their own lists
CREATE POLICY "Users can add distribution list members"
ON public.distribution_list_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.distribution_lists dl 
    WHERE dl.id = list_id AND dl.user_id = auth.uid()
  )
);

-- RLS policy for distribution_list_members: users can delete members from their own lists
CREATE POLICY "Users can remove distribution list members"
ON public.distribution_list_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.distribution_lists dl 
    WHERE dl.id = list_id AND dl.user_id = auth.uid()
  )
);

-- Create updated_at trigger for distribution_lists
CREATE OR REPLACE FUNCTION update_distribution_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_distribution_lists_updated_at
BEFORE UPDATE ON public.distribution_lists
FOR EACH ROW
EXECUTE FUNCTION update_distribution_lists_updated_at();