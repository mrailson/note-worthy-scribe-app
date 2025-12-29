import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  image_url: string | null;
  published_at: string;
}

export const NewsTicker = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      const { data, error } = await supabase
        .from('news_articles')
        .select('id, title, source, url, image_url, published_at')
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
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
      {/* Header Label */}
      <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center gap-2 px-4 sm:px-5 bg-primary text-primary-foreground font-semibold text-sm whitespace-nowrap">
        <Newspaper className="h-4 w-4" />
        <span className="hidden sm:inline">GP News</span>
      </div>

      {/* Ticker content */}
      <div className="py-3 sm:py-4 pl-14 sm:pl-32 pr-4 overflow-hidden">
        <div className="animate-ticker flex items-center gap-8 sm:gap-10 hover:[animation-play-state:paused]">
          {duplicatedArticles.map((article, index) => (
            <a
              key={`${article.id}-${index}`}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 sm:gap-4 shrink-0 group py-1"
            >
              {/* Thumbnail */}
              {article.image_url && (
                <div className="relative h-12 w-16 sm:h-14 sm:w-20 rounded-lg overflow-hidden shrink-0 border border-border/30">
                  <img
                    src={article.image_url}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                  />
                </div>
              )}
              
              {/* Content */}
              <div className="flex flex-col gap-1 min-w-0 max-w-[280px] sm:max-w-[350px]">
                <span className="text-sm sm:text-base font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                  {article.title}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="px-2 py-0.5 rounded-full bg-muted font-medium">
                    {article.source}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(article.published_at), { addSuffix: true })}
                  </span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              
              {/* Separator */}
              <span className="text-muted-foreground/30 text-2xl mx-4 sm:mx-6">|</span>
            </a>
          ))}
        </div>
      </div>

      {/* Gradient fade edges */}
      <div className="absolute left-28 sm:left-32 top-0 bottom-0 w-12 bg-gradient-to-r from-card/80 to-transparent pointer-events-none z-[5]" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-card/80 to-transparent pointer-events-none" />
    </div>
  );
};
