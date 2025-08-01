-- Add RLS policy to allow users to delete contractors they created
CREATE POLICY "Users can delete contractors they created" 
ON public.contractors 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add foreign key constraints with CASCADE DELETE to handle related data
ALTER TABLE public.contractor_competencies
DROP CONSTRAINT IF EXISTS contractor_competencies_contractor_id_fkey,
ADD CONSTRAINT contractor_competencies_contractor_id_fkey 
FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;

ALTER TABLE public.contractor_experience
DROP CONSTRAINT IF EXISTS contractor_experience_contractor_id_fkey,
ADD CONSTRAINT contractor_experience_contractor_id_fkey 
FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;

ALTER TABLE public.contractor_recommendations
DROP CONSTRAINT IF EXISTS contractor_recommendations_contractor_id_fkey,
ADD CONSTRAINT contractor_recommendations_contractor_id_fkey 
FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;

ALTER TABLE public.contractor_resumes
DROP CONSTRAINT IF EXISTS contractor_resumes_contractor_id_fkey,
ADD CONSTRAINT contractor_resumes_contractor_id_fkey 
FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;

ALTER TABLE public.contractor_notes
DROP CONSTRAINT IF EXISTS contractor_notes_contractor_id_fkey,
ADD CONSTRAINT contractor_notes_contractor_id_fkey 
FOREIGN KEY (contractor_id) REFERENCES public.contractors(id) ON DELETE CASCADE;