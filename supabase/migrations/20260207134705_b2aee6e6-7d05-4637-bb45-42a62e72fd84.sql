
-- Create compliments table
CREATE TABLE public.compliments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_number TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL,
  patient_contact_email TEXT,
  patient_contact_phone TEXT,
  compliment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  compliment_title TEXT NOT NULL,
  compliment_description TEXT NOT NULL,
  category TEXT NOT NULL,
  staff_mentioned TEXT[],
  location_service TEXT,
  source TEXT NOT NULL DEFAULT 'patient',
  status TEXT NOT NULL DEFAULT 'received',
  shared_with_staff BOOLEAN NOT NULL DEFAULT false,
  shared_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID NOT NULL,
  practice_id UUID REFERENCES public.gp_practices(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sequence for compliment reference numbers
CREATE SEQUENCE IF NOT EXISTS compliment_reference_seq START WITH 1;

-- Create function to generate compliment reference numbers (CMPL + YY + 4-digit sequence)
CREATE OR REPLACE FUNCTION public.generate_compliment_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT;
  seq_num INTEGER;
  new_reference TEXT;
BEGIN
  year_prefix := to_char(CURRENT_DATE, 'YY');
  seq_num := nextval('compliment_reference_seq');
  new_reference := 'CMPL' || year_prefix || lpad(seq_num::text, 4, '0');
  NEW.reference_number := new_reference;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-assign reference numbers on INSERT
CREATE TRIGGER set_compliment_reference
  BEFORE INSERT ON public.compliments
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_compliment_reference();

-- Create updated_at trigger
CREATE TRIGGER update_compliments_updated_at
  BEFORE UPDATE ON public.compliments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.compliments ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can view compliments"
  ON public.compliments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create compliments"
  ON public.compliments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update compliments"
  ON public.compliments
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete compliments"
  ON public.compliments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Indexes
CREATE INDEX idx_compliments_reference_number ON public.compliments(reference_number);
CREATE INDEX idx_compliments_practice_id ON public.compliments(practice_id);
CREATE INDEX idx_compliments_created_by ON public.compliments(created_by);
CREATE INDEX idx_compliments_status ON public.compliments(status);
CREATE INDEX idx_compliments_compliment_date ON public.compliments(compliment_date);
