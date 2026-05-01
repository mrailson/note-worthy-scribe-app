import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { generateInvoicePdf } from '@/utils/invoicePdfGenerator';
import type { BuyBackClaim } from '@/hooks/useNRESBuyBackClaims';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export const DRAFT_INVOICE_NUMBER = 'DRAFT-INVOICE-PREVIEW';

export function InlineInvoicePdfPreview({ pdfData }: { pdfData: ArrayBuffer | null }) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement | null>>(new Map());
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pdfData) {
      setPdfDoc(null);
      setTotalPages(0);
      setCurrentPage(1);
      return;
    }

    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData.slice(0)) });

    setLoading(true);
    setError(null);
    loadingTask.promise
      .then(doc => {
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      })
      .catch(err => {
        if (!cancelled) setError(err?.message || 'Could not render invoice preview');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [pdfData]);

  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;

    const renderPages = async () => {
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
        if (cancelled) return;
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: (zoom / 100) * 1.5 });
        const canvas = canvasRefs.current.get(pageNum);
        const context = canvas?.getContext('2d');
        if (!canvas || !context) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / 1.5}px`;
        canvas.style.height = `${viewport.height / 1.5}px`;
        await page.render({ canvasContext: context, viewport, canvas } as any).promise;
      }
    };

    renderPages().catch(err => setError(err?.message || 'Could not render invoice preview'));
    return () => { cancelled = true; };
  }, [pdfDoc, zoom]);

  useEffect(() => {
    if (!totalPages || !scrollRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pageNum = Number(entry.target.getAttribute('data-page'));
            if (pageNum) setCurrentPage(pageNum);
          }
        }
      },
      { root: scrollRef.current, threshold: 0.5 }
    );
    pageRefs.current.forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [totalPages, pdfDoc]);

  if (!pdfData || loading) {
    return <div className="h-full flex items-center justify-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating invoice preview…</div>;
  }

  if (error) {
    return <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground"><FileText className="h-6 w-6" />{error}</div>;
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>Page {currentPage} of {totalPages}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(60, z - 10))} disabled={zoom <= 60}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">{zoom}%</span>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(180, z + 10))} disabled={zoom >= 180}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-muted/30">
        <div className="flex flex-col items-center gap-4 p-4">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map(pageNum => (
            <div key={pageNum} data-page={pageNum} ref={el => { pageRefs.current.set(pageNum, el); }} className="max-w-full rounded-sm bg-background shadow-sm">
              <canvas ref={el => { canvasRefs.current.set(pageNum, el); }} className="block max-w-full h-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  claim,
  invoiceDescription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: BuyBackClaim;
  invoiceDescription?: string;
}) {
  const [previewPdfData, setPreviewPdfData] = useState<ArrayBuffer | null>(null);
  const previewInvoiceNumber = claim.invoice_number || DRAFT_INVOICE_NUMBER;
  const description = invoiceDescription ?? (claim as any).practice_notes ?? '';

  useEffect(() => {
    if (!open) {
      setPreviewPdfData(null);
      return;
    }

    const previewClaim = { ...claim, practice_notes: description } as BuyBackClaim;
    const pdfDoc = generateInvoicePdf({
      claim: previewClaim,
      invoiceNumber: previewInvoiceNumber,
      neighbourhoodName: 'NRES',
    });
    setPreviewPdfData(pdfDoc.output('arraybuffer'));
  }, [claim, description, open, previewInvoiceNumber]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] max-h-[92vh] p-0 overflow-hidden flex flex-col bg-background">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <DialogTitle className="text-left text-base font-semibold">Invoice preview</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/30">
          <InlineInvoicePdfPreview pdfData={previewPdfData} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
