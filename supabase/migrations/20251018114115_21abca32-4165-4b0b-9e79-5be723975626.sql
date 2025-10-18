-- Create a security definer function to safely insert complaint outcome questionnaires
create or replace function public.create_complaint_outcome_questionnaire(
  p_complaint_id uuid,
  p_questionnaire_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
begin
  -- Check authentication
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Check authorization (mirrors RLS policy logic)
  if not (
    is_system_admin(auth.uid())
    or has_role(auth.uid(), 'practice_manager'::app_role)
    or has_role(auth.uid(), 'complaints_manager'::app_role)
    or p_complaint_id in (
      select c.id
      from public.complaints c
      where (c.practice_id = any(get_user_practice_ids(auth.uid()))) or (c.created_by = auth.uid())
    )
  ) then
    raise exception 'Not authorised to create questionnaire for this complaint';
  end if;

  -- Insert the questionnaire
  insert into public.complaint_outcome_questionnaires (
    complaint_id, 
    created_by, 
    questionnaire_data
  ) values (
    p_complaint_id, 
    auth.uid(), 
    p_questionnaire_data
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;