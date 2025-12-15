import * as pdfjsLib from 'pdfjs-dist';
import { analyseBlankness, BlankAnalysisResult } from './blankPageDetector';
import { autoCorrectOrientation, autoCorrectOrientationToBlobUrl } from './pageOrientationDetector';
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
  /**
   * Optional original image blob (used for preserve-quality workflows).
   * If present, uploads should prefer this over fetch(dataUrl).
   */
  blob?: Blob;
}

export interface PdfExtractionProgress {
  currentPage: number;
  totalPages: number;
  percentage: number;
  phase?: 'extracting' | 'analysing' | 'correcting';
}

/**
 * Attempt to extract the original embedded image from a PDF page.
 * Returns null if extraction fails or page has multiple/no images.
 */
async function tryExtractEmbeddedImage(page: any): Promise<{ blob: Blob; width: number; height: number } | null> {
  try {
    const operatorList = await page.getOperatorList();
    const ops = operatorList.fnArray;
    const args = operatorList.argsArray;
    
    // Find paintImageXObject operations (OPS.paintImageXObject = 85)
    const imageOps: number[] = [];
    for (let i = 0; i < ops.length; i++) {
      if (ops[i] === 85) { // paintImageXObject
        imageOps.push(i);
      }
    }
    
    // Only extract if there's exactly one image (typical for scanned pages)
    if (imageOps.length !== 1) {
      console.log(`[DirectExtract] Page has ${imageOps.length} images, falling back to render`);
      return null;
    }
    
    const imageIndex = imageOps[0];
    const imageName = args[imageIndex][0];
    
    // Get the image object from the page's object dictionary
    const objs = page.objs;
    const imageData = objs.get(imageName);
    
    if (!imageData || !imageData.data) {
      console.log('[DirectExtract] Could not get image data object');
      return null;
    }
    
    const { width, height, data, kind } = imageData;
    
    // kind: 1 = GRAYSCALE, 2 = RGB, 3 = RGBA
    // For JPEG images embedded in PDF, we need to reconstruct
    if (!width || !height || !data) {
      console.log('[DirectExtract] Missing image dimensions or data');
      return null;
    }
    
    // Create canvas to convert raw pixel data to JPEG
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Create ImageData from the raw pixels
    const imageDataObj = ctx.createImageData(width, height);
    const pixels = imageDataObj.data;
    
    if (kind === 1) {
      // Grayscale - expand to RGBA
      for (let i = 0, j = 0; i < data.length; i++, j += 4) {
        pixels[j] = data[i];     // R
        pixels[j + 1] = data[i]; // G
        pixels[j + 2] = data[i]; // B
        pixels[j + 3] = 255;     // A
      }
    } else if (kind === 2) {
      // RGB - add alpha
      for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
        pixels[j] = data[i];       // R
        pixels[j + 1] = data[i + 1]; // G
        pixels[j + 2] = data[i + 2]; // B
        pixels[j + 3] = 255;         // A
      }
    } else if (kind === 3) {
      // RGBA - copy directly
      pixels.set(data);
    } else {
      console.log(`[DirectExtract] Unknown image kind: ${kind}`);
      return null;
    }
    
    ctx.putImageData(imageDataObj, 0, 0);
    
    // Convert to JPEG blob - balanced quality for readable scanned documents
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
        'image/jpeg',
        0.15 // Minimum viable quality
      );
    });
    
    canvas.remove();
    
    console.log(`[DirectExtract] Successfully extracted ${width}x${height} image (${(blob.size / 1024).toFixed(1)}KB)`);
    return { blob, width, height };
  } catch (err) {
    console.log('[DirectExtract] Extraction failed:', err);
    return null;
  }
}

/**
 * Extract all pages from a PDF file as images
 * @param file PDF file to extract pages from
 * @param dpi Target DPI for rendering (default 150 for balance of quality/size)
 * @param onProgress Callback for extraction progress
 * @param detectBlanks Whether to run blank page detection (default true)
 * @param preserveQuality Whether to keep original visual fidelity (direct extraction or high-quality render)
 * @returns Array of extracted page images
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
  console.log(`PDF loaded: ${file.name} - ${totalPages} pages, preserveQuality=${preserveQuality}`);
  const extractedPages: ExtractedPage[] = [];

  // Scale factor: PDF default is 72 DPI
  // Only used as fallback if direct extraction fails
  const fallbackDpi = preserveQuality ? 150 : dpi; // Lower DPI for fallback since quality mode prefers direct extraction
  const scale = fallbackDpi / 72;

  // Phase 1: Extract pages
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 }); // Get natural viewport for dimensions
    
    let dataUrl: string;
    let blob: Blob | undefined;
    let pageWidth: number;
    let pageHeight: number;
    let usedDirectExtraction = false;

    // In preserveQuality mode, try direct image extraction first
    if (preserveQuality) {
      const extracted = await tryExtractEmbeddedImage(page);
      if (extracted) {
        blob = extracted.blob;
        dataUrl = URL.createObjectURL(blob);
        pageWidth = extracted.width;
        pageHeight = extracted.height;
        usedDirectExtraction = true;
        console.log(`[Page ${pageNum}] Direct extraction: ${pageWidth}x${pageHeight}, ${(blob.size / 1024).toFixed(1)}KB`);
      }
    }

    // Fallback: render to canvas (for non-image pages or when direct extraction fails)
    if (!usedDirectExtraction) {
      const renderViewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      canvas.width = renderViewport.width;
      canvas.height = renderViewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: renderViewport,
        canvas,
      }).promise;

      pageWidth = renderViewport.width;
      pageHeight = renderViewport.height;

      if (preserveQuality) {
        // Fallback render with balanced quality
        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Failed to create JPEG blob'))),
            'image/jpeg',
            0.15
          );
        });
        dataUrl = URL.createObjectURL(blob);
        console.log(`[Page ${pageNum}] Fallback render: ${pageWidth}x${pageHeight}, ${(blob.size / 1024).toFixed(1)}KB`);
      } else {
        dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }

      canvas.remove();
    }

    extractedPages.push({
      pageNumber: pageNum,
      dataUrl,
      width: pageWidth,
      height: pageHeight,
      isBlank: false,
      blankConfidence: 0,
      wasRotated: false,
      blob,
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

      console.log(
        `[PDF Extractor] First page text for patch detection: "${firstPageText.substring(0, 100)}..."`
      );

      // Use TEXT-BASED detection only (not visual) to avoid false positives
      const patchResult = detectPatchPageFromText(firstPageText);
      extractedPages[0].isPatchPage = patchResult.isPatchPage;
      extractedPages[0].patchConfidence = patchResult.confidence;

      if (patchResult.isPatchPage) {
        console.log(
          `[PDF Extractor] First page detected as patch page with ${(patchResult.confidence * 100).toFixed(
            0
          )}% confidence. Pattern: ${patchResult.matchedPattern}`
        );
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
          if (preserveQuality) {
            // Preserve-quality: keep blob-based pipeline (avoid converting to huge base64)
            const { dataUrl: correctedUrl, wasRotated, blob } = await autoCorrectOrientationToBlobUrl(
              page.dataUrl,
              'image/jpeg',
              0.15
            );

          if (wasRotated && blob) {
            if (page.dataUrl.startsWith('blob:')) {
              URL.revokeObjectURL(page.dataUrl);
            }

            extractedPages[i].dataUrl = correctedUrl;
            extractedPages[i].blob = blob;
            extractedPages[i].wasRotated = true;
            console.log(`Page ${page.pageNumber} was upside-down and has been rotated`);
          }
        } else {
          const { dataUrl: correctedUrl, wasRotated } = await autoCorrectOrientation(page.dataUrl);
          if (wasRotated) {
            extractedPages[i].dataUrl = correctedUrl;
            extractedPages[i].wasRotated = true;
            console.log(`Page ${page.pageNumber} was upside-down and has been rotated`);
          }
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

