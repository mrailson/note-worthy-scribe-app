-- Migrate Dr James Toplis's signature from shared practice_details to his personal profile
UPDATE public.profiles 
SET letter_signature = (
  SELECT letter_signature 
  FROM public.practice_details 
  WHERE practice_name ILIKE '%Bugbrooke%' 
  LIMIT 1
),
updated_at = now()
WHERE user_id = 'd79315d5-1dc6-47c8-9160-600b84d7db59';

-- Clear the signature from the shared practice_details record
-- (It was personal data incorrectly stored in a shared record)
UPDATE public.practice_details
SET letter_signature = NULL
WHERE practice_name ILIKE '%Bugbrooke%';