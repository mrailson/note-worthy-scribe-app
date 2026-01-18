-- Add columns to user_generated_images table for favourites and categorisation
ALTER TABLE user_generated_images
ADD COLUMN IF NOT EXISTS is_favourite BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'quick-pick',
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS title TEXT;

-- Create index for faster favourite lookups
CREATE INDEX IF NOT EXISTS idx_user_generated_images_favourite 
ON user_generated_images(user_id, is_favourite) 
WHERE is_favourite = true;

-- Create index for source filtering
CREATE INDEX IF NOT EXISTS idx_user_generated_images_source 
ON user_generated_images(user_id, source);

-- Create table for user image defaults (for templates like newsletters, posters)
CREATE TABLE IF NOT EXISTS user_image_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,
  image_id UUID REFERENCES user_generated_images(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, template_type)
);

-- Enable RLS on user_image_defaults
ALTER TABLE user_image_defaults ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_image_defaults
CREATE POLICY "Users can view their own image defaults"
ON user_image_defaults FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own image defaults"
ON user_image_defaults FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own image defaults"
ON user_image_defaults FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own image defaults"
ON user_image_defaults FOR DELETE
USING (auth.uid() = user_id);