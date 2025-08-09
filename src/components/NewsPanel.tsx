import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, ExternalLink, Filter, Clock, MapPin, Tag } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  url: string;
  source: string;
  published_at: string;
  relevance_score?: number;
  tags: string[];
  created_at: string;
  image_url?: string;
}

const NewsPanel = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [fullContent, setFullContent] = useState<string>('');
  const [loadingFullContent, setLoadingFullContent] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'full'>('summary');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('all');

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(20);

      if (error) throw error;

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

  const fetchFullArticle = async (article: NewsArticle) => {
    setLoadingFullContent(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-gp-news', {
        body: { 
          mode: 'full_article', 
          url: article.url,
          title: article.title 
        }
      });
      
      if (error) throw error;
      
      setFullContent(data.content || 'Unable to fetch full article content.');
    } catch (error) {
      console.error('Error fetching full article:', error);
      setFullContent('Unable to fetch full article content. Please visit the original source.');
    } finally {
      setLoadingFullContent(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatContent = (content: string) => {
    return content.split('\n\n').map((paragraph, index) => (
      <p key={index} className="mb-4 leading-relaxed">
        {paragraph}
      </p>
    ));
  };

  // Filter articles based on selected filters
  const filteredArticles = articles.filter(article => {
    if (filterTag !== 'all' && !article.tags.includes(filterTag)) return false;
    if (filterSource !== 'all' && article.source !== filterSource) return false;
    
    if (filterTime !== 'all') {
      const articleDate = new Date(article.published_at);
      const now = new Date();
      const diffHours = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
      
      if (filterTime === '24h' && diffHours > 24) return false;
      if (filterTime === '7d' && diffHours > 24 * 7) return false;
    }
    
    return true;
  });

  // Get unique tags and sources for filters
  const allTags = [...new Set(articles.flatMap(article => article.tags))];
  const allSources = [...new Set(articles.map(article => article.source))];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Latest NHS News</h2>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Latest NHS News</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshNews}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {allTags.map(tag => (
              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {allSources.map(source => (
              <SelectItem key={source} value={source}>{source}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTime} onValueChange={setFilterTime}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredArticles.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No news articles found with the current filters.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                setFilterTag('all');
                setFilterSource('all');
                setFilterTime('all');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map((article) => (
            <Card key={article.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span className="font-medium">{article.source}</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(article.published_at)}</span>
                  </div>
                </div>
                
                {article.image_url && (
                  <div className="w-full h-40 mb-3 overflow-hidden rounded-lg">
                    <img 
                      src={article.image_url} 
                      alt={article.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <CardTitle className="text-lg leading-tight">{article.title}</CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {article.summary}
                </p>
                
                <div className="flex flex-wrap gap-1">
                  {article.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {article.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{article.tags.length - 3}
                    </Badge>
                  )}
                </div>
                
                {article.relevance_score && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>Relevance: {article.relevance_score}%</span>
                  </div>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    setSelectedArticle(article);
                    setViewMode('summary');
                    setFullContent('');
                  }}
                >
                  Read More
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Article Detail Modal */}
      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl leading-tight">
              {selectedArticle?.title}
            </DialogTitle>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>{selectedArticle?.source}</span>
                <span>{selectedArticle && formatDate(selectedArticle.published_at)}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => selectedArticle && window.open(selectedArticle.url, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Original
              </Button>
            </div>
          </DialogHeader>
          
          {selectedArticle && (
            <div className="space-y-4">
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'summary' | 'full')}>
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="full">Full Article</TabsTrigger>
                </TabsList>
                
                <TabsContent value="summary" className="space-y-4">
                  {selectedArticle.image_url && (
                    <div className="w-full h-64 overflow-hidden rounded-lg">
                      <img 
                        src={selectedArticle.image_url} 
                        alt={selectedArticle.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="prose prose-sm max-w-none">
                    {formatContent(selectedArticle.content)}
                  </div>
                </TabsContent>
                
                <TabsContent value="full" className="space-y-4">
                  {!fullContent && !loadingFullContent && (
                    <div className="text-center py-8">
                      <Button 
                        onClick={() => fetchFullArticle(selectedArticle)}
                        disabled={loadingFullContent}
                      >
                        Load Full Article
                      </Button>
                    </div>
                  )}
                  
                  {loadingFullContent && (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  )}
                  
                  {fullContent && (
                    <div className="prose prose-sm max-w-none">
                      {formatContent(fullContent)}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewsPanel;