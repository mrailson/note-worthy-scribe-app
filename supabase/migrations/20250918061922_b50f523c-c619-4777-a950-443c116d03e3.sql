-- Add chat history retention setting to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ai4gp_chat_retention_days INTEGER DEFAULT 30 
CHECK (ai4gp_chat_retention_days IN (1, 7, 30, 365));

-- Create function to cleanup old AI4GP chat history based on user retention settings
CREATE OR REPLACE FUNCTION public.cleanup_ai4gp_chat_history()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete old AI4GP chat history based on user retention settings
  DELETE FROM public.ai_4_pm_searches 
  WHERE created_at < (
    SELECT NOW() - (COALESCE(p.ai4gp_chat_retention_days, 30) || ' days')::INTERVAL
    FROM public.profiles p 
    WHERE p.user_id = ai_4_pm_searches.user_id
  )
  AND is_protected IS NOT TRUE; -- Don't delete protected searches
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup operation
  IF deleted_count > 0 THEN
    PERFORM public.log_system_activity(
      'ai_4_pm_searches',
      'AUTO_CLEANUP_CHAT_HISTORY',
      NULL,
      NULL,
      jsonb_build_object(
        'deleted_count', deleted_count,
        'cleanup_time', now()
      )
    );
  END IF;
  
  RETURN deleted_count;
END;
$function$;

-- Create a scheduled job to run cleanup daily at 2 AM
SELECT cron.schedule(
  'ai4gp-chat-cleanup',
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT public.cleanup_ai4gp_chat_history();
  $$
);