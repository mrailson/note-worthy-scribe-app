import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut, RotateCcw, Loader2 } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  base64: string;
  mediaType: string;
  kind: "pdf" | "image";
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export function FindingsDocumentViewer({
  open,
  onOpenChange,
  fileName,
  base64,
  mediaType,
  kind,
}: Props) {
  const dataUrl = `data:${mediaType};base64,${base64}`;
  const [zoom, setZoom] = useState(1);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    if (open) setZoom(1);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 flex flex-col">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between gap-3 space-y-0">
          <DialogTitle className="text-sm font-medium truncate flex-1 pr-4">
            {fileName}
          </DialogTitle>
          <div className="flex items-center gap-1 mr-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))}
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-mono w-12 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))}
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(1)}
              title="Reset zoom"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} className="ml-2">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {kind === "image" ? (
            <ImageViewer dataUrl={dataUrl} zoom={zoom} alt={fileName} />
          ) : (
            <PdfViewer base64={base64} zoom={zoom} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageViewer({ dataUrl, zoom, alt }: { dataUrl: string; zoom: number; alt: string }) {
  return (
    <div className="w-full h-full overflow-auto bg-muted/40 flex items-start justify-center p-4">
      <img
        src={dataUrl}
        alt={alt}
        style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
        className="max-w-full transition-transform"
      />
    </div>
  );
}

function PdfViewer({ base64, zoom }: { base64: string; zoom: number }) {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);
    (async () => {
      try {
        const data = base64ToUint8Array(base64);
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        const rendered: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
          rendered.push(canvas.toDataURL("image/png"));
          if (cancelled) return;
          setPages([...rendered]);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to render PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base64]);

  const scrollToPage = (n: number) => {
    const el = pageRefs.current[n - 1];
    if (el && containerRef.current) {
      containerRef.current.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
      setActivePage(n);
    }
  };

  // Track active page on scroll
  const onScroll = () => {
    const c = containerRef.current;
    if (!c) return;
    const top = c.scrollTop;
    let current = 1;
    for (let i = 0; i < pageRefs.current.length; i++) {
      const el = pageRefs.current[i];
      if (el && el.offsetTop - 40 <= top) current = i + 1;
    }
    if (current !== activePage) setActivePage(current);
  };

  if (error) {
    return (
      <div className="p-6 text-sm text-red-700">
        Could not render PDF: {error}
      </div>
    );
  }

  const showThumbnails = pages.length > 1;

  return (
    <div className="flex h-full w-full">
      {showThumbnails && (
        <aside className="w-40 shrink-0 border-r bg-muted/30 overflow-y-auto p-2 space-y-2">
          {pages.map((src, i) => {
            const n = i + 1;
            const isActive = n === activePage;
            return (
              <button
                key={n}
                onClick={() => scrollToPage(n)}
                className={`w-full block rounded border bg-background overflow-hidden hover:border-primary transition ${
                  isActive ? "border-primary ring-2 ring-primary/30" : "border-border"
                }`}
              >
                <img src={src} alt={`Page ${n}`} className="w-full h-auto block" />
                <div className="text-[10px] py-1 text-center text-muted-foreground bg-muted/40">
                  Page {n}
                </div>
              </button>
            );
          })}
        </aside>
      )}

      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex-1 overflow-auto bg-muted/40 p-4 space-y-4"
      >
        {loading && pages.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Rendering PDF…
          </div>
        )}
        {pages.map((src, i) => (
          <div
            key={i}
            ref={(el) => (pageRefs.current[i] = el)}
            className="flex justify-center"
          >
            <img
              src={src}
              alt={`Page ${i + 1}`}
              style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
              className="shadow-sm border bg-white transition-[width]"
            />
          </div>
        ))}
        {loading && pages.length > 0 && (
          <div className="text-xs text-muted-foreground text-center py-2">
            <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
            Rendering remaining pages…
          </div>
        )}
      </div>
    </div>
  );
}
