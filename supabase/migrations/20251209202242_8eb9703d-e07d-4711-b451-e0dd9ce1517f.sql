-- Fix the search path for the trigger function
CREATE OR REPLACE FUNCTION archive_meeting_before_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.duration_minutes >= 5 THEN
    INSERT INTO public.meetings_archive (
      original_meeting_id,
      user_id,
      title,
      duration_minutes,
      word_count,
      original_created_at
    ) VALUES (
      OLD.id,
      OLD.user_id,
      OLD.title,
      OLD.duration_minutes,
      OLD.word_count,
      OLD.created_at
    );
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;