
-- Buy-back staff members allocated by each practice
CREATE TABLE public.nres_buyback_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  practice_id UUID REFERENCES public.practice_details(id),
  staff_name TEXT NOT NULL,
  staff_role TEXT NOT NULL DEFAULT 'GP',
  allocation_type TEXT NOT NULL DEFAULT 'sessions' CHECK (allocation_type IN ('sessions', 'wte')),
  allocation_value NUMERIC NOT NULL DEFAULT 0,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nres_buyback_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own practice buyback staff"
  ON public.nres_buyback_staff FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own buyback staff"
  ON public.nres_buyback_staff FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own buyback staff"
  ON public.nres_buyback_staff FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own buyback staff"
  ON public.nres_buyback_staff FOR DELETE
  USING (auth.uid() = user_id);

-- Buy-back monthly claims
CREATE TABLE public.nres_buyback_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  practice_id UUID REFERENCES public.practice_details(id),
  claim_month DATE NOT NULL,
  staff_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_amount NUMERIC NOT NULL DEFAULT 0,
  claimed_amount NUMERIC NOT NULL DEFAULT 0,
  declaration_confirmed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nres_buyback_claims ENABLE ROW LEVEL SECURITY;

-- Users see own claims
CREATE POLICY "Users can view own buyback claims"
  ON public.nres_buyback_claims FOR SELECT
  USING (auth.uid() = user_id);

-- Approvers can see all submitted claims
CREATE POLICY "Approvers can view submitted buyback claims"
  ON public.nres_buyback_claims FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE email IN (
        'm.green28@nhs.net',
        'mark.gray1@nhs.net',
        'amanda.taylor75@nhs.net',
        'carolyn.abbisogni@nhs.net'
      )
    )
    AND status IN ('submitted', 'approved', 'rejected')
  );

CREATE POLICY "Users can insert own buyback claims"
  ON public.nres_buyback_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft buyback claims"
  ON public.nres_buyback_claims FOR UPDATE
  USING (auth.uid() = user_id AND status = 'draft');

-- Approvers can update submitted claims (approve/reject)
CREATE POLICY "Approvers can update submitted buyback claims"
  ON public.nres_buyback_claims FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users WHERE email IN (
        'm.green28@nhs.net',
        'mark.gray1@nhs.net',
        'amanda.taylor75@nhs.net',
        'carolyn.abbisogni@nhs.net'
      )
    )
    AND status = 'submitted'
  );

CREATE POLICY "Users can delete own draft buyback claims"
  ON public.nres_buyback_claims FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');

-- Triggers for updated_at
CREATE TRIGGER update_nres_buyback_staff_updated_at
  BEFORE UPDATE ON public.nres_buyback_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nres_buyback_claims_updated_at
  BEFORE UPDATE ON public.nres_buyback_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
