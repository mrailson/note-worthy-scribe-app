import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Move, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface StampPosition {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  fileUrl: string;
  value: StampPosition;
  onChange: (pos: StampPosition) => void;
}

export function SignaturePositionPicker({ fileUrl, value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);

  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState({ x: value.x, y: value.y, w: value.width, h: value.height });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(value.page || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rendering, setRendering] = useState(false);

  // Sync rect to parent
  useEffect(() => {
    onChange({ page: currentPage, x: rect.x, y: rect.y, width: rect.w, height: rect.h });
  }, [currentPage, rect]);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      try {
        let arrayBuffer: ArrayBuffer;

        // Download via Supabase SDK to avoid ad-blocker issues
        const storagePath = fileUrl.split('/approval-documents/')[1];
        if (storagePath) {
          const { data, error: dlErr } = await supabase.storage
            .from('approval-documents')
            .download(storagePath);
          if (dlErr || !data) throw dlErr || new Error('Download failed');
          arrayBuffer = await data.arrayBuffer();
        } else {
          const res = await fetch(fileUrl);
          arrayBuffer = await res.arrayBuffer();
        }

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load PDF:', err);
          setError('Failed to load document preview');
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [fileUrl]);

  // Render current page
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || loading) return;

    let cancelled = false;
    setRendering(true);

    async function renderPage() {
      try {
        const pdf = pdfDocRef.current;
        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale: scale * 1.5 }); // 1.5x for crisp rendering

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        if (!cancelled) {
          setRendering(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to render page:', err);
          setRendering(false);
        }
      }
    }

    renderPage();
    return () => { cancelled = true; };
  }, [currentPage, scale, loading]);

  // Mouse handlers for dragging the overlay
  const getMousePercent = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return null;
    const bounds = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - bounds.left) / bounds.width) * 100,
      y: ((e.clientY - bounds.top) / bounds.height) * 100,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getMousePercent(e);
    if (!pos) return;

    if (pos.x >= rect.x && pos.x <= rect.x + rect.w && pos.y >= rect.y && pos.y <= rect.y + rect.h) {
      setDragging(true);
      setDragStart({ x: pos.x - rect.x, y: pos.y - rect.y });
      e.preventDefault();
    }
  }, [rect, getMousePercent]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !dragStart) return;
    const pos = getMousePercent(e);
    if (!pos) return;
    const newX = Math.max(0, Math.min(100 - rect.w, pos.x - dragStart.x));
    const newY = Math.max(0, Math.min(100 - rect.h, pos.y - dragStart.y));
    setRect(prev => ({ ...prev, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 }));
  }, [dragging, dragStart, rect.w, rect.h, getMousePercent]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setDragStart(null);
  }, []);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-2 min-w-[80px] text-center">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setScale(s => Math.min(2, s + 0.25))}
            disabled={scale >= 2}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Page thumbnails for quick navigation */}
      {totalPages > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
            <button
              key={pageNum}
              onClick={() => goToPage(pageNum)}
              className={`flex-shrink-0 px-2.5 py-1 text-xs rounded-md border transition-colors ${
                pageNum === currentPage
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {pageNum}
            </button>
          ))}
        </div>
      )}

      {/* PDF Canvas with overlay */}
      <Card className="p-2 overflow-auto" style={{ maxHeight: '65vh' }}>
        <div
          ref={containerRef}
          className="relative select-none inline-block"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {(loading || rendering) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded z-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-sm text-muted-foreground">
                {loading ? 'Loading document...' : 'Rendering page...'}
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-[400px] text-destructive text-sm">
              {error}
            </div>
          )}

          <canvas
            ref={canvasRef}
            className="rounded shadow-sm"
            style={{ display: loading || error ? 'none' : 'block', maxWidth: '100%', height: 'auto' }}
          />

          {/* Draggable overlay rectangle */}
          {!loading && !error && (
            <div
              className="absolute border-2 border-primary bg-primary/10 rounded cursor-move flex items-center justify-center pointer-events-auto z-20"
              style={{
                left: `${rect.x}%`,
                top: `${rect.y}%`,
                width: `${rect.w}%`,
                height: `${rect.h}%`,
              }}
              onMouseDown={(e) => {
                const pos = getMousePercent(e);
                if (!pos) return;
                setDragging(true);
                setDragStart({ x: pos.x - rect.x, y: pos.y - rect.y });
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="bg-background/90 rounded px-2 py-1 text-xs text-muted-foreground flex items-center gap-1 shadow-sm">
                <Move className="h-3 w-3" /> Signature area
              </div>
            </div>
          )}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Position: page {currentPage}, x:{Math.round(rect.x)}% y:{Math.round(rect.y)}% ({Math.round(rect.w)}×{Math.round(rect.h)}%)
      </p>
    </div>
  );
}
