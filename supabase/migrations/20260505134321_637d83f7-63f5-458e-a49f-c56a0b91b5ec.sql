INSERT INTO public.domain_dictionary (wrong_term, correct_term, category)
SELECT v.wrong_term, 'C the Signs', 'clinical-tool'
FROM (VALUES
  ('CDesigns'),
  ('C Designs'),
  ('See Designs'),
  ('See the Signs'),
  ('See The Signs'),
  ('Sea the Signs'),
  ('Sea Signs'),
  ('CD Signs'),
  ('C-Designs')
) AS v(wrong_term)
WHERE NOT EXISTS (
  SELECT 1 FROM public.domain_dictionary d WHERE LOWER(d.wrong_term) = LOWER(v.wrong_term)
);