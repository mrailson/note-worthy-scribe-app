INSERT INTO public.meetings (
  id, user_id, title, status, created_at, updated_at, duration_minutes,
  import_source, notes_generation_status
) VALUES (
  'ef7711ae-2bc8-4c1b-a28c-5b7e075e16ea',
  'fcfad128-2a65-4fd0-8b15-5d990262172f',
  'General Meeting',
  'completed',
  '2026-03-24T10:15:00+00:00',
  now(),
  91,
  'mobile_offline',
  'not_started'
);