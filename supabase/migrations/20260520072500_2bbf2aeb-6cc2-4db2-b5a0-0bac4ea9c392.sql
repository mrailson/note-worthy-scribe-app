INSERT INTO public.echo_finding_codes (finding_key, display_name, track, snomed_term, snomed_code, status) VALUES
  ('lvsd', 'LV systolic dysfunction', 'A', 'Left ventricular systolic dysfunction (disorder)', '134401001', 'active'),
  ('lvh', 'Left ventricular hypertrophy', 'A', 'Left ventricular hypertrophy', '55827005', 'active'),
  ('mitral_regurg', 'Mitral regurgitation', 'A', 'Mitral valve regurgitation (disorder)', '48724000', 'active'),
  ('aortic_stenosis', 'Aortic stenosis', 'A', 'Aortic valve stenosis', '60573004', 'active'),
  ('aortic_regurg', 'Aortic regurgitation', 'A', 'Aortic valve regurgitation', '60234000', 'active'),
  ('tricuspid_regurg', 'Tricuspid regurgitation', 'A', 'Tricuspid valve regurgitation', '111287006', 'active'),
  ('pulm_htn', 'Pulmonary hypertension', 'A', 'Pulmonary hypertension', '70995007', 'active'),
  ('lv_dilatation', 'LV dilatation', 'A', 'Dilatation of left ventricle', NULL, 'active'),
  ('rwma', 'Regional wall motion abnormality', 'A', 'Regional wall motion abnormality', NULL, 'active'),
  ('la_dilatation', 'Left atrial dilatation', 'A', 'Dilatation of left atrium', NULL, 'active'),
  ('aortic_sclerosis', 'Aortic sclerosis', 'A', 'Aortic valve sclerosis', NULL, 'active'),
  ('pericardial_effusion', 'Pericardial effusion', 'A', 'Pericardial effusion', NULL, 'active'),
  ('diastolic_dysfunction', 'Diastolic dysfunction', 'B', 'Diastolic dysfunction', NULL, 'active'),
  ('hfpef_pattern', 'HFpEF pattern', 'B', 'Heart failure with preserved ejection fraction', NULL, 'active')
ON CONFLICT (finding_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  track = EXCLUDED.track,
  snomed_term = EXCLUDED.snomed_term,
  snomed_code = EXCLUDED.snomed_code,
  status = EXCLUDED.status;

DROP POLICY IF EXISTS "Echo finding codes readable by authenticated" ON public.echo_finding_codes;
CREATE POLICY "Echo finding codes readable by authenticated"
ON public.echo_finding_codes
FOR SELECT
TO authenticated
USING (true);