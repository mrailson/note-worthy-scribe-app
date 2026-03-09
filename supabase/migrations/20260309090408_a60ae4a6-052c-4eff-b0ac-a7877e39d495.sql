ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS default_home_page_desktop text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_home_page_mobile text DEFAULT NULL;

-- Drop the old single column if it exists
ALTER TABLE public.profiles DROP COLUMN IF EXISTS default_home_page;