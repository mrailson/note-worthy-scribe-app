import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Loader2, Move, ZoomIn, ZoomOut, Sparkles, Check, User,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export interface PerSignatoryPositions {
  [signatoryId: string]: StampPosition;
}

interface SignatoryInfo {
  id: string;
  name: string;
}

interface Props {
  fileUrl: string;
  signatories: SignatoryInfo[];
  value: PerSignatoryPositions;
  onChange: (positions: PerSignatoryPositions) => void;
}

const SIGNATORY_COLOURS = [
  'hsl(var(--primary))',
  'hsl(220, 70%, 50%)',
  'hsl(150, 60%, 40%)',
  'hsl(280, 60%, 50%)',
  'hsl(30, 80%, 50%)',
  'hsl(0, 70%, 50%)',
];

const SIGNATORY_BG_COLOURS = [
  'hsl(var(--primary) / 0.12)',
  'hsla(220, 70%, 50%, 0.12)',
  'hsla(150, 60%, 40%, 0.12)',
  'hsla(280, 60%, 50%, 0.12)',
  'hsla(30, 80%, 50%, 0.12)',
  'hsla(0, 70%, 50%, 0.12)',
];

const DEFAULT_STAMP: StampPosition = { page: 1, x: 10, y: 70, width: 35, height: 12 };

export function SignaturePositionPicker({ fileUrl, signatories, value, onChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pdfDocRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentVisiblePage, setCurrentVisiblePage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());

  const [activeSignatoryId, setActiveSignatoryId] = useState<string | null>(
    signatories[0]?.id || null
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [suggestingPositions, setSuggestingPositions] = useState(false);

  // Mouse helpers
  const getMousePercent = useCallback((e: React.MouseEvent, pageEl: HTMLElement) => {
    const bounds = pageEl.getBoundingClientRect();
    return {
      x: ((e.clientX - bounds.left) / bounds.width) * 100,
      y: ((e.clientY - bounds.top) / bounds.height) * 100,
    };
  }, []);

  // Click-to-place handler for PDF pages
  const handlePageClick = useCallback((e: React.MouseEvent, pageNum: number) => {
    if (dragging) return;
    if (!activeSignatoryId) return;
    if (value[activeSignatoryId]) return;

    const pageEl = pageRefs.current.get(pageNum);
    if (!pageEl) return;

    const pos = getMousePercent(e, pageEl);
    const newX = Math.max(0, Math.min(100 - DEFAULT_STAMP.width, pos.x - DEFAULT_STAMP.width / 2));
    const newY = Math.max(0, Math.min(100 - DEFAULT_STAMP.height, pos.y - DEFAULT_STAMP.height / 2));

    onChange({
      ...value,
      [activeSignatoryId]: {
        page: pageNum,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
        width: DEFAULT_STAMP.width,
        height: DEFAULT_STAMP.height,
      },
    });
  }, [activeSignatoryId, value, dragging, onChange, getMousePercent]);

  // Load PDF
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      try {
        let arrayBuffer: ArrayBuffer;
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

  // Render pages when PDF loads or scale changes
  useEffect(() => {
    if (!pdfDocRef.current || loading) return;
    setRenderedPages(new Set());
    renderAllPages();
  }, [loading, scale]);

  const renderAllPages = async () => {
    const pdf = pdfDocRef.current;
    if (!pdf) return;

    for (let i = 1; i <= pdf.numPages; i++) {
      const canvas = canvasRefs.current.get(i);
      if (!canvas) continue;

      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: scale * 1.5 });
        const ctx = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        setRenderedPages(prev => new Set([...prev, i]));
      } catch (err) {
        console.error(`Failed to render page ${i}:`, err);
      }
    }
  };

  // Intersection observer for current visible page
  useEffect(() => {
    if (!totalPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '1');
            setCurrentVisiblePage(pageNum);
            break;
          }
        }
      },
      { threshold: 0.5 }
    );

    pageRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [totalPages, loading]);

  // Scroll to page
  const scrollToPage = (pageNum: number) => {
    const el = pageRefs.current.get(pageNum);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Mouse handlers for dragging signature blocks

  const handleMouseDown = useCallback((e: React.MouseEvent, sigId: string, pageNum: number) => {
    const pageEl = pageRefs.current.get(pageNum);
    if (!pageEl) return;

    const pos = getMousePercent(e, pageEl);
    const stamp = value[sigId];
    if (!stamp) return;

    setDragging(sigId);
    setDragOffset({ x: pos.x - stamp.x, y: pos.y - stamp.y });
    setActiveSignatoryId(sigId);
    e.preventDefault();
    e.stopPropagation();
  }, [value, getMousePercent]);

  const handleMouseMove = useCallback((e: React.MouseEvent, pageNum: number) => {
    if (!dragging || !dragOffset) return;

    const pageEl = pageRefs.current.get(pageNum);
    if (!pageEl) return;

    const pos = getMousePercent(e, pageEl);
    const stamp = value[dragging];
    if (!stamp) return;

    const newX = Math.max(0, Math.min(100 - stamp.width, pos.x - dragOffset.x));
    const newY = Math.max(0, Math.min(100 - stamp.height, pos.y - dragOffset.y));

    onChange({
      ...value,
      [dragging]: {
        ...stamp,
        page: pageNum,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      },
    });
  }, [dragging, dragOffset, value, onChange, getMousePercent]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setDragOffset(null);
  }, []);

  // AI suggestion
  const handleSuggestPositions = async () => {
    if (!pdfDocRef.current) return;
    setSuggestingPositions(true);

    try {
      // Extract text from all pages
      const pdf = pdfDocRef.current;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `\n--- Page ${i} ---\n${pageText}`;
      }

      const signatoryNames = signatories.map(s => s.name);

      const { data, error: fnErr } = await supabase.functions.invoke('suggest-signature-positions', {
        body: {
          documentText: fullText,
          signatoryNames,
          totalPages: pdf.numPages,
        },
      });

      if (fnErr) throw fnErr;

      if (data?.positions && Array.isArray(data.positions)) {
        const updated = { ...value };
        for (const suggestion of data.positions) {
          const sig = signatories.find(s => s.name === suggestion.name);
          if (sig) {
            updated[sig.id] = {
              page: Math.max(1, Math.min(pdf.numPages, suggestion.page || 1)),
              x: Math.max(0, Math.min(80, suggestion.x || 10)),
              y: Math.max(0, Math.min(85, suggestion.y || 70)),
              width: DEFAULT_STAMP.width,
              height: DEFAULT_STAMP.height,
            };
          }
        }
        onChange(updated);
        toast.success('AI suggested positions — adjust if needed');

        // Scroll to the first suggestion's page
        const firstPage = data.positions[0]?.page;
        if (firstPage) scrollToPage(firstPage);
      }
    } catch (err) {
      console.error('AI suggestion failed:', err);
      toast.error('Could not suggest positions automatically');
    } finally {
      setSuggestingPositions(false);
    }
  };

  const getSignatoryColour = (idx: number) => SIGNATORY_COLOURS[idx % SIGNATORY_COLOURS.length];
  const getSignatoryBg = (idx: number) => SIGNATORY_BG_COLOURS[idx % SIGNATORY_BG_COLOURS.length];

  return (
    <div className="space-y-4">
      {/* Signatory selector panel */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Signatory Positions</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggestPositions}
            disabled={suggestingPositions || loading}
            className="gap-1.5 text-xs"
          >
            {suggestingPositions ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {suggestingPositions ? 'Analysing…' : 'AI Suggest Positions'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {signatories.map((sig, idx) => {
            const isActive = activeSignatoryId === sig.id;
            const hasPosition = !!value[sig.id];
            const colour = getSignatoryColour(idx);

            return (
              <button
                key={sig.id}
                onClick={() => {
                  setActiveSignatoryId(sig.id);
                  const pos = value[sig.id];
                  if (pos) scrollToPage(pos.page);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                  isActive
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/30 bg-background'
                }`}
              >
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colour }}
                />
                <span className="font-medium text-foreground">{sig.name}</span>
                {hasPosition ? (
                  <span className="flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" style={{ color: 'hsl(150, 60%, 40%)' }} />
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      p.{value[sig.id].page}
                    </Badge>
                  </span>
                ) : isActive ? (
                  <span className="text-[10px] text-muted-foreground italic">Click to place</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          <User className="h-3 w-3 inline mr-1" />
          {!activeSignatoryId
            ? 'Select a signatory above, then click on the document to place their signature'
            : value[activeSignatoryId]
              ? `${signatories.find(s => s.id === activeSignatoryId)?.name}: page ${value[activeSignatoryId].page} — drag to reposition`
              : `Click anywhere on the document to place ${signatories.find(s => s.id === activeSignatoryId)?.name}'s signature block`
          }
        </p>
      </Card>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {currentVisiblePage} of {totalPages || '…'}
          </span>
          {totalPages > 1 && (
            <div className="flex gap-1 overflow-x-auto">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => scrollToPage(p)}
                  className={`flex-shrink-0 px-2 py-0.5 text-xs rounded transition-colors ${
                    p === currentVisiblePage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-24">
            <Slider
              value={[scale * 100]}
              min={50}
              max={200}
              step={25}
              onValueChange={([v]) => setScale(v / 100)}
            />
          </div>
          <span className="text-xs text-muted-foreground w-10 text-center">
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

      {/* PDF Viewer — all pages vertical scroll */}
      <div
        className="bg-muted/30 rounded-xl border border-border overflow-auto"
        style={{ maxHeight: '65vh' }}
        ref={scrollRef}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Loading document…</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-20 text-destructive text-sm">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="flex flex-col items-center gap-6 py-6 px-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <div
                key={pageNum}
                ref={el => { if (el) pageRefs.current.set(pageNum, el); }}
                data-page={pageNum}
                className="relative bg-white rounded-sm shadow-lg border border-border/50"
                style={{ maxWidth: '100%', cursor: activeSignatoryId && !value[activeSignatoryId] ? 'crosshair' : undefined }}
                onMouseMove={(e) => handleMouseMove(e, pageNum)}
                onMouseUp={handleMouseUp}
                onClick={(e) => handlePageClick(e, pageNum)}
              >
                {/* Page number badge */}
                <div className="absolute -top-3 left-3 z-10">
                  <Badge variant="secondary" className="text-[10px] shadow-sm">
                    Page {pageNum}
                  </Badge>
                </div>

                <canvas
                  ref={el => { if (el) canvasRefs.current.set(pageNum, el); }}
                  className="rounded-sm"
                  style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                />

                {/* Signature block overlay — only show active signatory */}
                {activeSignatoryId && (() => {
                  const idx = signatories.findIndex(s => s.id === activeSignatoryId);
                  if (idx === -1) return null;
                  const sig = signatories[idx];
                  const stamp = value[sig.id];
                  if (!stamp || stamp.page !== pageNum) return null;

                  const colour = getSignatoryColour(idx);
                  const bgColour = getSignatoryBg(idx);

                  return (
                    <div
                      key={sig.id}
                      className="absolute rounded cursor-move flex items-center justify-center shadow-lg ring-2 ring-offset-1"
                      style={{
                        left: `${stamp.x}%`,
                        top: `${stamp.y}%`,
                        width: `${stamp.width}%`,
                        height: `${stamp.height}%`,
                        border: `2px solid ${colour}`,
                        backgroundColor: bgColour,
                        outline: `2px solid ${colour}`,
                        outlineOffset: '2px',
                        zIndex: 30,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, sig.id, pageNum)}
                    >
                      <div
                        className="rounded px-2 py-0.5 text-[10px] font-medium flex items-center gap-1 shadow-sm max-w-full truncate"
                        style={{ backgroundColor: 'hsl(var(--background) / 0.92)', color: colour }}
                      >
                        <Move className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="truncate">{sig.name}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
