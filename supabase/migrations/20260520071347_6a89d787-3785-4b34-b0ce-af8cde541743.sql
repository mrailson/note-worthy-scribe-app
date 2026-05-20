
CREATE TABLE IF NOT EXISTS public.echo_finding_codes (
  finding_key text PRIMARY KEY,
  display_name text NOT NULL,
  track text NOT NULL CHECK (track IN ('A','B')),
  snomed_term text NOT NULL,
  snomed_code text,
  status text NOT NULL DEFAULT 'active'
);

ALTER TABLE public.echo_finding_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Echo finding codes readable by authenticated"
ON public.echo_finding_codes FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.echo_finding_codes (finding_key, display_name, track, snomed_term, snomed_code, status) VALUES
  ('lvsd',             'Left ventricular systolic dysfunction',         'A', 'Left ventricular systolic dysfunction',                 '134401001', 'active'),
  ('lv_dilatation',    'Left ventricular dilatation',                   'A', 'Left ventricular dilatation',                           '6210001',   'active'),
  ('rwma',             'Regional wall motion abnormality',              'A', 'Regional left ventricular wall motion abnormality',     '17680005',  'active'),
  ('lvh',              'Left ventricular hypertrophy',                  'A', 'Left ventricular hypertrophy',                          '55827005',  'active'),
  ('mitral_regurg',    'Mitral regurgitation',                          'A', 'Mitral regurgitation',                                  '48724000',  'active'),
  ('aortic_stenosis',  'Aortic stenosis',                               'A', 'Aortic valve stenosis',                                 '60573004',  'active'),
  ('aortic_regurg',    'Aortic regurgitation',                          'A', 'Aortic regurgitation',                                  '60234000',  'active'),
  ('tricuspid_regurg', 'Tricuspid regurgitation',                       'A', 'Tricuspid regurgitation',                               '111287006', 'active'),
  ('diastolic_dysfunction', 'Diastolic dysfunction',                    'B', 'Diastolic dysfunction',                                 NULL,        'active'),
  ('hfpef_pattern',    'HFpEF pattern',                                 'B', 'Heart failure with preserved ejection fraction',        NULL,        'active')
ON CONFLICT (finding_key) DO NOTHING;
