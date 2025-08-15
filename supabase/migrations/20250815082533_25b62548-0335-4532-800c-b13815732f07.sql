-- Update the get_large_files function to return file statistics
CREATE OR REPLACE FUNCTION public.get_large_files_stats()
RETURNS TABLE(
  files_over_1mb bigint,
  files_500kb_to_1mb bigint,
  total_large_files bigint,
  total_large_files_size bigint,
  total_large_files_size_pretty text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  over_1mb_count bigint := 0;
  between_500kb_1mb_count bigint := 0;
  total_count bigint := 0;
  total_size bigint := 0;
BEGIN
  -- Files from meeting_documents
  SELECT 
    COUNT(*) FILTER (WHERE md.file_size >= 1048576),  -- over 1MB
    COUNT(*) FILTER (WHERE md.file_size >= 512000 AND md.file_size < 1048576),  -- 500KB-1MB
    COUNT(*),
    COALESCE(SUM(md.file_size), 0)
  INTO over_1mb_count, between_500kb_1mb_count, total_count, total_size
  FROM meeting_documents md;
  
  -- Files from meeting_audio_backups
  DECLARE
    temp_over_1mb bigint;
    temp_between bigint;
    temp_total bigint;
    temp_size bigint;
  BEGIN
    SELECT 
      COUNT(*) FILTER (WHERE mab.file_size >= 1048576),
      COUNT(*) FILTER (WHERE mab.file_size >= 512000 AND mab.file_size < 1048576),
      COUNT(*),
      COALESCE(SUM(mab.file_size), 0)
    INTO temp_over_1mb, temp_between, temp_total, temp_size
    FROM meeting_audio_backups mab;
    
    over_1mb_count := over_1mb_count + temp_over_1mb;
    between_500kb_1mb_count := between_500kb_1mb_count + temp_between;
    total_count := total_count + temp_total;
    total_size := total_size + temp_size;
  END;
  
  -- Files from complaint_investigation_evidence
  SELECT 
    COUNT(*) FILTER (WHERE cie.file_size >= 1048576),
    COUNT(*) FILTER (WHERE cie.file_size >= 512000 AND cie.file_size < 1048576),
    COUNT(*),
    COALESCE(SUM(cie.file_size), 0)
  INTO temp_over_1mb, temp_between, temp_total, temp_size
  FROM complaint_investigation_evidence cie;
  
  over_1mb_count := over_1mb_count + temp_over_1mb;
  between_500kb_1mb_count := between_500kb_1mb_count + temp_between;
  total_count := total_count + temp_total;
  total_size := total_size + temp_size;
  
  -- Files from contractor_resumes
  SELECT 
    COUNT(*) FILTER (WHERE cr.file_size >= 1048576),
    COUNT(*) FILTER (WHERE cr.file_size >= 512000 AND cr.file_size < 1048576),
    COUNT(*),
    COALESCE(SUM(cr.file_size), 0)
  INTO temp_over_1mb, temp_between, temp_total, temp_size
  FROM contractor_resumes cr;
  
  over_1mb_count := over_1mb_count + temp_over_1mb;
  between_500kb_1mb_count := between_500kb_1mb_count + temp_between;
  total_count := total_count + temp_total;
  total_size := total_size + temp_size;
  
  -- Files from cqc_evidence
  SELECT 
    COUNT(*) FILTER (WHERE ce.file_size >= 1048576),
    COUNT(*) FILTER (WHERE ce.file_size >= 512000 AND ce.file_size < 1048576),
    COUNT(*),
    COALESCE(SUM(ce.file_size), 0)
  INTO temp_over_1mb, temp_between, temp_total, temp_size
  FROM cqc_evidence ce;
  
  over_1mb_count := over_1mb_count + temp_over_1mb;
  between_500kb_1mb_count := between_500kb_1mb_count + temp_between;
  total_count := total_count + temp_total;
  total_size := total_size + temp_size;
  
  RETURN QUERY SELECT 
    over_1mb_count,
    between_500kb_1mb_count,
    total_count,
    total_size,
    pg_size_pretty(total_size);
END;
$$;