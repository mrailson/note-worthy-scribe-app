/**
 * Letterhead → PNG data URL
 *
 * Converts a stored letterhead (PDF or DOCX) into a high-resolution PNG data
 * URL suitable for embedding in emails (<img src=data:...>) and Word docs
 * (docx ImageRun). PDFs are rendered with PDF.js. DOCX files are converted
 * to HTML with mammoth, drawn into an off-screen iframe, and rasterised with
 * html2canvas.
 *
 * Returns `null` on any failure so callers can gracefully fall back to the
 * legacy logo behaviour.
 */

import type { ActiveLetterhead } from './practiceLetterhead';

const PDF_MIME = 'application/pdf';
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Cache by storage_path so we don't re-render the same letterhead repeatedly
// during a single browser session.
const dataUrlCache = new Map<string, string>();

export interface RenderedLetterhead {
  data_url: string;
  /** Pixel dimensions of the rendered PNG. */
  width_px: number;
  height_px: number;
}

export async function letterheadToPngDataUrl(
  lh: ActiveLetterhead | null | undefined,
): Promise<RenderedLetterhead | null> {
  if (!lh?.signed_url) return null;
  const cacheKey = lh.rendered_png_path || lh.signed_url;
  const cached = dataUrlCache.get(cacheKey);
  if (cached) {
    // Decode dimensions from cached image lazily.
    const dims = await imageDimensions(cached);
    return { data_url: cached, ...dims };
  }

  const mime = inferMimeType(lh);

  try {
    if (mime === PDF_MIME) {
      const result = await renderPdfToPng(lh.signed_url);
      if (result) dataUrlCache.set(cacheKey, result.data_url);
      return result;
    }
    if (mime === DOCX_MIME) {
      const result = await renderDocxToPng(lh.signed_url);
      if (result) dataUrlCache.set(cacheKey, result.data_url);
      return result;
    }
  } catch (err) {
    console.error('[letterheadToPngDataUrl] failed:', err);
  }
  return null;
}

function inferMimeType(lh: ActiveLetterhead): string {
  // ActiveLetterhead doesn't carry mime; derive from path/signed URL extension.
  const candidate = (lh.rendered_png_path || lh.signed_url).toLowerCase();
  if (candidate.endsWith('.pdf') || candidate.includes('.pdf?')) return PDF_MIME;
  if (candidate.endsWith('.docx') || candidate.includes('.docx?')) return DOCX_MIME;
  return PDF_MIME; // sensible default
}

async function renderPdfToPng(signedUrl: string): Promise<RenderedLetterhead | null> {
  const pdfjsLib = await import('pdfjs-dist');
  // @ts-ignore - bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const loadingTask = pdfjsLib.getDocument({ url: signedUrl });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);

  // Render at ~150 DPI relative to A4 width (210mm). 1240px wide ≈ 150 DPI A4.
  const targetWidthPx = 1240;
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = targetWidthPx / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  return {
    data_url: canvas.toDataURL('image/png'),
    width_px: canvas.width,
    height_px: canvas.height,
  };
}

async function renderDocxToPng(signedUrl: string): Promise<RenderedLetterhead | null> {
  const mammothMod = await import('mammoth');
  const mammoth: any = (mammothMod as any).default ?? mammothMod;
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Failed to fetch DOCX (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  // Off-screen wrapper sized to A4 width.
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '210mm';
  wrapper.style.padding = '12mm 18mm';
  wrapper.style.background = '#ffffff';
  wrapper.style.fontFamily = 'Helvetica, Arial, sans-serif';
  wrapper.style.fontSize = '11pt';
  wrapper.style.color = '#000';
  wrapper.innerHTML = html || '';
  document.body.appendChild(wrapper);

  try {
    const html2canvasMod = await import('html2canvas');
    const html2canvas: any = (html2canvasMod as any).default ?? html2canvasMod;
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });
    return {
      data_url: canvas.toDataURL('image/png'),
      width_px: canvas.width,
      height_px: canvas.height,
    };
  } finally {
    wrapper.remove();
  }
}

async function imageDimensions(dataUrl: string): Promise<{ width_px: number; height_px: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width_px: img.naturalWidth, height_px: img.naturalHeight });
    img.onerror = () => resolve({ width_px: 0, height_px: 0 });
    img.src = dataUrl;
  });
}
