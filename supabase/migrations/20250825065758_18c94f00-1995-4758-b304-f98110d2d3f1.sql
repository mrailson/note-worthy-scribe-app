-- Delete all audio chunks
DELETE FROM public.audio_chunks;

-- Delete all meeting audio backups
DELETE FROM public.meeting_audio_backups;

-- Log the cleanup operation
INSERT INTO public.system_audit_log (
  table_name,
  operation,
  user_id,
  user_email,
  new_values,
  timestamp
) VALUES (
  'audio_cleanup',
  'BULK_DELETE',
  auth.uid(),
  auth.email(),
  jsonb_build_object(
    'action', 'deleted_all_audio_files',
    'tables_affected', ARRAY['audio_chunks', 'meeting_audio_backups'],
    'cleanup_reason', 'user_requested_cleanup'
  ),
  now()
);