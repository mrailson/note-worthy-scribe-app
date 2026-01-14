-- Create referral_destinations table for practice-level referral contacts
CREATE TABLE public.referral_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES public.gp_practices(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  hospital_name TEXT NOT NULL,
  department TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  fax TEXT,
  address TEXT,
  notes TEXT,
  specialty_keywords TEXT[], -- For auto-matching (e.g., ['cardiology', 'heart', 'cardiac'])
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.referral_destinations ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view destinations for their practice
CREATE POLICY "Users can view referral destinations for their practice"
ON public.referral_destinations
FOR SELECT
USING (
  practice_id IN (
    SELECT practice_id FROM public.profiles WHERE user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

-- All clinicians can insert new destinations
CREATE POLICY "Users can create referral destinations"
ON public.referral_destinations
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update destinations they created or for their practice
CREATE POLICY "Users can update referral destinations"
ON public.referral_destinations
FOR UPDATE
USING (
  created_by = auth.uid()
  OR practice_id IN (
    SELECT practice_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Users can delete destinations they created
CREATE POLICY "Users can delete referral destinations they created"
ON public.referral_destinations
FOR DELETE
USING (created_by = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_referral_destinations_updated_at
BEFORE UPDATE ON public.referral_destinations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();