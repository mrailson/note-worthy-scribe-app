UPDATE public.nres_buyback_rate_settings
SET management_roles_config = management_roles_config || '[{
  "key": "notewell_development",
  "label": "Notewell Development",
  "person_name": "Malcolm Railson",
  "person_email": "malcolm.railson@nhs.net",
  "hourly_rate": 0,
  "max_hours_per_week": 0,
  "billing_entity": "Brackley & Towcester PCN Ltd",
  "billing_org_code": "U07902",
  "is_active": true
}]'::jsonb
WHERE id = 'default';