ALTER TABLE public.reception_translation_sessions 
ADD COLUMN IF NOT EXISTS is_training boolean NOT NULL DEFAULT false;

ALTER TABLE public.reception_translation_sessions 
ADD COLUMN IF NOT EXISTS training_scenario text;