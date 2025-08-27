-- First, let's modify the NHS email constraint to allow this specific Gmail address
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_nhs_email;

-- Add a more flexible constraint that allows NHS emails and this specific Gmail address
ALTER TABLE public.profiles ADD CONSTRAINT valid_nhs_email 
CHECK (
  email ILIKE '%@nhs.net' OR 
  email ILIKE '%@nhs.uk' OR 
  email = 'egplearning@gmail.com'
);