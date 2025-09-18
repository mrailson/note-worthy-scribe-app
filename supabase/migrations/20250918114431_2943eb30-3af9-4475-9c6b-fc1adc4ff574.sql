-- Fix search path security issues for database functions
-- Add SET search_path to functions that are missing this security parameter

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- Fix update_user_settings_updated_at function
CREATE OR REPLACE FUNCTION public.update_user_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_translation_sessions_updated_at function
CREATE OR REPLACE FUNCTION public.update_translation_sessions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_icn_formulary_updated_at function
CREATE OR REPLACE FUNCTION public.update_icn_formulary_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_icb_formulary_updated_at function
CREATE OR REPLACE FUNCTION public.update_icb_formulary_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_image_processing_requests_updated_at function
CREATE OR REPLACE FUNCTION public.update_image_processing_requests_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_meeting_notes_queue_updated_at function
CREATE OR REPLACE FUNCTION public.update_meeting_notes_queue_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_monitoring_alerts_updated_at function
CREATE OR REPLACE FUNCTION public.update_monitoring_alerts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_dashboard_session_timestamp function
CREATE OR REPLACE FUNCTION public.update_dashboard_session_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix deduplicate_medicines function
CREATE OR REPLACE FUNCTION public.deduplicate_medicines()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Remove duplicate medicines based on name and status_enum
  DELETE FROM traffic_light_medicines a
  USING traffic_light_medicines b
  WHERE a.id < b.id
    AND a.name = b.name
    AND a.status_enum = b.status_enum;
END;
$function$;

-- Fix icn_norm function
CREATE OR REPLACE FUNCTION public.icn_norm(input_name text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    -- Basic normalization: lowercase, remove extra spaces, remove common suffixes
    RETURN TRIM(
        LOWER(
            REGEXP_REPLACE(
                REGEXP_REPLACE(
                    REGEXP_REPLACE(input_name, '\s+', ' ', 'g'), -- normalize spaces
                    '\s*(tablet|capsule|injection|cream|ointment|spray|inhaler|solution|suspension|drops)s?\s*$', '', 'gi' -- remove formulation
                ),
                '\s*(mg|mcg|microgram|g|ml|%)\s*\d*\s*$', '', 'gi' -- remove dosage
            )
        )
    );
END;
$function$;

-- Fix delay_seconds function
CREATE OR REPLACE FUNCTION public.delay_seconds(seconds integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM pg_sleep(seconds);
END;
$function$;