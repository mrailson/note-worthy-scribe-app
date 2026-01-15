-- Add personal signature fields to profiles table (user-specific, not shared)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS letter_signature text,
ADD COLUMN IF NOT EXISTS email_signature text;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.profiles.letter_signature IS 'Personal letter signature for this user - not shared with practice';
COMMENT ON COLUMN public.profiles.email_signature IS 'Personal email signature for this user - not shared with practice';