DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'mandatory-reads-reminder-cron';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP FUNCTION IF EXISTS public.mark_mandatory_read_overdue() CASCADE;
DROP TABLE IF EXISTS public.mandatory_read_reminder_log CASCADE;
DROP TABLE IF EXISTS public.mandatory_read_acknowledgements CASCADE;
DROP TABLE IF EXISTS public.mandatory_read_assignments CASCADE;
DROP TABLE IF EXISTS public.mandatory_reads CASCADE;