-- Find and fix any remaining Security Definer issues

-- Check for any remaining Security Definer views
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE definition ILIKE '%SECURITY DEFINER%'
          AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || rec.schemaname || '.' || rec.viewname || ' CASCADE';
        RAISE NOTICE 'Dropped Security Definer view: %.%', rec.schemaname, rec.viewname;
    END LOOP;
END $$;

-- Ensure accessible_meetings is properly recreated without SECURITY DEFINER
DROP VIEW IF EXISTS public.accessible_meetings CASCADE;

CREATE VIEW public.accessible_meetings AS
SELECT 
  m.*,
  CASE 
    WHEN m.user_id = auth.uid() THEN 'owner'
    ELSE 'shared'
  END AS access_type,
  ms.shared_by,
  ms.shared_at,
  ms.access_level,
  ms.message AS share_message,
  ms.id AS share_id
FROM public.meetings m
LEFT JOIN public.meeting_shares ms ON m.id = ms.meeting_id
WHERE 
  m.user_id = auth.uid() OR -- Own meetings
  (ms.shared_with_user_id = auth.uid() OR ms.shared_with_email = auth.email()); -- Shared meetings