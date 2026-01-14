-- Create NRES claimants table for managed claimant list
CREATE TABLE public.nres_claimants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('gp', 'pm')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nres_claimants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view claimants from their practice
CREATE POLICY "Users can view claimants from their practice"
ON public.nres_claimants
FOR SELECT
TO authenticated
USING (
  practice_id = ANY(public.get_user_practice_ids(auth.uid()))
);

-- Policy: Users can create claimants for their practice
CREATE POLICY "Users can create claimants for their practice"
ON public.nres_claimants
FOR INSERT
TO authenticated
WITH CHECK (
  practice_id = ANY(public.get_user_practice_ids(auth.uid()))
);

-- Policy: Users can update claimants from their practice
CREATE POLICY "Users can update claimants from their practice"
ON public.nres_claimants
FOR UPDATE
TO authenticated
USING (
  practice_id = ANY(public.get_user_practice_ids(auth.uid()))
);

-- Policy: Users can delete claimants from their practice
CREATE POLICY "Users can delete claimants from their practice"
ON public.nres_claimants
FOR DELETE
TO authenticated
USING (
  practice_id = ANY(public.get_user_practice_ids(auth.uid()))
);

-- Create index for faster lookups
CREATE INDEX idx_nres_claimants_practice ON public.nres_claimants(practice_id);
CREATE INDEX idx_nres_claimants_active ON public.nres_claimants(practice_id, is_active);

-- Add trigger for updated_at
CREATE TRIGGER update_nres_claimants_updated_at
BEFORE UPDATE ON public.nres_claimants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();