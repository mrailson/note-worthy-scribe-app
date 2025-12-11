/**
 * Blank Page Detection Utility
 * Analyses images to determine if they are blank/empty pages
 */

export interface BlankAnalysisResult {
  isBlank: boolean;
  whitePercentage: number;
  stdDev: number;
  confidence: number;
}

/**
 * Analyse an image data URL to determine if it's a blank page
 * @param dataUrl The image data URL to analyse
 * @param whiteThreshold Percentage of near-white pixels to consider blank (default 95%)
 * @param stdDevThreshold Standard deviation threshold below which image is considered uniform (default 15)
 * @returns Analysis result with isBlank flag and metrics
 */
export async function analyseBlankness(
  dataUrl: string,
  whiteThreshold: number = 85,
  stdDevThreshold: number = 25
): Promise<BlankAnalysisResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Create canvas for analysis
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Use smaller size for faster analysis (max 200px on longest side)
        const maxSize = 200;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);

        // Draw scaled image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Calculate luminance values
        const luminanceValues: number[] = [];
        let nearWhiteCount = 0;
        const totalPixels = pixels.length / 4;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];

          // Calculate luminance (perceived brightness)
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          luminanceValues.push(luminance);

          // Count near-white pixels (luminance > 240)
          if (luminance > 240) {
            nearWhiteCount++;
          }
        }

        // Calculate statistics
        const whitePercentage = (nearWhiteCount / totalPixels) * 100;

        // Calculate mean
        const mean = luminanceValues.reduce((a, b) => a + b, 0) / luminanceValues.length;

        // Calculate standard deviation
        const squaredDiffs = luminanceValues.map(val => Math.pow(val - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
        const stdDev = Math.sqrt(avgSquaredDiff);

        // Determine if blank - detect aged/yellowed blank pages from old Lloyd George scans
        // Blank if: >85% near-white pixels AND reasonably uniform (stdDev < 25)
        // Also catch yellowed blanks with lower white% but very uniform appearance
        const isBlank = (whitePercentage > whiteThreshold && stdDev < stdDevThreshold) ||
          (whitePercentage > 70 && stdDev < 18) ||  // Yellowed but uniform
          (whitePercentage > 60 && stdDev < 12);    // Very yellowed but very uniform

        // Calculate confidence (how sure we are it's blank)
        let confidence = 0;
        if (isBlank) {
          if (whitePercentage > 95) {
            confidence = 0.99;
          } else if (whitePercentage > 85) {
            confidence = 0.95;
          } else if (whitePercentage > 70) {
            confidence = 0.85;
          } else {
            confidence = 0.75;
          }
        }

        // Clean up
        canvas.remove();

        resolve({
          isBlank,
          whitePercentage: Math.round(whitePercentage * 10) / 10,
          stdDev: Math.round(stdDev * 10) / 10,
          confidence,
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for blank analysis'));
    };

    img.src = dataUrl;
  });
}

/**
 * Batch analyse multiple images for blankness
 * @param dataUrls Array of image data URLs
 * @param onProgress Optional progress callback
 * @returns Array of analysis results in same order as input
 */
export async function batchAnalyseBlankness(
  dataUrls: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<BlankAnalysisResult[]> {
  const results: BlankAnalysisResult[] = [];

  for (let i = 0; i < dataUrls.length; i++) {
    try {
      const result = await analyseBlankness(dataUrls[i]);
      results.push(result);
    } catch {
      // If analysis fails, assume not blank
      results.push({
        isBlank: false,
        whitePercentage: 0,
        stdDev: 100,
        confidence: 0,
      });
    }

    if (onProgress) {
      onProgress(i + 1, dataUrls.length);
    }
  }

  return results;
}
