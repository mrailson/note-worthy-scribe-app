-- Delete all existing fake articles
DELETE FROM news_articles;

-- Add a constraint to prevent fake articles
ALTER TABLE news_articles 
ADD CONSTRAINT check_real_url 
CHECK (url IS NOT NULL AND url != '' AND url LIKE 'https://%');