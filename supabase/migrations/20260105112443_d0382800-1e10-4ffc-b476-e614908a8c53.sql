-- Create board members table for responsible person pick list
CREATE TABLE public.nres_board_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  group_name TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nres_board_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for board members
CREATE POLICY "Users can view board members"
  ON public.nres_board_members
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create board members"
  ON public.nres_board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update board members"
  ON public.nres_board_members
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete board members"
  ON public.nres_board_members
  FOR DELETE
  TO authenticated
  USING (true);

-- Create board action documents table
CREATE TABLE public.nres_board_action_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES public.nres_board_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nres_board_action_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for documents
CREATE POLICY "Users can view action documents"
  ON public.nres_board_action_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can upload action documents"
  ON public.nres_board_action_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete action documents"
  ON public.nres_board_action_documents
  FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for board action documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('board-action-documents', 'board-action-documents', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload board action documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'board-action-documents');

CREATE POLICY "Authenticated users can view board action documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'board-action-documents');

CREATE POLICY "Authenticated users can delete board action documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'board-action-documents');

-- Add updated_at trigger for board members
CREATE TRIGGER update_nres_board_members_updated_at
  BEFORE UPDATE ON public.nres_board_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();