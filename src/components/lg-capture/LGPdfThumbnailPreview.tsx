import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronUp, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
  const [zoomLevel, setZoomLevel] = useState(1);

  const INITIAL_PAGES = 5;
  const THUMBNAIL_SCALE = 1.5; // Higher scale for better quality when viewing enlarged

  useEffect(() => {
    extractThumbnails();
  }, [pdfUrl]);

  // Helper to find actual PDF path in storage (handles renamed files)
  const findActualPdfPath = async (storedUrl: string): Promise<string | null> => {
    try {
      const directPath = storedUrl.replace('lg/', '');
      
      // Try direct path first
      const { error: directError } = await supabase.storage
        .from('lg')
        .createSignedUrl(directPath, 60);
      
      if (!directError) {
        return directPath;
      }
      
      // Path not found - try listing the final folder
      // Extract practice_ods and patient_id from path
      const pathParts = directPath.split('/');
      if (pathParts.length >= 2) {
        const basePath = `${pathParts[0]}/${pathParts[1]}/final`;
        const { data: files, error: listError } = await supabase.storage
          .from('lg')
          .list(basePath, { limit: 20 });
        
        if (!listError && files) {
          const pdfFiles = files.filter(f => f.name.endsWith('.pdf') && !f.name.includes('compressed'));
          const targetFile = pdfFiles.find(f => f.name.startsWith('Lloyd_George')) || pdfFiles[0];
          
          if (targetFile) {
            return `${basePath}/${targetFile.name}`;
          }
        }
      }
      
      return null;
    } catch (err) {
      console.error('Error finding PDF path:', err);
      return null;
    }
  };

  const extractThumbnails = async () => {
    // Prevent re-running if already loaded for this URL
    if (thumbnails.length > 0) return;
    
    setLoading(true);
    setError(null);
    setThumbnails([]);
    setLoadingProgress(0);

    try {
      // Use smart path resolution like LGDownloadPanel
      const actualPath = await findActualPdfPath(pdfUrl);
      if (!actualPath) {
        throw new Error('Could not find PDF file');
      }

      // Get signed URL with longer expiry
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('lg')
        .createSignedUrl(actualPath, 3600);

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

      {/* Enlarged view dialog - thumbnails on left, zoom controls */}
      <Dialog open={!!selectedPage} onOpenChange={() => { setSelectedPage(null); setZoomLevel(1); }}>
        <DialogContent className="!max-w-[90vw] !w-[90vw] !h-[95vh] !max-h-[95vh] p-0 flex flex-row">
          {selectedPage && (
            <>
              {/* Thumbnail strip on left - vertical scrollable */}
              <div className="flex-shrink-0 w-24 border-r bg-muted/50 p-2 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                <div className="flex flex-col gap-2">
                  {thumbnails.map((thumb) => (
                    <button
                      key={thumb.pageNum}
                      onClick={() => { setSelectedPage(thumb); setZoomLevel(1); }}
                      className={`relative flex-shrink-0 rounded overflow-hidden border-2 transition-all ${
                        thumb.pageNum === selectedPage.pageNum
                          ? 'border-primary ring-2 ring-primary/30'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <img
                        src={thumb.dataUrl}
                        alt={`Page ${thumb.pageNum}`}
                        className="w-full h-auto object-contain"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] text-center py-0.5">
                        {thumb.pageNum}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main image area with zoom */}
              <div className="flex-1 flex flex-col min-w-0 min-h-0">
                {/* Toolbar */}
                <div className="flex-shrink-0 border-b bg-muted/30 px-4 py-2 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {selectedPage.pageNum} of {thumbnails.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoomLevel(z => Math.max(0.25, z - 0.25))}
                      disabled={zoomLevel <= 0.25}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground w-16 text-center">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
                      disabled={zoomLevel >= 3}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZoomLevel(1)}
                      disabled={zoomLevel === 1}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedPage.pageNum === 1}
                      onClick={() => {
                        const prev = thumbnails.find(t => t.pageNum === selectedPage.pageNum - 1);
                        if (prev) { setSelectedPage(prev); setZoomLevel(1); }
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedPage.pageNum === thumbnails.length}
                      onClick={() => {
                        const next = thumbnails.find(t => t.pageNum === selectedPage.pageNum + 1);
                        if (next) { setSelectedPage(next); setZoomLevel(1); }
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>

                {/* Scrollable image container */}
                <div className="flex-1 overflow-auto bg-muted/20 flex items-center justify-center p-4 min-h-0">
                  <img
                    src={selectedPage.dataUrl}
                    alt={`Page ${selectedPage.pageNum}`}
                    className="rounded-md border shadow-lg transition-transform"
                    style={{ 
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: 'center center',
                      maxWidth: zoomLevel <= 1 ? '100%' : 'none',
                      maxHeight: zoomLevel <= 1 ? '100%' : 'none'
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
