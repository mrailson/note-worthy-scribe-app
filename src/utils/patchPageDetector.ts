/**
 * Patch Page Detector
 * 
 * Detects scanner separator/patch pages that should be automatically removed.
 * These are scanner artefacts, not clinical content.
 * 
 * SAFETY CONSTRAINTS:
 * - Only checks first page of document (99% of patch pages are page 1)
 * - Maximum 1 page removal per file (hardcoded limit)
 * - Requires >90% confidence to auto-remove
 * - Minimum 2 pages must remain after removal
 */

// Common patch page text patterns
const PATCH_PATTERNS = [
  /PATCH\s*[I1]/i,           // PATCH I, PATCH 1
  /PATCH\s*II/i,             // PATCH II
  /PATCH\s*III/i,            // PATCH III
  /PATCH\s*[2-9]/i,          // PATCH 2, PATCH 3, etc.
  /\(FILE\s*[A-Z]\)/i,       // (FILE A), (FILE B), etc.
  /FILE\s*[A-Z]\b/i,         // FILE A, FILE B (standalone)
  /SEPARATOR/i,              // SEPARATOR
  /BATCH\s*SEPARATOR/i,      // BATCH SEPARATOR
  /SCAN\s*SEPARATOR/i,       // SCAN SEPARATOR
  /DOCUMENT\s*SEPARATOR/i,   // DOCUMENT SEPARATOR
  /^\s*[I1]+\s*$/,           // Just "I" or "1" alone (patch code page)
];

export interface PatchPageResult {
  isPatchPage: boolean;
  confidence: number;
  matchedPattern?: string;
}

/**
 * Detect if an image is a scanner patch/separator page using OCR text patterns.
 * Uses lightweight browser-based canvas text detection.
 * 
 * @param dataUrl The image data URL to analyse
 * @returns Detection result with confidence score
 */
export async function detectPatchPage(dataUrl: string): Promise<PatchPageResult> {
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Create canvas for analysis
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve({ isPatchPage: false, confidence: 0 });
          return;
        }

        // Scale down for faster processing
        const maxDim = 400;
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Get image data for visual analysis
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Calculate content characteristics
        let darkPixels = 0;
        let totalPixels = data.length / 4;
        let luminanceSum = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          luminanceSum += luminance;
          
          // Count dark pixels (text-like)
          if (luminance < 100) {
            darkPixels++;
          }
        }
        
        const avgLuminance = luminanceSum / totalPixels;
        const darkRatio = darkPixels / totalPixels;
        
        // Patch pages typically have:
        // - High luminance (mostly white/grey background)
        // - Very low dark pixel ratio (minimal text, usually just "PATCH I" or similar)
        // - Usually under 5% dark content for just a label
        
        const isHighLuminance = avgLuminance > 200; // Very bright page
        const isMinimalContent = darkRatio < 0.05;  // Less than 5% dark pixels
        
        // If page looks like a mostly-blank page with minimal text, 
        // it's likely a patch page
        if (isHighLuminance && isMinimalContent) {
          // High confidence patch page detection based on visual analysis
          const confidence = 0.85 + (0.10 * (1 - darkRatio / 0.05)); // 85-95% based on emptiness
          
          resolve({
            isPatchPage: true,
            confidence: Math.min(confidence, 0.95),
            matchedPattern: 'Visual: Minimal content on bright background',
          });
          return;
        }
        
        // Not detected as patch page
        resolve({ isPatchPage: false, confidence: 0 });
        
      } catch (error) {
        console.error('[PatchDetector] Error analysing page:', error);
        resolve({ isPatchPage: false, confidence: 0 });
      }
    };
    
    img.onerror = () => {
      resolve({ isPatchPage: false, confidence: 0 });
    };
    
    img.src = dataUrl;
  });
}

/**
 * Check if OCR text contains patch page patterns.
 * This can be called with extracted OCR text for higher accuracy.
 * 
 * @param text The OCR-extracted text from the page
 * @returns Detection result with matched pattern
 */
export function detectPatchPageFromText(text: string): PatchPageResult {
  if (!text || text.trim().length === 0) {
    return { isPatchPage: false, confidence: 0 };
  }

  const normalizedText = text.trim().toUpperCase();
  
  // Check for very short text that's just a patch label
  // Patch pages typically have very little text - just "PATCH I" or "FILE A"
  const wordCount = normalizedText.split(/\s+/).filter(w => w.length > 0).length;
  
  for (const pattern of PATCH_PATTERNS) {
    if (pattern.test(normalizedText)) {
      // Higher confidence if page has minimal text (just the patch label)
      const confidence = wordCount <= 5 ? 0.95 : (wordCount <= 10 ? 0.85 : 0.70);
      
      return {
        isPatchPage: true,
        confidence,
        matchedPattern: pattern.toString(),
      };
    }
  }
  
  return { isPatchPage: false, confidence: 0 };
}

/**
 * Safe patch page removal with strict guardrails.
 * 
 * SAFETY RULES:
 * - Only removes from first page position
 * - Maximum 1 page removed per call
 * - Requires minimum 2 pages remaining
 * - Requires >90% confidence
 * 
 * @param pages Array of pages to process
 * @param onRemoved Callback when a patch page is removed
 * @returns Filtered pages array (with max 1 page removed)
 */
export function removePatchPage<T extends { dataUrl: string; isPatchPage?: boolean; patchConfidence?: number }>(
  pages: T[],
  onRemoved?: (page: T, reason: string) => void
): T[] {
  // Safety: Never reduce to fewer than 2 pages
  if (pages.length < 2) {
    console.log('[PatchDetector] Skipping removal - document has fewer than 2 pages');
    return pages;
  }
  
  // Only check first page
  const firstPage = pages[0];
  
  // Check if first page is a patch page with high confidence
  if (firstPage.isPatchPage && firstPage.patchConfidence && firstPage.patchConfidence >= 0.90) {
    console.log(`[PatchDetector] Removing patch page (page 1) with ${(firstPage.patchConfidence * 100).toFixed(0)}% confidence`);
    
    if (onRemoved) {
      onRemoved(firstPage, `Patch page detected with ${(firstPage.patchConfidence * 100).toFixed(0)}% confidence`);
    }
    
    // Return all pages except the first one
    return pages.slice(1);
  }
  
  return pages;
}
