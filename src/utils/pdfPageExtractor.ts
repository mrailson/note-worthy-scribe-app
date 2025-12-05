import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractedPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface PdfExtractionProgress {
  currentPage: number;
  totalPages: number;
  percentage: number;
}

/**
 * Extract all pages from a PDF file as JPEG images
 * @param file PDF file to extract pages from
 * @param dpi Target DPI for rendering (default 150 for balance of quality/size)
 * @param onProgress Callback for extraction progress
 * @returns Array of extracted page images as data URLs
 */
export async function extractPdfPages(
  file: File,
  dpi: number = 150,
  onProgress?: (progress: PdfExtractionProgress) => void
): Promise<ExtractedPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const extractedPages: ExtractedPage[] = [];

  // Scale factor: PDF default is 72 DPI
  const scale = dpi / 72;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render page to canvas
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    // Convert to JPEG data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    extractedPages.push({
      pageNumber: pageNum,
      dataUrl,
      width: viewport.width,
      height: viewport.height,
    });

    // Report progress
    if (onProgress) {
      onProgress({
        currentPage: pageNum,
        totalPages,
        percentage: Math.round((pageNum / totalPages) * 100),
      });
    }

    // Clean up
    canvas.remove();
  }

  return extractedPages;
}

/**
 * Get the number of pages in a PDF without extracting them
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}
