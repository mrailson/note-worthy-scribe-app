-- Allow public (unauthenticated) users to view published news articles
CREATE POLICY "Anyone can view published news articles"
ON public.news_articles
FOR SELECT
USING (is_published = true);