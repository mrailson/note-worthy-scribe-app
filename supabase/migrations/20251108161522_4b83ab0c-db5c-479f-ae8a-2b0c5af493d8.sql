-- Fix audit trigger with proper exception handling
CREATE OR REPLACE FUNCTION public.audit_document_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    BEGIN
      PERFORM public.log_complaint_document_action(
        NEW.complaint_id,
        'upload',
        NEW.file_name,
        NEW.id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Skip logging if complaint doesn't exist (cleanup scenario)
      RAISE NOTICE 'Skipping audit log for orphaned evidence upload';
    END;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    BEGIN
      PERFORM public.log_complaint_document_action(
        OLD.complaint_id,
        'delete',
        OLD.file_name,
        OLD.id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Skip logging if complaint doesn't exist (cleanup scenario)
      RAISE NOTICE 'Skipping audit log for orphaned evidence delete';
    END;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Cleanup orphaned data and add CASCADE
ALTER TABLE public.complaint_investigation_transcripts
DROP CONSTRAINT IF EXISTS complaint_investigation_transcripts_audio_file_id_fkey;

ALTER TABLE public.complaint_investigation_evidence
DROP CONSTRAINT IF EXISTS complaint_investigation_evidence_complaint_id_fkey;

DELETE FROM public.complaint_investigation_transcripts
WHERE audio_file_id NOT IN (SELECT id FROM public.complaint_investigation_evidence);

DELETE FROM public.complaint_investigation_evidence 
WHERE complaint_id NOT IN (SELECT id FROM public.complaints);

DELETE FROM public.complaint_investigation_transcripts
WHERE audio_file_id NOT IN (SELECT id FROM public.complaint_investigation_evidence);

ALTER TABLE public.complaint_investigation_transcripts
ADD CONSTRAINT complaint_investigation_transcripts_audio_file_id_fkey
FOREIGN KEY (audio_file_id)
REFERENCES public.complaint_investigation_evidence(id)
ON DELETE CASCADE;

ALTER TABLE public.complaint_investigation_evidence
ADD CONSTRAINT complaint_investigation_evidence_complaint_id_fkey
FOREIGN KEY (complaint_id)
REFERENCES public.complaints(id)
ON DELETE CASCADE;