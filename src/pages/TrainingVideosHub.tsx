import React, { useState, useRef, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Video, Clock, Play } from 'lucide-react';
import { trainingVideos, CATEGORIES } from '@/data/trainingVideos';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const getEmbedUrl = (url: string) =>
  url.replace('/share/', '/embed/');

const isValidLoomUrl = (url: string) =>
  /loom\.com\/(share|embed)\/[a-zA-Z0-9]+/.test(url) && !url.includes('example');

const TrainingVideosHub = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isMobile = useIsMobile();

  const filtered = useMemo(() => {
    if (!search.trim()) return trainingVideos;
    const q = search.toLowerCase();
    return trainingVideos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q)
    );
  }, [search]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const cat of CATEGORIES) {
      const vids = filtered.filter((v) => v.category === cat);
      if (vids.length > 0) map.set(cat, vids);
    }
    return map;
  }, [filtered]);

  const scrollTo = (cat: string) => {
    setActiveCategory(cat);
    sectionRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const visibleCategories = Array.from(groupedByCategory.keys());

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Video className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Training Videos</h1>
          </div>
          <p className="text-muted-foreground text-sm mb-4">
            Short how-to videos to help you get the most out of Notewell AI.
          </p>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search videos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar / Category Nav */}
          {!isMobile && visibleCategories.length > 1 && (
            <aside className="w-48 shrink-0 sticky top-20 self-start">
              <nav className="space-y-1">
                {visibleCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => scrollTo(cat)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      activeCategory === cat
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </nav>
            </aside>
          )}

          {/* Mobile category tabs */}
          {isMobile && visibleCategories.length > 1 && (
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-background border-t px-2 py-2 overflow-x-auto flex gap-2 no-scrollbar">
              {visibleCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => scrollTo(cat)}
                  className={cn(
                    'whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0',
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Video Grid */}
          <div className="flex-1 space-y-8 pb-16 md:pb-0">
            {visibleCategories.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg font-medium">No videos found</p>
                <p className="text-sm">Try a different search term.</p>
              </div>
            )}

            {visibleCategories.map((cat) => (
              <section
                key={cat}
                id={`cat-${cat.replace(/\s+/g, '-').toLowerCase()}`}
                ref={(el: HTMLDivElement | null) => { sectionRefs.current[cat] = el; }}
                className="scroll-mt-24"
              >
                <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  {cat}
                  <Badge variant="secondary" className="text-xs">
                    {groupedByCategory.get(cat)!.length}
                  </Badge>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedByCategory.get(cat)!.map((video) => (
                    <Card key={video.id} className="overflow-hidden">
                      <AspectRatio ratio={16 / 9}>
                        {isValidLoomUrl(video.loomUrl) ? (
                          <iframe
                            src={getEmbedUrl(video.loomUrl)}
                            title={video.title}
                            allowFullScreen
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex flex-col items-center justify-center text-muted-foreground">
                            <Play className="h-10 w-10 mb-2 opacity-40" />
                            <p className="text-xs">Video coming soon</p>
                          </div>
                        )}
                      </AspectRatio>
                      <CardContent className="pt-3">
                        <h3 className="font-medium text-foreground text-sm mb-1">
                          {video.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {video.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {video.duration}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {video.category}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TrainingVideosHub;
