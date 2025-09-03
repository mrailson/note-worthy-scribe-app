-- Add columns to store different meeting note styles
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS notes_style_2 TEXT,
ADD COLUMN IF NOT EXISTS notes_style_3 TEXT,
ADD COLUMN IF NOT EXISTS notes_style_4 TEXT;