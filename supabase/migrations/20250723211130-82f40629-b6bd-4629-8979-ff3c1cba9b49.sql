-- Update the July 23rd meeting with the real overview based on its content
UPDATE public.meeting_overviews 
SET overview = 'Meeting discussed: pay rise discussions and performance review processes for team members including Jesse''s 10% pay increase and HR involvement'
WHERE meeting_id = '241d609c-e9ae-4568-ad72-bee5d438b0e7';

-- Update the other meeting based on its actual content (testing meeting)
UPDATE public.meeting_overviews 
SET overview = 'Meeting focused: audio service testing and technical verification procedures'
WHERE meeting_id = 'ba955db6-6c7c-4c5f-9105-6ad1439aee02';