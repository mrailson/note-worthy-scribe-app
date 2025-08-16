import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Filter, Clock, MapPin, Tag, RefreshCw, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";

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

// Decode common HTML entities and numeric codes
const decodeEntities = (input: string) => {
  if (!input) return '';
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&(lsquo|rsquo);/g, "'")
    .replace(/&(ldquo|rdquo);/g, '"')
    .replace(/&hellip;/g, '…')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—');
};

// Northamptonshire-first prioritization
const localKeywords = [
  'northamptonshire','northampton','northants','kettering','corby','daventry','wellingborough','towcester','rushden','nene',
  'nhft','northamptonshire icb','icb northamptonshire','integrated care northamptonshire','nhs northamptonshire',
  'ngh','kgh','kettering general','northampton general','bbc northamptonshire','northants live',
  'west northamptonshire','north northamptonshire'
];

const healthKeywords = [
  'nhs','gp','general practice','practice manager','primary care','pcn','ics','icb',
  'nhft','mental health','hospital','northampton general','kettering general','ngh','kgh',
  'vaccin','immunis','flu','covid','measles','pharmacy','pharmacist','prescription',
  'dental','dentist','urgent care','a&e','emergency department','cqc','midwife','maternity',
  'health centre','clinic','surgery','surgeries','public health'
];

const isLocalArticle = (a: NewsArticle) => {
  const hay = `${a.title} ${a.summary} ${a.source} ${a.url}`.toLowerCase();
  return localKeywords.some(k => hay.includes(k));
};

// Health-related helpers to tighten local filtering
const isHealthRelated = (a: NewsArticle) => {
  const hay = `${a.title} ${a.summary} ${a.content}`.toLowerCase();
  return healthKeywords.some(k => hay.includes(k));
};
const isHealthRelatedByTags = (a: NewsArticle) => {
  const tags = (a.tags || []).map(t => String(t).toLowerCase());
  return healthKeywords.some(k => tags.some(t => t.includes(k))) || tags.includes('health');
};
const isHealthRelatedByUrl = (a: NewsArticle) => {
  const u = (a.url || '').toLowerCase();
  return healthKeywords.some(k => u.includes(k)) || u.includes('/health');
};

const NewsPanel = ({ showFiltersInHeader = false, onClose }: { showFiltersInHeader?: boolean; onClose?: () => void }) => {
  const isMobile = useIsMobile();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [fullContent, setFullContent] = useState<string>('');
  const [loadingFullContent, setLoadingFullContent] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'full'>('summary');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('all');
  
  // News source toggles
  const [showLocal, setShowLocal] = useState(true);
  const [showBBCHealth, setShowBBCHealth] = useState(true);
  const [showPulseNews, setShowPulseNews] = useState(true);
  const fetchNews = async () => {
    try {
      console.log('Fetching news articles...');
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(40);

      console.log('Fetch result:', { data, error });

      if (error) throw error;

      console.log('Setting articles:', data?.length || 0, 'articles');
      setArticles((data || []).map(a => ({
        ...a,
        title: decodeEntities(a.title),
        summary: decodeEntities(a.summary),
        content: decodeEntities(a.content),
      })));

    } catch (error) {
      console.error('Error fetching news:', error);
      toast.error('Failed to load news articles');
    } finally {
      setLoading(false);
    }
  };

  const refreshNews = async () => {
    try {
      setRefreshing(true);
      setLoading(true);
      const { error } = await supabase.functions.invoke('fetch-gp-news', { body: {} });
      if (error) throw error;
      toast.success('Latest news loaded');
    } catch (error) {
      console.error('Error refreshing news:', error);
      toast.error('Failed to refresh news');
    } finally {
      await fetchNews();
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
      
      setFullContent(decodeEntities(data.content || 'Unable to fetch full article content.'));
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
    // Apply news source toggles
    const isLocal = isLocalArticle(article);
    const isBBCHealth = article.source.toLowerCase().includes('bbc') && (isHealthRelated(article) || isHealthRelatedByTags(article) || isHealthRelatedByUrl(article));
    const isPulse = article.source.toLowerCase().includes('pulse');
    
    if (isLocal && !showLocal) return false;
    if (isBBCHealth && !showBBCHealth) return false;
    if (isPulse && !showPulseNews) return false;
    
    // Front view should only show articles with images, except allow local Northamptonshire items without images
    if ((!article.image_url || !article.image_url.trim()) && !isLocalArticle(article)) return false;
    if (filterTag !== 'all' && !article.tags.includes(filterTag)) return false;
    if (filterSource !== 'all' && article.source !== filterSource) return false;
    
    if (filterTime !== 'all') {
      const articleDate = new Date(article.published_at);
      const now = new Date();
      const diffHours = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
      
      if (filterTime === '24h' && diffHours > 24) return false;
      if (filterTime === '7d' && diffHours > 24 * 7) return false;
    }

    // Restrict local items to NHS/GP/health-related only
    if (isLocalArticle(article)) {
      if (article.source === 'Northampton Chronicle & Echo') {
        if (!(isHealthRelated(article) || isHealthRelatedByUrl(article) || isHealthRelatedByTags(article))) return false;
      } else {
        if (!isHealthRelated(article)) return false;
      }
    }
    
    return true;
  });

  // Use strictly filtered list to avoid leaking unrelated local items
  const displayedArticles = filteredArticles;
  
  // Prioritize Northamptonshire-related articles to the top, then by date desc
  const prioritizedArticles = [...displayedArticles].sort((a, b) => {
    const al = isLocalArticle(a) ? 1 : 0;
    const bl = isLocalArticle(b) ? 1 : 0;
    if (al !== bl) return bl - al;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
  
  // Get unique tags and sources for filters
  const allTags = [...new Set(articles.flatMap(article => article.tags))];
  const allSources = [...new Set(articles.map(article => article.source))];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
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

  const FilterControls = () => (
    <div className="flex gap-2">
      {/* Mobile: open filters in a drawer */}
      <div className="sm:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Filters</DrawerTitle>
              <DrawerDescription>Refine your news feed</DrawerDescription>
            </DrawerHeader>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Tag</div>
                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Source</div>
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {allSources.map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Time</div>
                <Select value={filterTime} onValueChange={setFilterTime}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="24h">Last 24h</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <DrawerClose asChild>
                  <Button variant="default" className="flex-1">Apply</Button>
                </DrawerClose>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => { setFilterTag('all'); setFilterSource('all'); setFilterTime('all'); }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop: toggle filters button */}
      <div className="hidden sm:block">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>
    </div>
  );

  if (showFiltersInHeader) {
    // Return just the filter controls for header rendering
    return <FilterControls />;
  }

  return (
    <div>
      {/* Mobile Close Header */}
      {isMobile && onClose && (
        <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
          <h2 className="text-lg font-semibold">GP News</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* News Source Toggles */}
      <div className={`${isMobile ? 'mx-4 mt-4' : ''} mb-6 p-4 bg-muted/10 rounded-lg border`}>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">News Sources</h3>
        <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'flex-wrap'} gap-4`}>
          <div className="flex items-center space-x-2">
            <Switch
              id="local-toggle"
              checked={showLocal}
              onCheckedChange={setShowLocal}
            />
            <label 
              htmlFor="local-toggle" 
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <MapPin className="w-4 h-4 text-blue-500" />
              Local News
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="bbc-health-toggle"
              checked={showBBCHealth}
              onCheckedChange={setShowBBCHealth}
            />
            <label 
              htmlFor="bbc-health-toggle" 
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <div className="w-4 h-4 bg-red-500 rounded text-white text-[8px] font-bold flex items-center justify-center">
                B
              </div>
              BBC Health
            </label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="pulse-toggle"
              checked={showPulseNews}
              onCheckedChange={setShowPulseNews}
            />
            <label 
              htmlFor="pulse-toggle" 
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              </div>
              Pulse News
            </label>
          </div>
        </div>
      </div>

      {/* Desktop filters - collapsible */}
      {showFilters && (
        <div className="hidden sm:flex flex-wrap gap-3 p-3 bg-muted/20 rounded-lg mb-4">
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

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => { setFilterTag('all'); setFilterSource('all'); setFilterTime('all'); }}
          >
            Clear All
          </Button>
        </div>
      )}

      {articles.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 01-2-2V9a2 2 0 00-2-2h-2m-2 13h2v-4a2 2 0 00-2-2h-2v-4a2 2 0 012-2h2V7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">No NHS news articles available</h3>
            <p className="text-sm mb-4">Please check back later.</p>
          </CardContent>
        </Card>
      ) : (
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1 mx-4' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
          {prioritizedArticles.map((article) => (
            <Card key={article.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{article.source}</span>
                    {isLocalArticle(article) && (
                      <Badge variant="overview" className="text-[10px]">Local</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(article.published_at)}</span>
                  </div>
                </div>
                
                {article.image_url && (
                  <div className="w-full h-40 mb-3 overflow-hidden rounded-lg bg-muted">
                    <img 
                      src={article.image_url} 
                      alt={article.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = `
                          <div class="w-full h-full flex items-center justify-center text-muted-foreground">
                            <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 01-2-2V9a2 2 0 00-2-2h-2m-2 13h2v-4a2 2 0 00-2-2h-2v-4a2 2 0 012-2h2V7" />
                            </svg>
                          </div>
                        `;
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
                  asChild
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                >
                  <a href={article.url} target="_blank" rel="noopener noreferrer">
                    Read More
                  </a>
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
                  {selectedArticle?.image_url && (
                    <div className="w-full h-64 overflow-hidden rounded-lg">
                      <img
                        src={selectedArticle.image_url}
                        alt={selectedArticle.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  )}
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