-- Set Michael Chapman (ICB member) as ICB active so he cannot submit feedback
UPDATE public.profiles 
SET northamptonshire_icb_active = true 
WHERE email = 'michael.chapman13@nhs.net';