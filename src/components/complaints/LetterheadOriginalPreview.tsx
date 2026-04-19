import { useEffect, useRef, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';

interface LetterheadOriginalPreviewProps {
  signedUrl: string | undefined;
  mimeType: string | undefined;
  fileName?: string;
  /**
   * Width in CSS pixels of the area available for the letterhead band. The
   * preview will scale to fit this width while preserving aspect ratio.
   */
  targetWidthPx: number;
  /**
   * Height in CSS pixels of the letterhead band. The rendered content is
   * vertically clipped to this height (the user controls it via the slider).
   */
  bandHeightPx: number;
  alignment: 'left' | 'centre' | 'right';
}

/**
 * Renders the user's original letterhead file (PDF or DOCX) inside the
 * letterhead band of the preview. PDFs are rasterised client-side with
 * PDF.js. DOCX files are converted to HTML with mammoth and shown in a
 * scaled wrapper (a faithful enough preview for layout decisions).
 *
 * If anything fails, falls back to a friendly file-info card so the user
 * always sees that something is set.
 */
export function LetterheadOriginalPreview({
  signedUrl,
  mimeType,
  fileName,
  targetWidthPx,
  bandHeightPx,
  alignment,
}: LetterheadOriginalPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docxHostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isPdf = mimeType === 'application/pdf' || (fileName?.toLowerCase().endsWith('.pdf') ?? false);
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    (fileName?.toLowerCase().endsWith('.docx') ?? false);

  // -----------------------------------------------------------------------
  // PDF rendering with PDF.js
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!signedUrl || !isPdf) return;
    let cancelled = false;
    (async () => {
      setStatus('loading');
      setErrorMsg(null);
      try {
        const pdfjsLib = await import('pdfjs-dist');
        // @ts-ignore - bundled worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();

        const loadingTask = pdfjsLib.getDocument({ url: signedUrl });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        // Render at high enough resolution that the scaled-down result is
        // still crisp on retina displays.
        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = targetWidthPx / baseViewport.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const renderScale = cssScale * dpr;
        const renderViewport = page.getViewport({ scale: renderScale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = Math.ceil(renderViewport.width);
        canvas.height = Math.ceil(renderViewport.height);
        canvas.style.width = `${baseViewport.width * cssScale}px`;
        canvas.style.height = `${baseViewport.height * cssScale}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise;
        if (!cancelled) setStatus('ready');
      } catch (err: any) {
        console.error('[LetterheadOriginalPreview] PDF render failed', err);
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err?.message || 'Could not render PDF preview');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedUrl, isPdf, targetWidthPx]);

  // -----------------------------------------------------------------------
  // DOCX → HTML with mammoth
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!signedUrl || !isDocx) return;
    let cancelled = false;
    (async () => {
      setStatus('loading');
      setErrorMsg(null);
      try {
        const mammothMod = await import('mammoth');
        const mammoth: any = (mammothMod as any).default ?? mammothMod;
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error(`Failed to fetch DOCX (${res.status})`);
        const arrayBuffer = await res.arrayBuffer();
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
        const host = docxHostRef.current;
        if (!host || cancelled) return;
        host.innerHTML = html || '';
        if (!cancelled) setStatus('ready');
      } catch (err: any) {
        console.error('[LetterheadOriginalPreview] DOCX render failed', err);
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err?.message || 'Could not render DOCX preview');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedUrl, isDocx]);

  if (!signedUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
        [ Notewell default header ]
      </div>
    );
  }

  const justifyClass =
    alignment === 'left'
      ? 'justify-start'
      : alignment === 'right'
        ? 'justify-end'
        : 'justify-center';

  return (
    <div className={`w-full h-full overflow-hidden flex ${justifyClass} items-start bg-card`}>
      {status === 'loading' && (
        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading letterhead preview…
        </div>
      )}

      {status === 'error' && (
        <div className="w-full h-full flex flex-col items-center justify-center text-xs text-muted-foreground p-2 text-center gap-1">
          <FileText className="h-5 w-5" />
          <div className="font-medium text-foreground/80">{fileName || 'Letterhead'}</div>
          <div>{errorMsg || 'Preview unavailable — file will still be applied to letters.'}</div>
        </div>
      )}

      {isPdf && (
        <canvas
          ref={canvasRef}
          className={status === 'ready' ? 'block' : 'hidden'}
          style={{ maxWidth: '100%' }}
        />
      )}

      {isDocx && (
        <div
          className={status === 'ready' ? 'block w-full' : 'hidden'}
          style={{
            // Scale the DOCX HTML so a notional A4-width page fits the band.
            // We render to an off-screen wrapper sized to A4 then transform.
            width: '210mm',
            transform: `scale(${targetWidthPx / (210 * 3.7795)})`,
            transformOrigin: alignment === 'right' ? 'top right' : alignment === 'centre' ? 'top center' : 'top left',
          }}
        >
          <div
            ref={docxHostRef}
            className="docx-letterhead-host"
            style={{
              padding: '12mm 18mm',
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: '11pt',
              color: 'hsl(var(--foreground))',
              background: 'transparent',
            }}
          />
        </div>
      )}
    </div>
  );
}
