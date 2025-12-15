import * as pdfjsLib from 'pdfjs-dist';
import { analyseBlankness, BlankAnalysisResult } from './blankPageDetector';
import { autoCorrectOrientation } from './pageOrientationDetector';
import { detectPatchPageFromText } from './patchPageDetector';

// Configure PDF.js worker - use the bundled worker (no external CDN)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ExtractedPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  isBlank?: boolean;
  blankConfidence?: number;
  wasRotated?: boolean;
  isPatchPage?: boolean;
  patchConfidence?: number;
}

export interface PdfExtractionProgress {
  currentPage: number;
  totalPages: number;
  percentage: number;
  phase?: 'extracting' | 'analysing' | 'correcting';
}

/**
 * Extract all pages from a PDF file as images
 * @param file PDF file to extract pages from
 * @param dpi Target DPI for rendering (default 150 for balance of quality/size)
 * @param onProgress Callback for extraction progress
 * @param detectBlanks Whether to run blank page detection (default true)
 * @param preserveQuality Whether to extract at high quality (300 DPI, PNG) for pre-optimised scans
 * @returns Array of extracted page images as data URLs
 */
export async function extractPdfPages(
  file: File,
  dpi: number = 150,
  onProgress?: (progress: PdfExtractionProgress) => void,
  detectBlanks: boolean = true,
  preserveQuality: boolean = false
): Promise<ExtractedPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  console.log(`PDF loaded: ${file.name} - ${totalPages} pages detected`);
  const extractedPages: ExtractedPage[] = [];

  // Scale factor: PDF default is 72 DPI
  // Use 300 DPI for preserve quality mode to maintain original scan resolution
  const effectiveDpi = preserveQuality ? 300 : dpi;
  const scale = effectiveDpi / 72;

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

    // Convert to image reference
    // Preserve quality mode: use PNG blob URL to avoid massive base64 data URLs (can exceed browser limits)
    // Normal mode: JPEG data URL for speed/size
    let dataUrl: string;
    if (preserveQuality) {
      const pngBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create PNG blob'))), 'image/png');
      });
      dataUrl = URL.createObjectURL(pngBlob);
    } else {
      dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    }

    extractedPages.push({
      pageNumber: pageNum,
      dataUrl,
      width: viewport.width,
      height: viewport.height,
      isBlank: false,
      blankConfidence: 0,
      wasRotated: false,
    });

    // Report progress - split between 3 phases
    if (onProgress) {
      onProgress({
        currentPage: pageNum,
        totalPages,
        percentage: detectBlanks 
          ? Math.round((pageNum / totalPages) * 33) // 0-33% for extraction
          : Math.round((pageNum / totalPages) * 100),
        phase: 'extracting',
      });
    }

    // Clean up
    canvas.remove();
  }

  // Phase 1.5: Detect patch page on FIRST PAGE ONLY using OCR text (safety constraint)
  // Only check if we have at least 2 pages (never reduce to empty)
  if (extractedPages.length >= 2) {
    try {
      // Extract text from first page using pdf.js
      const firstPdfPage = await pdf.getPage(1);
      const textContent = await firstPdfPage.getTextContent();
      const firstPageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();
      
      console.log(`[PDF Extractor] First page text for patch detection: "${firstPageText.substring(0, 100)}..."`);
      
      // Use TEXT-BASED detection only (not visual) to avoid false positives
      const patchResult = detectPatchPageFromText(firstPageText);
      extractedPages[0].isPatchPage = patchResult.isPatchPage;
      extractedPages[0].patchConfidence = patchResult.confidence;
      
      if (patchResult.isPatchPage) {
        console.log(`[PDF Extractor] First page detected as patch page with ${(patchResult.confidence * 100).toFixed(0)}% confidence. Pattern: ${patchResult.matchedPattern}`);
      }
    } catch (err) {
      console.error('[PDF Extractor] Patch detection failed:', err);
      // If detection fails, don't mark as patch page
      extractedPages[0].isPatchPage = false;
      extractedPages[0].patchConfidence = 0;
    }
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
          percentage: 33 + Math.round(((i + 1) / extractedPages.length) * 33), // 33-66% for analysis
          phase: 'analysing',
        });
      }
    }
  }

  // Phase 3: Auto-correct upside-down pages (portrait pages only)
  for (let i = 0; i < extractedPages.length; i++) {
    const page = extractedPages[i];
    
    // Only correct portrait pages (height > width * 0.9)
    // Sideways/landscape pages are left as-is per user request
    const isPortrait = page.height > page.width * 0.9;
    
    if (isPortrait) {
      try {
        const { dataUrl: correctedUrl, wasRotated } = await autoCorrectOrientation(page.dataUrl);
        if (wasRotated) {
          extractedPages[i].dataUrl = correctedUrl;
          extractedPages[i].wasRotated = true;
          console.log(`Page ${page.pageNumber} was upside-down and has been rotated`);
        }
      } catch {
        // If orientation check fails, leave page as-is
      }
    }

    // Report progress for orientation correction phase
    if (onProgress) {
      onProgress({
        currentPage: i + 1,
        totalPages: extractedPages.length,
        percentage: detectBlanks 
          ? 66 + Math.round(((i + 1) / extractedPages.length) * 34) // 66-100% for correction
          : 50 + Math.round(((i + 1) / extractedPages.length) * 50), // 50-100% if no blank detection
        phase: 'correcting',
      });
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
