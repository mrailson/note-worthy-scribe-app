-- Fix High Priority Security Issues - Function Search Paths
-- This addresses the search_path_mutable warnings by setting explicit search_path

-- Function: update_manual_translation_sessions_updated_at
CREATE OR REPLACE FUNCTION public.update_manual_translation_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Function: can_view_consultation_examples
CREATE OR REPLACE FUNCTION public.can_view_consultation_examples(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_override BOOLEAN;
  system_default BOOLEAN;
BEGIN
  SELECT show_consultation_examples INTO user_override
  FROM public.user_roles
  WHERE user_id = _user_id
    AND show_consultation_examples IS NOT NULL
  LIMIT 1;
  
  IF user_override IS NOT NULL THEN
    RETURN user_override;
  END IF;
  
  SELECT (setting_value->>'enabled')::boolean INTO system_default
  FROM public.system_settings
  WHERE setting_key = 'consultation_examples_visibility';
  
  RETURN COALESCE(system_default, true);
END;
$function$;

-- Function: update_icb_formulary_updated_at
CREATE OR REPLACE FUNCTION public.update_icb_formulary_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function: update_image_processing_requests_updated_at
CREATE OR REPLACE FUNCTION public.update_image_processing_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function: update_meeting_notes_queue_updated_at
CREATE OR REPLACE FUNCTION public.update_meeting_notes_queue_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function: update_monitoring_alerts_updated_at
CREATE OR REPLACE FUNCTION public.update_monitoring_alerts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function: update_dashboard_session_timestamp
CREATE OR REPLACE FUNCTION public.update_dashboard_session_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function: deduplicate_medicines
CREATE OR REPLACE FUNCTION public.deduplicate_medicines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM traffic_light_medicines a
  USING traffic_light_medicines b
  WHERE a.id < b.id
    AND a.name = b.name
    AND a.status_enum = b.status_enum;
END;
$function$;

-- Function: icn_norm
CREATE OR REPLACE FUNCTION public.icn_norm(input_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN TRIM(
        LOWER(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(input_name, '\s+', ' ', 'g'),
                    '\s*(tablet|capsule|injection|cream|ointment|spray|inhaler|solution|suspension|drops)s?\s*$', '', 'gi'
                ),
                '\s*(mg|mcg|microgram|g|ml|%)\s*\d*\s*$', '', 'gi'
            )
        )
    );
END;
$function$;

-- Function: delay_seconds
CREATE OR REPLACE FUNCTION public.delay_seconds(seconds integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM pg_sleep(seconds);
END;
$function$;

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Function: update_user_settings_updated_at
CREATE OR REPLACE FUNCTION public.update_user_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Function: update_translation_sessions_updated_at
CREATE OR REPLACE FUNCTION public.update_translation_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;