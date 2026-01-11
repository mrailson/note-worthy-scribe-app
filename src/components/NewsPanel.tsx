// NewsPanel component for displaying and filtering GP news articles
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Filter, Clock, MapPin, Tag, RefreshCw, Activity, Radio, AlertTriangle, Building2, Globe, Newspaper, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

type NewsCategory = 'all' | 'nhs-policy' | 'local' | 'alerts';

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

// Category definitions for filtering
const nhsPolicySources = new Set([
  'NHS England', 'NHS England News', 'DHSC', 'NICE Guidance', 'NICE News', 'NICE', 
  'Pulse Today', 'BBC Health', 'The Guardian Health'
]);
const alertSources = new Set(['MHRA Alerts', 'MHRA']);

const isAlertArticle = (article: NewsArticle) => {
  return alertSources.has(article.source) || article.tags.includes('ALERT');
};

const isNhsPolicyArticle = (article: NewsArticle) => {
  return nhsPolicySources.has(article.source) && !isAlertArticle(article);
};

const NewsPanel = ({ showFiltersInHeader = false, cleanView = false }: { showFiltersInHeader?: boolean; cleanView?: boolean }) => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeCategory, setActiveCategory] = useState<NewsCategory>('all');
  
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [fullContent, setFullContent] = useState<string>('');
  const [loadingFullContent, setLoadingFullContent] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'full'>('summary');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('all');
  
  // Quick toggle states
  const [showLocal, setShowLocal] = useState(() => {
    const saved = localStorage.getItem('newsPanel-showLocal');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [healthcareLocalOnly, setHealthcareLocalOnly] = useState(() => {
    const saved = localStorage.getItem('newsPanel-healthcareLocalOnly');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [pulseEnabled, setPulseEnabled] = useState(() => {
    const saved = localStorage.getItem('newsPanel-pulseEnabled');
    return saved !== null ? JSON.parse(saved) : false;
  });
  
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  const fetchNews = async () => {
    try {
      console.log('Fetching news articles...');
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(60);

      console.log('Fetch result:', { data, error });

      if (error) throw error;

      console.log('Setting articles:', data?.length || 0, 'articles');
      setArticles((data || []).map(a => ({
        ...a,
        title: decodeEntities(a.title),
        summary: decodeEntities(a.summary),
        content: decodeEntities(a.content),
      })));
      setLastUpdated(new Date());

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
      setLastUpdated(new Date());
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

  // Auto-refresh functionality
  const startAutoRefresh = useCallback(() => {
    if (autoRefreshInterval.current) {
      clearInterval(autoRefreshInterval.current);
    }
    
    if (pulseEnabled) {
      autoRefreshInterval.current = setInterval(() => {
        refreshNews();
      }, 300000); // 5 minutes
    }
  }, [pulseEnabled]);

  // Persist toggle states to localStorage
  useEffect(() => {
    localStorage.setItem('newsPanel-showLocal', JSON.stringify(showLocal));
  }, [showLocal]);
  
  useEffect(() => {
    localStorage.setItem('newsPanel-healthcareLocalOnly', JSON.stringify(healthcareLocalOnly));
  }, [healthcareLocalOnly]);
  
  useEffect(() => {
    localStorage.setItem('newsPanel-pulseEnabled', JSON.stringify(pulseEnabled));
    startAutoRefresh();
    
    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, [pulseEnabled, startAutoRefresh]);

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

  // Filter articles based on selected filters, toggles, and category
  const filteredArticles = articles.filter(article => {
    const isLocal = isLocalArticle(article);
    const isAlert = isAlertArticle(article);
    const isNhsPolicy = isNhsPolicyArticle(article);
    
    // Category filter
    if (activeCategory === 'alerts' && !isAlert) return false;
    if (activeCategory === 'local' && !isLocal) return false;
    if (activeCategory === 'nhs-policy' && !isNhsPolicy) return false;
    
    // Local toggle: if showLocal is false, exclude all local articles (unless in local category)
    if (!showLocal && isLocal && activeCategory !== 'local') return false;
    
    // Front view should only show articles with images, except allow local Northamptonshire items and alerts without images
    if ((!article.image_url || !article.image_url.trim()) && !isLocal && !isAlert) return false;
    
    if (filterTag !== 'all' && !article.tags.includes(filterTag)) return false;
    if (filterSource !== 'all' && article.source !== filterSource) return false;
    
    if (filterTime !== 'all') {
      const articleDate = new Date(article.published_at);
      const now = new Date();
      const diffHours = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
      
      if (filterTime === '24h' && diffHours > 24) return false;
      if (filterTime === '7d' && diffHours > 24 * 7) return false;
    }

    // Healthcare Local toggle: if enabled, restrict local items to NHS/GP/health-related only
    if (isLocal && healthcareLocalOnly) {
      if (article.source === 'Northampton Chronicle & Echo') {
        if (!(isHealthRelated(article) || isHealthRelatedByUrl(article) || isHealthRelatedByTags(article))) return false;
      } else {
        if (!isHealthRelated(article)) return false;
      }
    }
    
    return true;
  });

  // Get alert articles for the banner (always shown regardless of category)
  const alertArticles = articles.filter(isAlertArticle).slice(0, 3);

  // Use strictly filtered list to avoid leaking unrelated local items
  const displayedArticles = filteredArticles;
  
  // Prioritize Northamptonshire-related articles to the top, then alerts, then by date desc
  const prioritizedArticles = [...displayedArticles].sort((a, b) => {
    // Alerts first when not in alerts category
    if (activeCategory !== 'alerts') {
      const aAlert = isAlertArticle(a) ? 1 : 0;
      const bAlert = isAlertArticle(b) ? 1 : 0;
      if (aAlert !== bAlert) return bAlert - aAlert;
    }
    
    // Then local articles
    const al = isLocalArticle(a) ? 1 : 0;
    const bl = isLocalArticle(b) ? 1 : 0;
    if (al !== bl) return bl - al;
    
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
  
  // Get unique tags and sources for filters
  const allTags = [...new Set(articles.flatMap(article => article.tags))];
  const allSources = [...new Set(articles.map(article => article.source))];

  // Category counts
  const categoryCounts = {
    all: articles.length,
    'nhs-policy': articles.filter(isNhsPolicyArticle).length,
    local: articles.filter(isLocalArticle).length,
    alerts: articles.filter(isAlertArticle).length,
  };

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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refreshNews()}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Loading...' : 'Refresh'}
            </Button>
            <FilterControls />
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

  // Alerts Banner Component
  const AlertsBanner = () => {
    if (alertArticles.length === 0 || activeCategory === 'alerts') return null;
    
    return (
      <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            MHRA Alerts & Safety Notices
          </span>
          <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
            {alertArticles.length} new
          </Badge>
        </div>
        <div className="space-y-1">
          {alertArticles.map(alert => (
            <a 
              key={alert.id}
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 hover:underline truncate"
            >
              • {alert.title}
            </a>
          ))}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="mt-2 text-xs text-amber-700 dark:text-amber-300"
          onClick={() => setActiveCategory('alerts')}
        >
          View all alerts →
        </Button>
      </div>
    );
  };

  // Category Tabs Component
  const CategoryTabs = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      <Button
        variant={activeCategory === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setActiveCategory('all')}
        className="gap-1.5"
      >
        <Newspaper className="w-3.5 h-3.5" />
        All
        <Badge variant="secondary" className="ml-1 text-xs">{categoryCounts.all}</Badge>
      </Button>
      <Button
        variant={activeCategory === 'nhs-policy' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setActiveCategory('nhs-policy')}
        className="gap-1.5"
      >
        <Building2 className="w-3.5 h-3.5" />
        NHS / Policy
        <Badge variant="secondary" className="ml-1 text-xs">{categoryCounts['nhs-policy']}</Badge>
      </Button>
      <Button
        variant={activeCategory === 'local' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setActiveCategory('local')}
        className="gap-1.5"
      >
        <MapPin className="w-3.5 h-3.5" />
        Local
        <Badge variant="secondary" className="ml-1 text-xs">{categoryCounts.local}</Badge>
      </Button>
      <Button
        variant={activeCategory === 'alerts' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setActiveCategory('alerts')}
        className={`gap-1.5 ${categoryCounts.alerts > 0 ? 'border-amber-400 dark:border-amber-600' : ''}`}
      >
        <AlertTriangle className={`w-3.5 h-3.5 ${categoryCounts.alerts > 0 ? 'text-amber-500' : ''}`} />
        Alerts
        {categoryCounts.alerts > 0 && (
          <Badge className="ml-1 text-xs bg-amber-500 text-white">{categoryCounts.alerts}</Badge>
        )}
      </Button>
    </div>
  );

  // Last Updated indicator
  const LastUpdatedIndicator = () => (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {lastUpdated && (
        <span>
          Updated: {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );

  const QuickToggleBar = () => (
    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/30 rounded-lg mb-4">
      <div className="flex flex-wrap gap-2">
        <ToggleGroup type="multiple" value={[
          ...(showLocal ? ['local'] : []),
          ...(healthcareLocalOnly ? ['healthcare'] : []),
          ...(pulseEnabled ? ['pulse'] : [])
        ]} onValueChange={(values) => {
          setShowLocal(values.includes('local'));
          setHealthcareLocalOnly(values.includes('healthcare'));
          setPulseEnabled(values.includes('pulse'));
        }} className="justify-start">
          <ToggleGroupItem
            value="local"
            className="text-xs gap-1"
          >
            <MapPin className="w-3 h-3" />
            Local
          </ToggleGroupItem>
          
          <ToggleGroupItem
            value="healthcare"
            disabled={!showLocal}
            className="text-xs gap-1"
          >
            <Tag className="w-3 h-3" />
            Healthcare Local
          </ToggleGroupItem>
          
          <ToggleGroupItem
            value="pulse"
            className="text-xs gap-1"
          >
            {pulseEnabled ? <Radio className="w-3 h-3 animate-pulse" /> : <Activity className="w-3 h-3" />}
            Auto-Refresh
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">
          {prioritizedArticles.length} articles
        </Badge>
        {pulseEnabled && (
          <Badge variant="secondary" className="text-xs animate-pulse">
            Live
          </Badge>
        )}
        <LastUpdatedIndicator />
      </div>
    </div>
  );

  if (showFiltersInHeader) {
    // Return just the filter controls for header rendering
    return <FilterControls />;
  }

  return (
    <div>
      {/* Header with Refresh and Filter Controls - hidden in cleanView */}
      {!cleanView && (
        <div className="flex items-center justify-between mb-4">
          <LastUpdatedIndicator />
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refreshNews()}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Loading...' : 'Refresh'}
            </Button>
            <FilterControls />
          </div>
        </div>
      )}

      {/* Category Tabs - hidden in cleanView */}
      {!cleanView && <CategoryTabs />}

      {/* Alerts Banner - shown when there are alerts and not in alerts category */}
      {!cleanView && <AlertsBanner />}

      {/* Quick Toggle Bar - hidden in cleanView */}
      {!cleanView && <QuickToggleBar />}

      {/* Desktop filters - collapsible - hidden in cleanView */}
      {showFilters && !cleanView && (
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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