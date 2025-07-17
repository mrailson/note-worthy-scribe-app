-- First, let's drop the existing foreign key constraint that references practice_details
ALTER TABLE public.user_roles 
DROP CONSTRAINT IF EXISTS user_roles_practice_id_fkey;

-- Then add a new foreign key constraint that references gp_practices instead
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_practice_id_fkey 
FOREIGN KEY (practice_id) REFERENCES public.gp_practices(id);