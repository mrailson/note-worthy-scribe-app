-- Switch FK from practice_details to gp_practices so it matches where the complaint practice_id lives
ALTER TABLE public.complaint_team_members
DROP CONSTRAINT complaint_team_members_practice_id_fkey;

ALTER TABLE public.complaint_team_members
ADD CONSTRAINT complaint_team_members_practice_id_fkey
FOREIGN KEY (practice_id) REFERENCES public.gp_practices(id) ON DELETE CASCADE;

-- Now auto-assign existing team members for the logged-in user
UPDATE public.complaint_team_members
SET practice_id = 'e6b2ad5e-a601-4653-90b2-2febba689880'::uuid
WHERE user_id = 'e3aea82f-451b-40fb-8681-2b579a92dc3a'
  AND is_active = true
  AND practice_id IS NULL;