import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, ExternalLink, Tag, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  image_url?: string;
  source: string;
  published_at: string;
  relevance_score: number;
  tags: string[];
  created_at: string;
}

export const NewsPanel = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('relevance_score', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching news:', error);
        toast.error('Failed to load news articles');
        return;
      }

      setArticles(data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
      toast.error('Failed to load news articles');
    } finally {
      setLoading(false);
    }
  };

  const refreshNews = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('fetch-gp-news');
      
      if (error) {
        console.error('Error refreshing news:', error);
        toast.error('Failed to refresh news');
        return;
      }

      toast.success('News updated successfully');
      await fetchNews();
    } catch (error) {
      console.error('Error refreshing news:', error);
      toast.error('Failed to refresh news');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return `Today, ${format(date, 'HH:mm')}`;
    } else if (isYesterday(date)) {
      return `Yesterday, ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'dd MMM yyyy, HH:mm');
    }
  };


  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Latest GP Practice News</h3>
          <Skeleton className="h-9 w-24" />
        </div>
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="w-full">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-20 w-32 rounded-lg" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Latest GP Practice News</h3>
        <Button 
          onClick={refreshNews} 
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {articles.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p>No news articles available. Click refresh to load the latest news.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <Card key={article.id} className="w-full hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {article.source}
                      </Badge>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDate(article.published_at)}
                      </div>
                    </div>
                    
                    <CardTitle className="text-lg leading-tight hover:text-primary cursor-pointer"
                      onClick={() => setSelectedArticle(article)}>
                      {article.title}
                    </CardTitle>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {article.summary}
                    </p>
                    
                    {article.tags && article.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        {article.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {article.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{article.tags.length - 3} more</span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 pt-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedArticle(article)}
                          >
                            Read More
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle className="text-xl leading-tight pr-8">
                              {selectedArticle?.title}
                            </DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="max-h-[60vh]">
                            <div className="space-y-4">
                              {selectedArticle?.image_url && (
                                <img 
                                  src={selectedArticle.image_url} 
                                  alt={selectedArticle.title}
                                  className="w-full h-48 object-cover rounded-lg"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              )}
                              
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline">
                                  {selectedArticle?.source}
                                </Badge>
                                <div className="flex items-center text-sm text-muted-foreground">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {selectedArticle && formatDate(selectedArticle.published_at)}
                                </div>
                              </div>
                              
                              <div className="prose prose-sm max-w-none">
                                <p className="text-base font-medium text-muted-foreground">
                                  {selectedArticle?.summary}
                                </p>
                                <div className="mt-4 whitespace-pre-wrap">
                                  {selectedArticle?.content}
                                </div>
                              </div>
                              
                              {selectedArticle?.tags && selectedArticle.tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap pt-4 border-t">
                                  <Tag className="h-4 w-4 text-muted-foreground" />
                                  {selectedArticle.tags.map((tag, index) => (
                                    <Badge key={index} variant="secondary">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              
                              {selectedArticle?.url && (
                                <div className="pt-4 border-t">
                                  <Button 
                                    variant="outline" 
                                    asChild
                                    className="w-full"
                                  >
                                    <a 
                                      href={selectedArticle.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      Read Original Article
                                    </a>
                                  </Button>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                      
                      {article.url && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          asChild
                        >
                          <a 
                            href={article.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Source
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {article.image_url && (
                    <div className="flex-shrink-0">
                      <img 
                        src={article.image_url} 
                        alt={article.title}
                        className="w-32 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedArticle(article)}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};