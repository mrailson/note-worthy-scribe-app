
CREATE TABLE public.nres_buyback_practice_email_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_key TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  receive_invoice BOOLEAN NOT NULL DEFAULT true,
  receive_payment_confirmation BOOLEAN NOT NULL DEFAULT true,
  receive_approval BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX nres_bb_recipients_unique_per_practice
  ON public.nres_buyback_practice_email_recipients (practice_key, lower(email));

CREATE INDEX nres_bb_recipients_practice_key_idx
  ON public.nres_buyback_practice_email_recipients (practice_key);

ALTER TABLE public.nres_buyback_practice_email_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practice users can view buyback recipients"
ON public.nres_buyback_practice_email_recipients
FOR SELECT
USING (
  has_nres_buyback_access(auth.uid(), practice_key, ARRAY['view','submit','approver','verifier'])
  OR is_nres_admin()
);

CREATE POLICY "Practice submitters can insert buyback recipients"
ON public.nres_buyback_practice_email_recipients
FOR INSERT
WITH CHECK (
  has_nres_buyback_access(auth.uid(), practice_key, ARRAY['submit'])
  OR is_nres_admin()
);

CREATE POLICY "Practice submitters can update buyback recipients"
ON public.nres_buyback_practice_email_recipients
FOR UPDATE
USING (
  has_nres_buyback_access(auth.uid(), practice_key, ARRAY['submit'])
  OR is_nres_admin()
);

CREATE POLICY "Practice submitters can delete buyback recipients"
ON public.nres_buyback_practice_email_recipients
FOR DELETE
USING (
  has_nres_buyback_access(auth.uid(), practice_key, ARRAY['submit'])
  OR is_nres_admin()
);

CREATE TRIGGER update_nres_bb_recipients_updated_at
BEFORE UPDATE ON public.nres_buyback_practice_email_recipients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
