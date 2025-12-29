import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  published_at: string;
}

export const NewsTicker = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      const { data, error } = await supabase
        .from('news_articles')
        .select('id, title, source, url, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setArticles(data);
      }
      setIsLoading(false);
    };

    fetchNews();
  }, []);

  if (isLoading || articles.length === 0) {
    return null;
  }

  // Duplicate articles for seamless infinite scroll
  const duplicatedArticles = [...articles, ...articles];

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm">
      {/* Label */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center gap-2 px-3 sm:px-4 bg-primary text-primary-foreground font-semibold text-xs sm:text-sm whitespace-nowrap">
        <Newspaper className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">GP News</span>
      </div>

      {/* Ticker content */}
      <div className="py-2.5 sm:py-3 pl-12 sm:pl-28 pr-4 overflow-hidden">
        <div className="animate-ticker flex items-center gap-6 sm:gap-8 hover:[animation-play-state:paused]">
          {duplicatedArticles.map((article, index) => (
            <a
              key={`${article.id}-${index}`}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 sm:gap-3 shrink-0 group"
            >
              <span className="text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1 max-w-[200px] sm:max-w-none">
                {article.title}
              </span>
              <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                {article.source}
              </span>
              <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              <span className="text-muted-foreground/50 mx-2 sm:mx-4">•</span>
            </a>
          ))}
        </div>
      </div>

      {/* Gradient fade edges */}
      <div className="absolute left-24 sm:left-28 top-0 bottom-0 w-8 bg-gradient-to-r from-card/50 to-transparent pointer-events-none z-[5]" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-card/50 to-transparent pointer-events-none" />
    </div>
  );
};
