import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Move } from 'lucide-react';

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
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState({ x: value.x, y: value.y, w: value.width, h: value.height });
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [selectedPage, setSelectedPage] = useState(value.page || 1);

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

    if (mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h) {
      setDragging(true);
      setDragStart({ x: mx - rect.x, y: my - rect.y });
      e.preventDefault();
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

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Drag the signature area to position it on the document
        </Label>
        <Card className="p-2">
          <div
            ref={containerRef}
            className="relative select-none"
            style={{ height: '600px' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* PDF displayed in iframe */}
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded z-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground">Loading document preview…</span>
              </div>
            )}
            <iframe
              src={`${fileUrl}#toolbar=0&navpanes=0`}
              className="w-full h-full rounded border-0"
              title="Document preview"
              onLoad={() => setIframeLoaded(true)}
            />

            {/* Draggable overlay rectangle */}
            <div
              className="absolute border-2 border-primary bg-primary/10 rounded cursor-move flex items-center justify-center pointer-events-auto z-20"
              style={{
                left: `${rect.x}%`,
                top: `${rect.y}%`,
                width: `${rect.w}%`,
                height: `${rect.h}%`,
              }}
              onMouseDown={(e) => {
                if (!containerRef.current) return;
                const bounds = containerRef.current.getBoundingClientRect();
                const mx = ((e.clientX - bounds.left) / bounds.width) * 100;
                const my = ((e.clientY - bounds.top) / bounds.height) * 100;
                setDragging(true);
                setDragStart({ x: mx - rect.x, y: my - rect.y });
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <div className="bg-background/90 rounded px-2 py-1 text-xs text-muted-foreground flex items-center gap-1 shadow-sm">
                <Move className="h-3 w-3" /> Signature area
              </div>
            </div>
          </div>
        </Card>
        <p className="text-xs text-muted-foreground mt-1">
          Position: page {selectedPage}, x:{Math.round(rect.x)}% y:{Math.round(rect.y)}% ({Math.round(rect.w)}×{Math.round(rect.h)}%)
        </p>
      </div>
    </div>
  );
}
