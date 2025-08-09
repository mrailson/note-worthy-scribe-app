-- First, create the news_articles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  relevance_score INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Clear all existing fake articles
DELETE FROM public.news_articles;

-- Enable RLS
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read news articles
CREATE POLICY "Anyone can read news articles" ON public.news_articles
  FOR SELECT USING (true);

-- Create policy to allow edge functions to insert news articles
CREATE POLICY "Service role can manage news articles" ON public.news_articles
  FOR ALL USING (auth.role() = 'service_role');