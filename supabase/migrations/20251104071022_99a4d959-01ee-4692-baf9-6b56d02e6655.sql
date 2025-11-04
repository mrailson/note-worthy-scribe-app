-- Add foreign key constraint from complaints.practice_id to gp_practices.id
ALTER TABLE public.complaints
ADD CONSTRAINT fk_complaints_practice
FOREIGN KEY (practice_id)
REFERENCES public.gp_practices(id)
ON DELETE SET NULL;