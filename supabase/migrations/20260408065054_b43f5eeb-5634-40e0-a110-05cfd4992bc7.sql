
CREATE TABLE public.enn_insurance_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practice_name TEXT NOT NULL,
  insurance_type TEXT NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  amount TEXT NOT NULL DEFAULT 'TBC',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (practice_name, insurance_type)
);

ALTER TABLE public.enn_insurance_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view insurance checklist"
  ON public.enn_insurance_checklist FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can update insurance checklist"
  ON public.enn_insurance_checklist FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Seed data: 10 practices × 4 types = 40 rows
INSERT INTO public.enn_insurance_checklist (practice_name, insurance_type, confirmed, amount) VALUES
  ('Harborough Fields Surgery', 'Public', false, 'TBC'),
  ('Harborough Fields Surgery', 'Employers', false, 'TBC'),
  ('Harborough Fields Surgery', 'Prof/MDU', true, 'No Limit'),
  ('Harborough Fields Surgery', 'Clinical/CNSGP', true, 'No Limit'),
  ('Higham Ferrers Surgery', 'Public', false, 'TBC'),
  ('Higham Ferrers Surgery', 'Employers', false, 'TBC'),
  ('Higham Ferrers Surgery', 'Prof/MDU', true, 'No Limit'),
  ('Higham Ferrers Surgery', 'Clinical/CNSGP', true, 'No Limit'),
  ('Marshalls Road Surgery', 'Public', false, 'TBC'),
  ('Marshalls Road Surgery', 'Employers', false, 'TBC'),
  ('Marshalls Road Surgery', 'Prof/MDU', true, 'No Limit'),
  ('Marshalls Road Surgery', 'Clinical/CNSGP', true, 'No Limit'),
  ('Nene Valley Surgery', 'Public', false, 'TBC'),
  ('Nene Valley Surgery', 'Employers', false, 'TBC'),
  ('Nene Valley Surgery', 'Prof/MDU', true, 'No Limit'),
  ('Nene Valley Surgery', 'Clinical/CNSGP', true, 'No Limit'),
  ('Oundle Medical Practice', 'Public', false, 'TBC'),
  ('Oundle Medical Practice', 'Employers', false, 'TBC'),
  ('Oundle Medical Practice', 'Prof/MDU', true, 'No Limit'),
  ('Oundle Medical Practice', 'Clinical/CNSGP', true, 'No Limit'),
  ('Parklands Surgery', 'Public', false, 'TBC'),
  ('Parklands Surgery', 'Employers', false, 'TBC'),
  ('Parklands Surgery', 'Prof/MDU', true, 'No Limit'),
  ('Parklands Surgery', 'Clinical/CNSGP', true, 'No Limit'),
  ('Rushden Medical Centre', 'Public', false, 'TBC'),
  ('Rushden Medical Centre', 'Employers', false, 'TBC'),
  ('Rushden Medical Centre', 'Prof/MDU', true, 'No Limit'),
  ('Rushden Medical Centre', 'Clinical/CNSGP', true, 'No Limit'),
  ('Spinney Brook Medical Centre', 'Public', false, 'TBC'),
  ('Spinney Brook Medical Centre', 'Employers', false, 'TBC'),
  ('Spinney Brook Medical Centre', 'Prof/MDU', true, 'No Limit'),
  ('Spinney Brook Medical Centre', 'Clinical/CNSGP', true, 'No Limit'),
  ('The Cottons Medical Centre', 'Public', false, 'TBC'),
  ('The Cottons Medical Centre', 'Employers', false, 'TBC'),
  ('The Cottons Medical Centre', 'Prof/MDU', true, 'No Limit'),
  ('The Cottons Medical Centre', 'Clinical/CNSGP', true, 'No Limit'),
  ('The Meadows Surgery', 'Public', false, 'TBC'),
  ('The Meadows Surgery', 'Employers', false, 'TBC'),
  ('The Meadows Surgery', 'Prof/MDU', true, 'No Limit'),
  ('The Meadows Surgery', 'Clinical/CNSGP', true, 'No Limit');
