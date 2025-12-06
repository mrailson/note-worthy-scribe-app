import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronUp, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface LGPdfThumbnailPreviewProps {
  pdfUrl: string;
  totalPages?: number;
}

interface Thumbnail {
  pageNum: number;
  dataUrl: string;
}

export function LGPdfThumbnailPreview({ pdfUrl, totalPages = 0 }: LGPdfThumbnailPreviewProps) {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [selectedPage, setSelectedPage] = useState<Thumbnail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const INITIAL_PAGES = 5;
  const THUMBNAIL_SCALE = 0.3; // Low scale for fast thumbnails

  useEffect(() => {
    extractThumbnails();
  }, [pdfUrl]);

  const extractThumbnails = async () => {
    setLoading(true);
    setError(null);
    setThumbnails([]);
    setLoadingProgress(0);

    try {
      // Get signed URL
      const path = pdfUrl.replace('lg/', '');
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('lg')
        .createSignedUrl(path, 3600);

      if (signedUrlError) throw signedUrlError;
      if (!signedUrlData?.signedUrl) throw new Error('No signed URL received');

      // Load PDF
      const loadingTask = pdfjsLib.getDocument(signedUrlData.signedUrl);
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      const extractedThumbnails: Thumbnail[] = [];

      // Extract all pages progressively
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        extractedThumbnails.push({ pageNum: i, dataUrl });
        
        setThumbnails([...extractedThumbnails]);
        setLoadingProgress(Math.round((i / numPages) * 100));
      }

      setLoading(false);
    } catch (err) {
      console.error('Thumbnail extraction error:', err);
      setError('Failed to load preview');
      setLoading(false);
    }
  };

  const visibleThumbnails = expanded ? thumbnails : thumbnails.slice(0, INITIAL_PAGES);
  const hiddenCount = thumbnails.length - INITIAL_PAGES;
  const hasMore = thumbnails.length > INITIAL_PAGES;

  if (error) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">Quick Preview</span>
        {loading && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {loadingProgress}%
          </span>
        )}
      </div>

      {/* Thumbnail Grid */}
      <div className="flex flex-wrap gap-2">
        {visibleThumbnails.map((thumb) => (
          <button
            key={thumb.pageNum}
            onClick={() => setSelectedPage(thumb)}
            className="relative group focus:outline-none focus:ring-2 focus:ring-primary rounded-md overflow-hidden"
          >
            <div className="w-20 h-28 bg-muted rounded-md overflow-hidden border border-border hover:border-primary transition-colors">
              <img
                src={thumb.dataUrl}
                alt={`Page ${thumb.pageNum}`}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-0.5 text-center">
              {thumb.pageNum}
            </div>
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <ZoomIn className="h-5 w-5 text-white drop-shadow-lg" />
            </div>
          </button>
        ))}

        {/* Loading skeleton for remaining */}
        {loading && thumbnails.length < (expanded ? (totalPages || 10) : INITIAL_PAGES) && (
          <>
            {Array.from({ length: Math.min(3, INITIAL_PAGES - thumbnails.length) }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="w-20 h-28 bg-muted rounded-md animate-pulse flex items-center justify-center"
              >
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              </div>
            ))}
          </>
        )}

        {/* Show more badge */}
        {!expanded && hasMore && !loading && (
          <button
            onClick={() => setExpanded(true)}
            className="w-20 h-28 bg-muted/50 border border-dashed border-border rounded-md flex flex-col items-center justify-center text-muted-foreground hover:bg-muted hover:border-primary transition-colors"
          >
            <span className="text-lg font-semibold">+{hiddenCount}</span>
            <span className="text-xs">more</span>
          </button>
        )}
      </div>

      {/* Expand/Collapse button */}
      {hasMore && !loading && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 text-muted-foreground"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Show Less
            </>
          ) : (
            `Show All ${thumbnails.length} Pages`
          )}
        </Button>
      )}

      {/* Enlarged view dialog - nearly fullscreen */}
      <Dialog open={!!selectedPage} onOpenChange={() => setSelectedPage(null)}>
        <DialogContent className="!max-w-[95vw] !w-[95vw] !h-[95vh] !max-h-[95vh] p-0 flex flex-col">
          {selectedPage && (
            <>
              {/* Thumbnail strip at top */}
              <div className="flex-shrink-0 border-b bg-muted/50 p-2 overflow-x-auto">
                <div className="flex gap-2 justify-center min-w-max">
                  {thumbnails.map((thumb) => (
                    <button
                      key={thumb.pageNum}
                      onClick={() => setSelectedPage(thumb)}
                      className={`relative flex-shrink-0 rounded overflow-hidden border-2 transition-all ${
                        thumb.pageNum === selectedPage.pageNum
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <img
                        src={thumb.dataUrl}
                        alt={`Page ${thumb.pageNum}`}
                        className="w-12 h-16 object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center">
                        {thumb.pageNum}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main image area */}
              <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden bg-muted/20">
                <div className="text-sm text-muted-foreground mb-2">
                  Page {selectedPage.pageNum} of {thumbnails.length}
                </div>
                <div className="flex-1 flex items-center justify-center overflow-auto w-full">
                  <img
                    src={selectedPage.dataUrl}
                    alt={`Page ${selectedPage.pageNum}`}
                    className="max-w-full max-h-full object-contain rounded-md border shadow-lg"
                    style={{ maxHeight: 'calc(95vh - 140px)' }}
                  />
                </div>
                <div className="flex gap-2 mt-4 flex-shrink-0">
                  <Button
                    variant="outline"
                    disabled={selectedPage.pageNum === 1}
                    onClick={() => {
                      const prev = thumbnails.find(t => t.pageNum === selectedPage.pageNum - 1);
                      if (prev) setSelectedPage(prev);
                    }}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selectedPage.pageNum === thumbnails.length}
                    onClick={() => {
                      const next = thumbnails.find(t => t.pageNum === selectedPage.pageNum + 1);
                      if (next) setSelectedPage(next);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
