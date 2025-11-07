-- Create complaint_review_conversations table
CREATE TABLE IF NOT EXISTS public.complaint_review_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  conversation_transcript TEXT,
  conversation_summary TEXT,
  challenges_identified JSONB DEFAULT '[]'::jsonb,
  responses_given JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  conversation_duration INTEGER, -- Duration in seconds
  conversation_started_at TIMESTAMP WITH TIME ZONE,
  conversation_ended_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_review_conversations ENABLE ROW LEVEL SECURITY;

-- Create policies (same access as complaints)
CREATE POLICY "Users can view review conversations for complaints they have access to"
  ON public.complaint_review_conversations
  FOR SELECT
  USING (
    complaint_id IN (
      SELECT c.id FROM public.complaints c
      WHERE (c.practice_id = ANY(get_user_practice_ids(auth.uid())))
         OR (c.created_by = auth.uid())
         OR is_system_admin(auth.uid())
         OR has_role(auth.uid(), 'practice_manager'::app_role)
         OR has_role(auth.uid(), 'complaints_manager'::app_role)
    )
  );

CREATE POLICY "Users can insert review conversations for complaints they have access to"
  ON public.complaint_review_conversations
  FOR INSERT
  WITH CHECK (
    complaint_id IN (
      SELECT c.id FROM public.complaints c
      WHERE (c.practice_id = ANY(get_user_practice_ids(auth.uid())))
         OR (c.created_by = auth.uid())
         OR is_system_admin(auth.uid())
         OR has_role(auth.uid(), 'practice_manager'::app_role)
         OR has_role(auth.uid(), 'complaints_manager'::app_role)
    )
  );

CREATE POLICY "Users can update their own review conversations"
  ON public.complaint_review_conversations
  FOR UPDATE
  USING (created_by = auth.uid());

-- Create index for faster queries
CREATE INDEX idx_complaint_review_conversations_complaint_id 
  ON public.complaint_review_conversations(complaint_id);

CREATE INDEX idx_complaint_review_conversations_created_at 
  ON public.complaint_review_conversations(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_complaint_review_conversations_updated_at
  BEFORE UPDATE ON public.complaint_review_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();