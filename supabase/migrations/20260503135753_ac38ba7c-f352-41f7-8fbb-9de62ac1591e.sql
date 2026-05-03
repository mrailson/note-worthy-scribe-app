-- ensure transcript present for fixture meeting. (Idempotent)
DO $$ DECLARE v text; BEGIN
  SELECT best_of_all_transcript INTO v FROM meetings WHERE id='aaaaaaaa-bbbb-cccc-dddd-000000000301';
END $$;