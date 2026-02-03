-- Add unique constraint on name column for upsert support
ALTER TABLE public.traffic_light_medicines 
ADD CONSTRAINT traffic_light_medicines_name_key UNIQUE (name);