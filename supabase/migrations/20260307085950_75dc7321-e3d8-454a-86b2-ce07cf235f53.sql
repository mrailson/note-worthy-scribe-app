INSERT INTO policy_reference_library (
  id,
  policy_name,
  category,
  cqc_kloe,
  priority,
  guidance_sources,
  required_services,
  required_roles,
  description,
  template_sections,
  is_active
) VALUES (
  gen_random_uuid(),
  'Sexual Harassment',
  'HR',
  'Well-led',
  'Essential',
  '["Worker Protection (Amendment of Equality Act 2010) Act 2023", "Equality Act 2010", "ACAS Guidance on Sexual Harassment", "Health and Safety at Work etc. Act 1974"]'::jsonb,
  '{}'::text[],
  '{}'::text[],
  'Policy for preventing and addressing sexual harassment in the workplace, including the new employer duty under the Worker Protection Act 2023',
  '[]'::jsonb,
  true
);