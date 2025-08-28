-- Add admin news management columns to news_articles table
ALTER TABLE public.news_articles 
ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_headline boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS start_date timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS end_date timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_news_articles_published_dates ON public.news_articles (is_published, start_date, end_date, is_headline);
CREATE INDEX IF NOT EXISTS idx_news_articles_custom ON public.news_articles (is_custom);

-- Update RLS policies for admin management
DROP POLICY IF EXISTS "Authenticated users can view news articles" ON public.news_articles;

-- Allow authenticated users to view published articles within date range
CREATE POLICY "Users can view published news articles" ON public.news_articles
FOR SELECT 
USING (
  is_published = true 
  AND start_date <= now() 
  AND (end_date IS NULL OR end_date >= now())
);

-- Allow system admins to manage all news articles
CREATE POLICY "System admins can manage all news articles" ON public.news_articles
FOR ALL 
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));

-- Allow system to insert fetched news articles
CREATE POLICY "System can insert fetched news" ON public.news_articles
FOR INSERT
WITH CHECK (is_custom = false OR is_system_admin(auth.uid()));