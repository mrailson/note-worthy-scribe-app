-- Fix the final remaining search path security issues
-- Add SET search_path to the last functions missing this security parameter

-- Fix update_last_login function
CREATE OR REPLACE FUNCTION public.update_last_login()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.profiles 
  SET last_login = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$function$;

-- Fix handle_user_login function  
CREATE OR REPLACE FUNCTION public.handle_user_login()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert a new session record when user logs in
  INSERT INTO public.user_sessions (
    user_id,
    session_id,
    login_time,
    last_activity,
    is_active,
    ip_address,
    user_agent
  ) VALUES (
    NEW.id,
    NEW.id::text || '-' || extract(epoch from now())::text,
    now(),
    now(),
    true,
    null, -- IP will be updated by application if available
    null  -- User agent will be updated by application if available
  );
  
  RETURN NEW;
END;
$function$;

-- Fix handle_user_login_auth function
CREATE OR REPLACE FUNCTION public.handle_user_login_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only create session record for actual logins (not just profile updates)
  IF (TG_OP = 'UPDATE' AND OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL) 
     OR (TG_OP = 'INSERT' AND NEW.last_sign_in_at IS NOT NULL) THEN
    
    -- Insert a new session record when user logs in
    INSERT INTO public.user_sessions (
      user_id,
      session_id,
      login_time,
      last_activity,
      is_active,
      ip_address,
      user_agent
    ) VALUES (
      NEW.id,
      NEW.id::text || '-' || extract(epoch from now())::text,
      COALESCE(NEW.last_sign_in_at, now()),
      now(),
      true,
      null, -- IP will be updated by application if available
      null  -- User agent will be updated by application if available
    );
  END IF;
  
  RETURN NEW;
END;
$function$;