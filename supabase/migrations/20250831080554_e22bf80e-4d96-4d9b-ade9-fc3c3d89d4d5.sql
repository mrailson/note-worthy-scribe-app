-- Manually trigger notes generation for the recovered meeting
-- This simulates the pg_notify that should have been called by the trigger
SELECT pg_notify('auto_generate_notes', 'cc8fd683-0bfb-409b-987f-025562383537');