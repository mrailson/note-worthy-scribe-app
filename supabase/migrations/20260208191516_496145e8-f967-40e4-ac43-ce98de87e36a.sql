
-- Create table for storing indemnity consideration selections
CREATE TABLE public.complaint_indemnity_considerations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  consideration_status TEXT NOT NULL,
  provider_name TEXT,
  notes TEXT,
  selected_by UUID NOT NULL,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(complaint_id)
);

-- Enable RLS
ALTER TABLE public.complaint_indemnity_considerations ENABLE ROW LEVEL SECURITY;

-- RLS policies: only authenticated users who created the complaint or are authorised
CREATE POLICY "Users can view indemnity considerations for their complaints"
  ON public.complaint_indemnity_considerations
  FOR SELECT
  TO authenticated
  USING (
    selected_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert indemnity considerations"
  ON public.complaint_indemnity_considerations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    selected_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update indemnity considerations"
  ON public.complaint_indemnity_considerations
  FOR UPDATE
  TO authenticated
  USING (
    selected_by = auth.uid()
    AND is_locked = false
  );

-- Auto-update timestamp trigger
CREATE TRIGGER update_indemnity_considerations_updated_at
  BEFORE UPDATE ON public.complaint_indemnity_considerations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
