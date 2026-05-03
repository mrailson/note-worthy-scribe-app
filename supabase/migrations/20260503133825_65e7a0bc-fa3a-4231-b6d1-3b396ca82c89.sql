-- Pipeline test: insert Long fixture meeting (transcript loaded separately to avoid huge migration size)
INSERT INTO public.meetings (id, user_id, title, description, meeting_type, start_time, end_time, duration_minutes, status, import_source, meeting_format, notes_generation_status)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-000000000301', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Pipeline Test (Long, Sonnet single-shot) — manual', '[Manual single-shot test]', 'general', now(), now(), 41, 'completed', 'pipeline-test-manual', 'face-to-face', 'queued')
ON CONFLICT (id) DO NOTHING;