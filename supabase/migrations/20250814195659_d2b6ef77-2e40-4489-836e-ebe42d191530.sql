-- Fix the remaining contractor_competencies table security issue (just enable RLS)
ALTER TABLE public.contractor_competencies ENABLE ROW LEVEL SECURITY;