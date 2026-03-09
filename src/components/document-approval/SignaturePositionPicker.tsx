import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Move, ChevronLeft, ChevronRight } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [selectedPage, setSelectedPage] = useState(value.page || 1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState({ x: value.x, y: value.y, w: value.width, h: value.height });
  const [pageRendered, setPageRendered] = useState(false);

  // Load PDF and generate thumbnails
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);

        // Generate small thumbnails for each page
        const thumbs: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.3 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
          thumbs.push(canvas.toDataURL('image/jpeg', 0.6));
        }
        if (!cancelled) setThumbnails(thumbs);
      } catch (err) {
        console.error('Failed to load PDF for preview:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [fileUrl]);

  // Render selected page at higher resolution
  useEffect(() => {
    let cancelled = false;
    async function renderPage() {
      if (!canvasRef.current) return;
      setPageRendered(false);
      try {
        const pdf = await pdfjsLib.getDocument(fileUrl).promise;
        const page = await pdf.getPage(selectedPage);
        const containerWidth = containerRef.current?.clientWidth || 500;
        const scale = containerWidth / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled) setPageRendered(true);
      } catch (err) {
        console.error('Failed to render page:', err);
      }
    }
    renderPage();
    return () => { cancelled = true; };
  }, [fileUrl, selectedPage]);

  // Sync rect to parent
  useEffect(() => {
    onChange({ page: selectedPage, x: rect.x, y: rect.y, width: rect.w, height: rect.h });
  }, [selectedPage, rect]);

  // Mouse handlers for dragging the overlay
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const mx = ((e.clientX - bounds.left) / bounds.width) * 100;
    const my = ((e.clientY - bounds.top) / bounds.height) * 100;

    // Check if inside existing rect
    if (mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h) {
      setDragging(true);
      setDragStart({ x: mx - rect.x, y: my - rect.y });
    }
  }, [rect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !dragStart || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const mx = ((e.clientX - bounds.left) / bounds.width) * 100;
    const my = ((e.clientY - bounds.top) / bounds.height) * 100;
    const newX = Math.max(0, Math.min(100 - rect.w, mx - dragStart.x));
    const newY = Math.max(0, Math.min(100 - rect.h, my - dragStart.y));
    setRect(prev => ({ ...prev, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 }));
  }, [dragging, dragStart, rect.w, rect.h]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setDragStart(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Loading PDF preview…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page thumbnails */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Select the page for signatures</Label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {thumbnails.map((thumb, i) => (
            <button
              key={i}
              onClick={() => setSelectedPage(i + 1)}
              className={`flex-shrink-0 border-2 rounded-lg overflow-hidden transition-all ${
                selectedPage === i + 1
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <img src={thumb} alt={`Page ${i + 1}`} className="h-24 w-auto" />
              <p className="text-[10px] text-center py-0.5 bg-muted text-muted-foreground">
                {i + 1}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Position picker */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Drag the signature area on page {selectedPage}
        </Label>
        <Card className="p-2">
          <div
            ref={containerRef}
            className="relative select-none cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <canvas ref={canvasRef} className="w-full h-auto rounded" />

            {/* Overlay rectangle */}
            {pageRendered && (
              <div
                className="absolute border-2 border-primary bg-primary/10 rounded cursor-move flex items-center justify-center"
                style={{
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${rect.w}%`,
                  height: `${rect.h}%`,
                }}
              >
                <div className="bg-background/90 rounded px-2 py-1 text-xs text-muted-foreground flex items-center gap-1">
                  <Move className="h-3 w-3" /> Signature area
                </div>
              </div>
            )}
          </div>
        </Card>
        <p className="text-xs text-muted-foreground mt-1">
          Position: page {selectedPage}, x:{Math.round(rect.x)}% y:{Math.round(rect.y)}% ({Math.round(rect.w)}×{Math.round(rect.h)}%)
        </p>
      </div>
    </div>
  );
}
