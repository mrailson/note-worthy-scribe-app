-- Create table for storing news articles
CREATE TABLE IF NOT EXISTS public.news_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  url TEXT,
  image_url TEXT,
  source TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  relevance_score INTEGER DEFAULT 0,
  location TEXT DEFAULT 'Northamptonshire',
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Create policy to allow reading news articles
CREATE POLICY "News articles are viewable by authenticated users" 
ON public.news_articles 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create policy for system to insert/update news
CREATE POLICY "System can manage news articles" 
ON public.news_articles 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON public.news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_relevance ON public.news_articles(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_location ON public.news_articles(location);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_news_articles_updated_at
BEFORE UPDATE ON public.news_articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();