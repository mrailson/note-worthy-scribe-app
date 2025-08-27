-- Create user_generated_images table for image gallery
CREATE TABLE public.user_generated_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  prompt text NOT NULL,
  detailed_prompt text,
  quick_pick_id text,
  alt_text text,
  image_settings jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_generated_images ENABLE ROW LEVEL SECURITY;

-- Users can only access their own generated images
CREATE POLICY "Users can view their own generated images" 
ON public.user_generated_images 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generated images" 
ON public.user_generated_images 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated images" 
ON public.user_generated_images 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated images" 
ON public.user_generated_images 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_user_generated_images_user_id_created_at 
ON public.user_generated_images(user_id, created_at DESC);