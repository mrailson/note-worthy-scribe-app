-- Fix all remaining functions with mutable search_path

-- 1. generate_ai_chat_capture_short_code (INVOKER, trigger)
CREATE OR REPLACE FUNCTION public.generate_ai_chat_capture_short_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    new_code := upper(substring(encode(gen_random_bytes(4), 'base64') from 1 for 6));
    new_code := regexp_replace(new_code, '[^A-Z0-9]', substring('ABCDEFGHJKLMNPQRSTUVWXYZ23456789' from (floor(random() * 32) + 1)::int for 1), 'g');
    SELECT EXISTS(SELECT 1 FROM public.ai_chat_capture_sessions WHERE short_code = new_code) INTO code_exists;
    IF NOT code_exists THEN
      NEW.short_code := new_code;
      EXIT;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

-- 2. get_meeting_usage_report (DEFINER)
CREATE OR REPLACE FUNCTION public.get_meeting_usage_report()
RETURNS TABLE(user_id uuid, email text, full_name text, last_24h bigint, last_7d bigint, last_30d bigint, all_time bigint, avg_duration_mins numeric, total_duration_mins bigint, total_words bigint, deleted_meetings_count bigint, duration_24h bigint, duration_7d bigint, duration_30d bigint, words_24h bigint, words_7d bigint, words_30d bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  WITH users_list AS (
    SELECT 
      au.id as uid,
      au.email::text as uemail,
      (au.raw_user_meta_data->>'full_name')::text as ufull_name
    FROM auth.users au
    WHERE au.deleted_at IS NULL
  ),
  excluded_users AS (
    SELECT au.id as excluded_id
    FROM auth.users au
    WHERE lower(au.email) = 'malcolm.railson@nhs.net'
  ),
  meeting_stats AS (
    SELECT 
      m.user_id as ms_user_id,
      COUNT(*) FILTER (WHERE m.created_at::date = CURRENT_DATE) as last_24h,
      COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days') as last_7d,
      COUNT(*) FILTER (WHERE m.created_at >= NOW() - INTERVAL '30 days') as last_30d,
      COUNT(*) as all_time,
      ROUND(AVG(COALESCE(m.duration_minutes, 0)), 0) as avg_duration_mins,
      SUM(COALESCE(m.duration_minutes, 0)) as total_duration_mins,
      SUM(COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0)) as total_words,
      SUM(COALESCE(m.duration_minutes, 0)) FILTER (WHERE m.created_at::date = CURRENT_DATE) as duration_24h,
      SUM(COALESCE(m.duration_minutes, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days') as duration_7d,
      SUM(COALESCE(m.duration_minutes, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '30 days') as duration_30d,
      SUM(COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0)) FILTER (WHERE m.created_at::date = CURRENT_DATE) as words_24h,
      SUM(COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days') as words_7d,
      SUM(COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0)) FILTER (WHERE m.created_at >= NOW() - INTERVAL '30 days') as words_30d
    FROM public.meetings m
    WHERE m.status = 'completed'
      AND COALESCE(NULLIF(m.transcript_cleaned_word_count, 0), m.word_count, 0) >= 100
    GROUP BY m.user_id
  ),
  deleted_stats AS (
    SELECT 
      ma.user_id as ds_user_id,
      COUNT(*) as deleted_count
    FROM public.meetings_archive ma
    WHERE ma.word_count >= 500
      AND ma.user_id NOT IN (SELECT excluded_id FROM excluded_users)
    GROUP BY ma.user_id
  )
  SELECT 
    u.uid,
    u.uemail,
    u.ufull_name,
    COALESCE(ms.last_24h, 0)::BIGINT,
    COALESCE(ms.last_7d, 0)::BIGINT,
    COALESCE(ms.last_30d, 0)::BIGINT,
    (COALESCE(ms.all_time, 0) + COALESCE(ds.deleted_count, 0))::BIGINT,
    COALESCE(ms.avg_duration_mins, 0)::NUMERIC,
    COALESCE(ms.total_duration_mins, 0)::BIGINT,
    COALESCE(ms.total_words, 0)::BIGINT,
    COALESCE(ds.deleted_count, 0)::BIGINT,
    COALESCE(ms.duration_24h, 0)::BIGINT,
    COALESCE(ms.duration_7d, 0)::BIGINT,
    COALESCE(ms.duration_30d, 0)::BIGINT,
    COALESCE(ms.words_24h, 0)::BIGINT,
    COALESCE(ms.words_7d, 0)::BIGINT,
    COALESCE(ms.words_30d, 0)::BIGINT
  FROM users_list u
  LEFT JOIN meeting_stats ms ON u.uid = ms.ms_user_id
  LEFT JOIN deleted_stats ds ON u.uid = ds.ds_user_id
  WHERE COALESCE(ms.all_time, 0) > 0 OR COALESCE(ds.deleted_count, 0) > 0
  ORDER BY COALESCE(ms.all_time, 0) DESC;
END;
$function$;

-- 3. get_translation_usage_report (DEFINER)
CREATE OR REPLACE FUNCTION public.get_translation_usage_report()
RETURNS TABLE(user_id uuid, email text, full_name text, total_sessions bigint, total_messages bigint, languages_used text[], last_24h bigint, last_7d bigint, last_30d bigint, last_session_at timestamp with time zone, avg_messages_per_session numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.user_id,
    COALESCE(p.email, 'Unknown') as email,
    p.full_name,
    COUNT(DISTINCT s.id)::bigint as total_sessions,
    COALESCE(SUM(s.total_messages), 0)::bigint as total_messages,
    ARRAY_AGG(DISTINCT s.patient_language) FILTER (WHERE s.patient_language IS NOT NULL) as languages_used,
    COUNT(DISTINCT s.id) FILTER (WHERE s.created_at >= NOW() - INTERVAL '24 hours')::bigint as last_24h,
    COUNT(DISTINCT s.id) FILTER (WHERE s.created_at >= NOW() - INTERVAL '7 days')::bigint as last_7d,
    COUNT(DISTINCT s.id) FILTER (WHERE s.created_at >= NOW() - INTERVAL '30 days')::bigint as last_30d,
    MAX(s.created_at) as last_session_at,
    ROUND(COALESCE(SUM(s.total_messages)::numeric / NULLIF(COUNT(DISTINCT s.id), 0), 0), 1) as avg_messages_per_session
  FROM reception_translation_sessions s
  LEFT JOIN profiles p ON s.user_id = p.user_id
  GROUP BY s.user_id, p.email, p.full_name
  ORDER BY total_sessions DESC;
END;
$function$;

-- 4. initialize_complaint_compliance (DEFINER)
CREATE OR REPLACE FUNCTION public.initialize_complaint_compliance(p_complaint_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.complaint_compliance_checks (complaint_id, compliance_item, notes)
  VALUES
    (p_complaint_id, '(1) Complaint logged in practice register', 'Demonstrates compliance with NHS England Local Authority Social Services and NHS Complaints Regulations 2009, Regulation 15. CQC Regulation 16.2 requires proper record-keeping.'),
    (p_complaint_id, '(2) Acknowledgement sent within 3 working days', 'Required under NHS Complaints Regulations 2009, Regulation 14. Demonstrates timely response and patient-centred care (CQC Key Line of Enquiry: Responsive).'),
    (p_complaint_id, '(3) Complainant informed of investigation timescales', 'Transparency requirement under NHS Complaints Regulations 2009. Shows effective communication and person-centred approach (CQC Regulation 17.2).'),
    (p_complaint_id, '(4) Confidentiality maintained throughout', 'Data Protection Act 2018, GDPR Article 6. CQC Regulation 17 requires proper information governance. Essential for maintaining patient trust.'),
    (p_complaint_id, '(5) Fair and thorough investigation conducted', 'CQC Regulation 17 (Good Governance) requires effective systems to assess and monitor service quality. Demonstrates duty of candour compliance.'),
    (p_complaint_id, '(6) Relevant staff interviewed/statements taken', 'Part of thorough investigation process. CQC expects comprehensive evidence gathering. Shows commitment to learning culture (CQC Key Line of Enquiry: Well-led).'),
    (p_complaint_id, '(7) Medical records reviewed where appropriate', 'Clinical governance requirement. Essential for evidence-based investigation. CQC Regulation 17 requires accurate record review.'),
    (p_complaint_id, '(8) Senior management oversight documented', 'CQC Regulation 17 (Good Governance) requires leadership accountability. Demonstrates management engagement and oversight of complaint handling.'),
    (p_complaint_id, '(9) Investigation completed within 20 working days', 'Standard under NHS Complaints Regulations 2009. Extensions must be agreed with complainant. Shows responsive service delivery.'),
    (p_complaint_id, '(10) Response addresses all points raised', 'NHS Complaints Regulations 2009, Regulation 14(3) requires comprehensive response. Demonstrates person-centred care and thoroughness.'),
    (p_complaint_id, '(11) Response letter includes escalation routes', 'Mandatory under NHS Complaints Regulations 2009. Must include Parliamentary and Health Service Ombudsman (PHSO) details. Shows transparency.'),
    (p_complaint_id, '(12) Learning and improvements identified', 'CQC Regulation 17 requires continuous improvement systems. Key evidence for learning culture and quality improvement (CQC: Well-led domain).'),
    (p_complaint_id, '(13) Action plan developed and implemented', 'Demonstrates commitment to service improvement. CQC expects evidence of actions taken following complaints. Shows responsive leadership.'),
    (p_complaint_id, '(14) Outcome communicated to relevant staff', 'Part of learning culture and staff development. CQC Regulation 18 (Staffing) includes keeping staff informed. Supports continuous improvement.'),
    (p_complaint_id, '(15) Follow-up review scheduled if required', 'Best practice for quality assurance. Demonstrates commitment to sustained improvement and monitoring of implemented changes.')
  ON CONFLICT (complaint_id, compliance_item) DO NOTHING;
END;
$function$;

-- 5. update_mock_inspection_updated_at (INVOKER, trigger)
CREATE OR REPLACE FUNCTION public.update_mock_inspection_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;