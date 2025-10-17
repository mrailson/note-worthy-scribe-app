-- Create attendee templates table
CREATE TABLE IF NOT EXISTS public.attendee_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID REFERENCES public.practice_details(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create junction table for template members
CREATE TABLE IF NOT EXISTS public.attendee_template_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.attendee_templates(id) ON DELETE CASCADE,
  attendee_id UUID NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(template_id, attendee_id)
);

-- Enable RLS on attendee templates
ALTER TABLE public.attendee_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendee_template_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for attendee_templates
CREATE POLICY "Users can view templates in their practice"
  ON public.attendee_templates FOR SELECT
  USING (
    practice_id = ANY (get_user_practice_ids(auth.uid())) 
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can create templates"
  ON public.attendee_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON public.attendee_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON public.attendee_templates FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for attendee_template_members
CREATE POLICY "Users can view template members in their practice"
  ON public.attendee_template_members FOR SELECT
  USING (
    template_id IN (
      SELECT id FROM public.attendee_templates 
      WHERE practice_id = ANY (get_user_practice_ids(auth.uid())) 
      OR user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add members to their templates"
  ON public.attendee_template_members FOR INSERT
  WITH CHECK (
    template_id IN (
      SELECT id FROM public.attendee_templates WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove members from their templates"
  ON public.attendee_template_members FOR DELETE
  USING (
    template_id IN (
      SELECT id FROM public.attendee_templates WHERE user_id = auth.uid()
    )
  );

-- Add updated_at trigger for templates
CREATE TRIGGER update_attendee_templates_updated_at
  BEFORE UPDATE ON public.attendee_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_attendee_templates_practice ON public.attendee_templates(practice_id);
CREATE INDEX idx_attendee_templates_user ON public.attendee_templates(user_id);
CREATE INDEX idx_template_members_template ON public.attendee_template_members(template_id);
CREATE INDEX idx_template_members_attendee ON public.attendee_template_members(attendee_id);