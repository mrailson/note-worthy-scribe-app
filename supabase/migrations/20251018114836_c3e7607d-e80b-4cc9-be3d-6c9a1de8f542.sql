-- Create a security definer RPC to insert complaint outcomes safely
create or replace function public.create_complaint_outcome(
  p_complaint_id uuid,
  p_outcome_type text,
  p_outcome_summary text,
  p_outcome_letter text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_id uuid;
begin
  -- Must be authenticated
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Authorisation: admin, manager roles, or access to complaint via practice/creator
  if not (
    is_system_admin(auth.uid())
    or has_role(auth.uid(), 'practice_manager'::app_role)
    or has_role(auth.uid(), 'complaints_manager'::app_role)
    or p_complaint_id in (
      select c.id from public.complaints c
      where (c.practice_id = any(get_user_practice_ids(auth.uid()))) or (c.created_by = auth.uid())
    )
  ) then
    raise exception 'Not authorised to create outcome for this complaint';
  end if;

  insert into public.complaint_outcomes (
    complaint_id,
    outcome_type,
    outcome_summary,
    outcome_letter,
    decided_by,
    decided_at
  ) values (
    p_complaint_id,
    p_outcome_type,
    p_outcome_summary,
    p_outcome_letter,
    auth.uid(),
    now()
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;