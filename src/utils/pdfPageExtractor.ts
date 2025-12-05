import * as pdfjsLib from 'pdfjs-dist';
import { analyseBlankness, BlankAnalysisResult } from './blankPageDetector';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractedPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  isBlank?: boolean;
  blankConfidence?: number;
}

export interface PdfExtractionProgress {
  currentPage: number;
  totalPages: number;
  percentage: number;
  phase?: 'extracting' | 'analysing';
}

/**
 * Extract all pages from a PDF file as JPEG images
 * @param file PDF file to extract pages from
 * @param dpi Target DPI for rendering (default 150 for balance of quality/size)
 * @param onProgress Callback for extraction progress
 * @param detectBlanks Whether to run blank page detection (default true)
 * @returns Array of extracted page images as data URLs
 */
export async function extractPdfPages(
  file: File,
  dpi: number = 150,
  onProgress?: (progress: PdfExtractionProgress) => void,
  detectBlanks: boolean = true
): Promise<ExtractedPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const extractedPages: ExtractedPage[] = [];

  // Scale factor: PDF default is 72 DPI
  const scale = dpi / 72;

  // Phase 1: Extract pages
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
      isBlank: false,
      blankConfidence: 0,
    });

    // Report progress
    if (onProgress) {
      onProgress({
        currentPage: pageNum,
        totalPages,
        percentage: detectBlanks 
          ? Math.round((pageNum / totalPages) * 50) // 0-50% for extraction
          : Math.round((pageNum / totalPages) * 100),
        phase: 'extracting',
      });
    }

    // Clean up
    canvas.remove();
  }

  // Phase 2: Analyse for blank pages (if enabled)
  if (detectBlanks) {
    for (let i = 0; i < extractedPages.length; i++) {
      try {
        const result: BlankAnalysisResult = await analyseBlankness(extractedPages[i].dataUrl);
        extractedPages[i].isBlank = result.isBlank;
        extractedPages[i].blankConfidence = result.confidence;
      } catch {
        // If analysis fails, assume not blank
        extractedPages[i].isBlank = false;
        extractedPages[i].blankConfidence = 0;
      }

      // Report progress for analysis phase
      if (onProgress) {
        onProgress({
          currentPage: i + 1,
          totalPages: extractedPages.length,
          percentage: 50 + Math.round(((i + 1) / extractedPages.length) * 50), // 50-100% for analysis
          phase: 'analysing',
        });
      }
    }
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
