-- Add allow_all_staff column to shift_templates table
ALTER TABLE public.shift_templates 
ADD COLUMN allow_all_staff BOOLEAN DEFAULT false;