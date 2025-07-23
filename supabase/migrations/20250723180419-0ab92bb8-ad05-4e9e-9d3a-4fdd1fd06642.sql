-- Add location and format columns to meetings table
ALTER TABLE public.meetings 
ADD COLUMN location TEXT,
ADD COLUMN format TEXT;