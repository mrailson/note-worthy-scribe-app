CREATE OR REPLACE FUNCTION public.is_nres_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.nres_system_roles r
    JOIN auth.users u ON lower(u.email) = lower(r.user_email)
    WHERE u.id = _user_id
      AND r.role IN ('super_admin', 'management_lead', 'pml_director', 'pml_finance')
      AND r.is_active = true
  )
$function$;