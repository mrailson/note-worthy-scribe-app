import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Loader2, Move, ZoomIn, ZoomOut, Sparkles, Check, User, Type,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FieldPosition, TextAnnotation } from '@/utils/generateSignedPdf';
import { Input } from '@/components/ui/input';

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

export type FieldType = 'signature' | 'name' | 'role' | 'organisation' | 'date';

export interface PerSignatoryFieldPositions {
  [signatoryId: string]: {
    signature?: FieldPosition;
    name?: FieldPosition;
    role?: FieldPosition;
    organisation?: FieldPosition;
    date?: FieldPosition;
  };
}

interface SignatoryInfo {
  id: string;
  name: string;
}

interface Props {
  fileUrl: string;
  signatories: SignatoryInfo[];
  /** Block mode positions */
  value: PerSignatoryPositions;
  onChange: (positions: PerSignatoryPositions) => void;
  /** Placement mode */
  placementMode: 'block' | 'separated';
  onPlacementModeChange: (mode: 'block' | 'separated') => void;
  /** Separated mode field positions */
  fieldPositions: PerSignatoryFieldPositions;
  onFieldPositionsChange: (positions: PerSignatoryFieldPositions) => void;
  /** Font size for separated mode */
  separatedFontSize: number;
  onSeparatedFontSizeChange: (size: number) => void;
  /** Text annotations */
  textAnnotations: TextAnnotation[];
  onTextAnnotationsChange: (annotations: TextAnnotation[]) => void;
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

const DEFAULT_STAMP: StampPosition = { page: 1, x: 10, y: 70, width: 14, height: 6 };

const FIELD_LABELS: Record<FieldType, string> = {
  signature: 'Signature',
  name: 'Name',
  role: 'Role',
  organisation: 'Organisation',
  date: 'Date',
};

const FIELD_ICONS: Record<FieldType, string> = {
  signature: '✍',
  name: '👤',
  role: '💼',
  organisation: '🏢',
  date: '📅',
};

const ALL_FIELDS: FieldType[] = ['signature', 'name', 'role', 'organisation', 'date'];

export function SignaturePositionPicker({
  fileUrl, signatories, value, onChange,
  placementMode, onPlacementModeChange,
  fieldPositions, onFieldPositionsChange,
  separatedFontSize, onSeparatedFontSizeChange,
  textAnnotations, onTextAnnotationsChange,
}: Props) {
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
  // For separated mode: which field is being placed
  const [activeField, setActiveField] = useState<FieldType | null>(null);

  const [dragging, setDragging] = useState<string | null>(null); // sigId, `sigId:field`, or `text:idx`
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [suggestingPositions, setSuggestingPositions] = useState(false);
  const [newTextValue, setNewTextValue] = useState('');
  const [placingTextIdx, setPlacingTextIdx] = useState<number | null>(null);

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

    // Text annotation placement
    if (placingTextIdx !== null) {
      const pageEl = pageRefs.current.get(pageNum);
      if (!pageEl) return;
      const pos = getMousePercent(e, pageEl);
      const updated = [...textAnnotations];
      updated[placingTextIdx] = {
        ...updated[placingTextIdx],
        page: pageNum,
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
      };
      onTextAnnotationsChange(updated);
      setPlacingTextIdx(null);
      return;
    }

    if (!activeSignatoryId) return;

    if (placementMode === 'block') {
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
    } else {
      // Separated mode: place active field
      if (!activeField) return;
      const existingField = fieldPositions[activeSignatoryId]?.[activeField];
      if (existingField) return; // already placed
      const pageEl = pageRefs.current.get(pageNum);
      if (!pageEl) return;
      const pos = getMousePercent(e, pageEl);
      onFieldPositionsChange({
        ...fieldPositions,
        [activeSignatoryId]: {
          ...fieldPositions[activeSignatoryId],
          [activeField]: {
            page: pageNum,
            x: Math.round(pos.x * 10) / 10,
            y: Math.round(pos.y * 10) / 10,
          },
        },
      });
    }
  }, [activeSignatoryId, activeField, value, fieldPositions, dragging, onChange, onFieldPositionsChange, getMousePercent, placementMode, placingTextIdx, textAnnotations, onTextAnnotationsChange]);



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

  const scrollToPage = (pageNum: number) => {
    const el = pageRefs.current.get(pageNum);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Mouse handlers for dragging — block mode
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

  // Mouse handlers for dragging — separated field
  const handleFieldMouseDown = useCallback((e: React.MouseEvent, sigId: string, field: FieldType, pageNum: number) => {
    const pageEl = pageRefs.current.get(pageNum);
    if (!pageEl) return;
    const pos = getMousePercent(e, pageEl);
    const fp = fieldPositions[sigId]?.[field];
    if (!fp) return;
    setDragging(`${sigId}:${field}`);
    setDragOffset({ x: pos.x - fp.x, y: pos.y - fp.y });
    setActiveSignatoryId(sigId);
    setActiveField(field);
    e.preventDefault();
    e.stopPropagation();
  }, [fieldPositions, getMousePercent]);

  // Mouse handler for dragging text annotations
  const handleTextMouseDown = useCallback((e: React.MouseEvent, idx: number, pageNum: number) => {
    const pageEl = pageRefs.current.get(pageNum);
    if (!pageEl) return;
    const pos = getMousePercent(e, pageEl);
    const ann = textAnnotations[idx];
    if (!ann) return;
    setDragging(`text:${idx}`);
    setDragOffset({ x: pos.x - ann.x, y: pos.y - ann.y });
    setPlacingTextIdx(null);
    e.preventDefault();
    e.stopPropagation();
  }, [textAnnotations, getMousePercent]);

  const handleMouseMove = useCallback((e: React.MouseEvent, pageNum: number) => {
    if (!dragging || !dragOffset) return;
    const pageEl = pageRefs.current.get(pageNum);
    if (!pageEl) return;
    const pos = getMousePercent(e, pageEl);

    if (dragging.startsWith('text:')) {
      // Text annotation dragging
      const idx = parseInt(dragging.split(':')[1]);
      const newX = Math.max(0, Math.min(95, pos.x - dragOffset.x));
      const newY = Math.max(0, Math.min(95, pos.y - dragOffset.y));
      const updated = [...textAnnotations];
      updated[idx] = {
        ...updated[idx],
        page: pageNum,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      };
      onTextAnnotationsChange(updated);
    } else if (dragging.includes(':')) {
      // Separated field dragging
      const [sigId, field] = dragging.split(':') as [string, FieldType];
      const newX = Math.max(0, Math.min(95, pos.x - dragOffset.x));
      const newY = Math.max(0, Math.min(95, pos.y - dragOffset.y));
      onFieldPositionsChange({
        ...fieldPositions,
        [sigId]: {
          ...fieldPositions[sigId],
          [field]: {
            page: pageNum,
            x: Math.round(newX * 10) / 10,
            y: Math.round(newY * 10) / 10,
          },
        },
      });
    } else {
      // Block dragging
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
    }
  }, [dragging, dragOffset, value, fieldPositions, textAnnotations, onChange, onFieldPositionsChange, onTextAnnotationsChange, getMousePercent]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setDragOffset(null);
  }, []);

  // AI suggestion (block mode only)
  const handleSuggestPositions = async () => {
    if (!pdfDocRef.current) return;
    setSuggestingPositions(true);
    try {
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
        body: { documentText: fullText, signatoryNames, totalPages: pdf.numPages },
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

  const getPlacedFieldCount = (sigId: string) => {
    const fp = fieldPositions[sigId];
    if (!fp) return 0;
    return ALL_FIELDS.filter(f => fp[f]).length;
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Placement Mode</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onPlacementModeChange('block')}
            className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
              placementMode === 'block'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground hover:border-primary/30'
            }`}
          >
            Block (Stamp)
          </button>
          <button
            onClick={() => onPlacementModeChange('separated')}
            className={`flex-1 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
              placementMode === 'separated'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border text-muted-foreground hover:border-primary/30'
            }`}
          >
            Separated Fields
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {placementMode === 'block'
            ? 'Places a single signature block per signatory containing all details.'
            : 'Place Name, Role, Organisation, Date and Signature independently at different locations.'}
        </p>
      </Card>

      {/* Signatory selector panel */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Signatory Positions</h3>
          {placementMode === 'block' && (
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
          )}
        </div>

        {placementMode === 'block' ? (
          /* Block mode signatory buttons */
          <div className="flex flex-wrap gap-2">
            {signatories.map((sig, idx) => {
              const isActive = activeSignatoryId === sig.id;
              const hasPosition = !!value[sig.id];
              const colour = getSignatoryColour(idx);
              return (
                <button
                  key={sig.id}
                  onClick={() => {
                    if (isActive && hasPosition) {
                      const newValue = { ...value };
                      delete newValue[sig.id];
                      onChange(newValue);
                      setActiveSignatoryId(null);
                    } else {
                      setActiveSignatoryId(sig.id);
                      const pos = value[sig.id];
                      if (pos) scrollToPage(pos.page);
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                    isActive
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/30 bg-background'
                  }`}
                >
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: colour }} />
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
        ) : (
          /* Separated mode — signatory + field selector */
          <div className="space-y-3">
            {/* Signatory tabs */}
            <div className="flex flex-wrap gap-2">
              {signatories.map((sig, idx) => {
                const isActive = activeSignatoryId === sig.id;
                const colour = getSignatoryColour(idx);
                const placedCount = getPlacedFieldCount(sig.id);
                return (
                  <button
                    key={sig.id}
                    onClick={() => {
                      setActiveSignatoryId(sig.id);
                      setActiveField(null);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm transition-all ${
                      isActive
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/30 bg-background'
                    }`}
                  >
                    <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: colour }} />
                    <span className="font-medium text-foreground">{sig.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {placedCount}/5
                    </Badge>
                  </button>
                );
              })}
            </div>

            {/* Field buttons for active signatory */}
            {activeSignatoryId && (
              <div className="flex flex-wrap gap-1.5">
                {ALL_FIELDS.map(field => {
                  const isFieldActive = activeField === field;
                  const isPlaced = !!fieldPositions[activeSignatoryId]?.[field];
                  const sigIdx = signatories.findIndex(s => s.id === activeSignatoryId);
                  const colour = getSignatoryColour(sigIdx);
                  return (
                    <button
                      key={field}
                      onClick={() => {
                        if (isFieldActive && isPlaced) {
                          // Remove field
                          const updated = { ...fieldPositions };
                          if (updated[activeSignatoryId]) {
                            const copy = { ...updated[activeSignatoryId] };
                            delete copy[field];
                            updated[activeSignatoryId] = copy;
                            onFieldPositionsChange(updated);
                          }
                          setActiveField(null);
                        } else {
                          setActiveField(field);
                          if (isPlaced) {
                            const pos = fieldPositions[activeSignatoryId]![field]!;
                            scrollToPage(pos.page);
                          }
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all ${
                        isFieldActive
                          ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                          : isPlaced
                            ? 'border-border bg-muted/50 text-foreground'
                            : 'border-dashed border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      <span>{FIELD_ICONS[field]}</span>
                      <span>{FIELD_LABELS[field]}</span>
                      {isPlaced && <Check className="h-3 w-3" style={{ color: colour }} />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Font size slider */}
            <div className="flex items-center gap-3 pt-1">
              <Type className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Font size</Label>
              <div className="w-32">
                <Slider
                  value={[separatedFontSize]}
                  min={8}
                  max={24}
                  step={1}
                  onValueChange={([v]) => onSeparatedFontSizeChange(v)}
                />
              </div>
              <span className="text-xs font-mono text-muted-foreground w-8">{separatedFontSize}pt</span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <User className="h-3 w-3 inline mr-1" />
          {placementMode === 'block'
            ? (!activeSignatoryId
                ? 'Select a signatory above, then click on the document to place their signature'
                : value[activeSignatoryId]
                  ? `${signatories.find(s => s.id === activeSignatoryId)?.name}: page ${value[activeSignatoryId].page} — drag to reposition`
                  : `Click anywhere on the document to place ${signatories.find(s => s.id === activeSignatoryId)?.name}'s signature block`
              )
            : (!activeSignatoryId
                ? 'Select a signatory above'
                : !activeField
                  ? 'Select a field to place, then click on the document'
                  : fieldPositions[activeSignatoryId]?.[activeField]
                    ? `${FIELD_LABELS[activeField]} placed — drag to reposition or click to remove`
                    : `Click on the document to place the ${FIELD_LABELS[activeField]} field`
              )
          }
        </p>
      </Card>

      {/* Custom Text Annotations */}
      <Card className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Custom Text</h3>
        <p className="text-xs text-muted-foreground">Add short labels or notes to place on the document.</p>
        <div className="flex gap-2">
          <Input
            placeholder="Enter text…"
            value={newTextValue}
            onChange={e => setNewTextValue(e.target.value)}
            className="text-sm"
            onKeyDown={e => {
              if (e.key === 'Enter' && newTextValue.trim()) {
                onTextAnnotationsChange([...textAnnotations, { text: newTextValue.trim(), page: 1, x: 50, y: 50 }]);
                setPlacingTextIdx(textAnnotations.length);
                setNewTextValue('');
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!newTextValue.trim()}
            onClick={() => {
              if (!newTextValue.trim()) return;
              onTextAnnotationsChange([...textAnnotations, { text: newTextValue.trim(), page: 1, x: 50, y: 50 }]);
              setPlacingTextIdx(textAnnotations.length);
              setNewTextValue('');
            }}
          >
            Add
          </Button>
        </div>
        {textAnnotations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {textAnnotations.map((ann, idx) => {
              const isPlacing = placingTextIdx === idx;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all ${
                    isPlacing
                      ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                      : 'border-border bg-muted/50 text-foreground'
                  }`}
                >
                  <button
                    className="text-left truncate max-w-[120px]"
                    onClick={() => {
                      setPlacingTextIdx(isPlacing ? null : idx);
                      scrollToPage(ann.page);
                    }}
                    title={ann.text}
                  >
                    📝 {ann.text}
                  </button>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">p.{ann.page}</Badge>
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => {
                      const updated = textAnnotations.filter((_, i) => i !== idx);
                      onTextAnnotationsChange(updated);
                      if (placingTextIdx === idx) setPlacingTextIdx(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {placingTextIdx !== null && (
          <p className="text-xs text-primary font-medium">
            Click on the document to place "{textAnnotations[placingTextIdx]?.text}"
          </p>
        )}
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
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.max(0.5, s - 0.25))} disabled={scale <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="w-24">
            <Slider value={[scale * 100]} min={50} max={200} step={25} onValueChange={([v]) => setScale(v / 100)} />
          </div>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setScale(s => Math.min(2, s + 0.25))} disabled={scale >= 2}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Viewer */}
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
                style={{
                  maxWidth: '100%',
                  cursor: placementMode === 'block'
                    ? (activeSignatoryId && !value[activeSignatoryId] ? 'crosshair' : undefined)
                    : (activeField && activeSignatoryId && !fieldPositions[activeSignatoryId]?.[activeField] ? 'crosshair' : undefined),
                }}
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

                {/* Block mode overlays */}
                {placementMode === 'block' && signatories.map((sig, idx) => {
                  const stamp = value[sig.id];
                  if (!stamp || stamp.page !== pageNum) return null;
                  const isActive = sig.id === activeSignatoryId;
                  const colour = getSignatoryColour(idx);
                  const bgColour = getSignatoryBg(idx);
                  return (
                    <div
                      key={sig.id}
                      className={`absolute rounded flex items-center justify-center ${isActive ? 'cursor-move shadow-lg ring-2 ring-offset-1' : ''}`}
                      style={{
                        left: `${stamp.x}%`, top: `${stamp.y}%`,
                        width: `${stamp.width}%`, height: `${stamp.height}%`,
                        border: `2px ${isActive ? 'solid' : 'dashed'} ${colour}`,
                        backgroundColor: bgColour,
                        ...(isActive ? { outline: `2px solid ${colour}`, outlineOffset: '2px' } : {}),
                        opacity: isActive ? 1 : 0.25,
                        pointerEvents: isActive ? 'auto' : 'none',
                        zIndex: isActive ? 30 : 20,
                      }}
                      onMouseDown={isActive ? (e) => handleMouseDown(e, sig.id, pageNum) : undefined}
                    >
                      <div
                        className="rounded px-2 py-0.5 text-[10px] font-medium flex items-center gap-1 shadow-sm max-w-full truncate"
                        style={{ backgroundColor: 'hsl(var(--background) / 0.92)', color: colour }}
                      >
                        {isActive && <Move className="h-2.5 w-2.5 flex-shrink-0" />}
                        <span className="truncate">{sig.name}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Separated mode field overlays */}
                {placementMode === 'separated' && signatories.map((sig, sigIdx) => {
                  const sigFields = fieldPositions[sig.id];
                  if (!sigFields) return null;
                  const colour = getSignatoryColour(sigIdx);
                  const bgColour = getSignatoryBg(sigIdx);

                  return ALL_FIELDS.map(field => {
                    const fp = sigFields[field];
                    if (!fp || fp.page !== pageNum) return null;
                    const isActive = sig.id === activeSignatoryId && activeField === field;
                    return (
                      <div
                        key={`${sig.id}-${field}`}
                        className={`absolute rounded-md flex items-center ${isActive ? 'cursor-move shadow-lg ring-1 ring-offset-1' : ''}`}
                        style={{
                          left: `${fp.x}%`,
                          top: `${fp.y}%`,
                          border: `1.5px ${isActive ? 'solid' : 'dashed'} ${colour}`,
                          backgroundColor: bgColour,
                          opacity: (sig.id === activeSignatoryId) ? 1 : 0.3,
                          pointerEvents: (sig.id === activeSignatoryId) ? 'auto' : 'none',
                          zIndex: isActive ? 30 : 20,
                          padding: '2px 6px',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseDown={isActive ? (e) => handleFieldMouseDown(e, sig.id, field, pageNum) : undefined}
                      >
                        <span className="text-[9px] font-medium flex items-center gap-1" style={{ color: colour }}>
                          {isActive && <Move className="h-2.5 w-2.5 flex-shrink-0" />}
                          <span>{FIELD_ICONS[field]}</span>
                          <span>{sig.name.split(' ')[0]} · {FIELD_LABELS[field]}</span>
                        </span>
                      </div>
                    );
                  });
                })}

                {/* Text annotation overlays */}
                {textAnnotations.map((ann, idx) => {
                  if (ann.page !== pageNum) return null;
                  const isActive = placingTextIdx === idx || dragging === `text:${idx}`;
                  return (
                    <div
                      key={`text-${idx}`}
                      className={`absolute rounded-md flex items-center ${isActive ? 'cursor-move shadow-lg ring-1 ring-offset-1' : 'cursor-pointer'}`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        border: `1.5px ${isActive ? 'solid' : 'dashed'} hsl(var(--muted-foreground))`,
                        backgroundColor: 'hsl(var(--muted) / 0.5)',
                        opacity: isActive ? 1 : 0.7,
                        zIndex: isActive ? 30 : 15,
                        padding: '2px 6px',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseDown={(e) => handleTextMouseDown(e, idx, pageNum)}
                    >
                      <span className="text-[9px] font-medium flex items-center gap-1 text-muted-foreground">
                        {isActive && <Move className="h-2.5 w-2.5 flex-shrink-0" />}
                        <span>📝</span>
                        <span className="truncate max-w-[100px]">{ann.text}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
