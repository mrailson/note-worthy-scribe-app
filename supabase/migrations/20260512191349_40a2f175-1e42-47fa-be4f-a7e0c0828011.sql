
-- Safeguard: archive meeting rows before any DELETE so transcript chunks can be recovered.
CREATE OR REPLACE FUNCTION public.archive_meeting_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.meetings_archive (
      original_meeting_id,
      user_id,
      title,
      duration_minutes,
      word_count,
      deleted_at,
      original_created_at
    ) VALUES (
      OLD.id,
      OLD.user_id,
      OLD.title,
      OLD.duration_minutes,
      OLD.word_count,
      now(),
      OLD.created_at
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never block a delete because of archive failure; just log.
    RAISE WARNING 'archive_meeting_before_delete failed for meeting %: %', OLD.id, SQLERRM;
  END;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_meeting_before_delete ON public.meetings;
CREATE TRIGGER trg_archive_meeting_before_delete
BEFORE DELETE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.archive_meeting_before_delete();
