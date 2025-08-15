-- Create function to get large files across all tables
CREATE OR REPLACE FUNCTION public.get_large_files(min_size_bytes bigint DEFAULT 10485760)
RETURNS TABLE(
  table_name text,
  file_name text,
  file_size bigint,
  file_size_pretty text,
  uploaded_at timestamp with time zone,
  uploaded_by_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  
  -- Files from meeting_documents
  SELECT 
    'meeting_documents'::text,
    md.file_name,
    md.file_size::bigint,
    pg_size_pretty(md.file_size::bigint),
    md.uploaded_at,
    COALESCE(p.email, 'Unknown')::text
  FROM meeting_documents md
  LEFT JOIN auth.users au ON md.uploaded_by = au.id
  LEFT JOIN profiles p ON md.uploaded_by = p.user_id
  WHERE md.file_size >= min_size_bytes
  
  UNION ALL
  
  -- Files from meeting_audio_backups
  SELECT 
    'meeting_audio_backups'::text,
    'Audio backup file'::text,
    mab.file_size::bigint,
    pg_size_pretty(mab.file_size::bigint),
    mab.created_at,
    COALESCE(p.email, 'Unknown')::text
  FROM meeting_audio_backups mab
  LEFT JOIN auth.users au ON mab.user_id = au.id
  LEFT JOIN profiles p ON mab.user_id = p.user_id
  WHERE mab.file_size >= min_size_bytes
  
  UNION ALL
  
  -- Files from complaint_investigation_evidence
  SELECT 
    'complaint_investigation_evidence'::text,
    cie.file_name,
    cie.file_size::bigint,
    pg_size_pretty(cie.file_size::bigint),
    cie.uploaded_at,
    COALESCE(p.email, 'Unknown')::text
  FROM complaint_investigation_evidence cie
  LEFT JOIN auth.users au ON cie.uploaded_by = au.id
  LEFT JOIN profiles p ON cie.uploaded_by = p.user_id
  WHERE cie.file_size >= min_size_bytes
  
  UNION ALL
  
  -- Files from contractor_resumes
  SELECT 
    'contractor_resumes'::text,
    cr.file_name,
    cr.file_size::bigint,
    pg_size_pretty(cr.file_size::bigint),
    cr.uploaded_at,
    COALESCE(p.email, 'Unknown')::text
  FROM contractor_resumes cr
  LEFT JOIN auth.users au ON cr.uploaded_by = au.id
  LEFT JOIN profiles p ON cr.uploaded_by = p.user_id
  WHERE cr.file_size >= min_size_bytes
  
  UNION ALL
  
  -- Files from cqc_evidence
  SELECT 
    'cqc_evidence'::text,
    COALESCE(ce.file_name, 'CQC Evidence File')::text,
    ce.file_size::bigint,
    pg_size_pretty(ce.file_size::bigint),
    ce.created_at,
    COALESCE(p.email, 'Unknown')::text
  FROM cqc_evidence ce
  LEFT JOIN auth.users au ON ce.uploaded_by = au.id
  LEFT JOIN profiles p ON ce.uploaded_by = p.user_id
  WHERE ce.file_size >= min_size_bytes
  
  ORDER BY file_size DESC;
END;
$$;