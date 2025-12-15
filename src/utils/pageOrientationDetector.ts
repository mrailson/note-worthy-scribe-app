/**
 * Page Orientation Detection Utility
 * Detects if a page is upside-down by comparing content density at top vs bottom
 */

/**
 * Analyse an image to detect if it's upside-down
 * Compares "ink density" (dark pixels) in top vs bottom regions
 * @param dataUrl The image data URL (or blob: URL) to analyse
 * @returns Promise resolving to true if page appears upside-down
 */
export async function isPageUpsideDown(dataUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(false);
          return;
        }

        // Scale down for faster analysis
        const maxSize = 400;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        // Sample top 15% and bottom 15% of the page (avoid very edges)
        const sampleHeight = Math.floor(height * 0.15);
        const edgeMargin = Math.floor(height * 0.03);

        let topDarkPixels = 0;
        let bottomDarkPixels = 0;
        let topTotal = 0;
        let bottomTotal = 0;

        // Analyse top region
        for (let y = edgeMargin; y < edgeMargin + sampleHeight; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const luminance = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
            topTotal++;
            if (luminance < 200) {
              topDarkPixels++;
            }
          }
        }

        // Analyse bottom region
        const bottomStart = height - edgeMargin - sampleHeight;
        for (let y = bottomStart; y < bottomStart + sampleHeight; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const luminance = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
            bottomTotal++;
            if (luminance < 200) {
              bottomDarkPixels++;
            }
          }
        }

        const topDensity = topDarkPixels / topTotal;
        const bottomDensity = bottomDarkPixels / bottomTotal;

        canvas.remove();

        // Document pages typically have headers/titles at top
        // If bottom has significantly more content than top, page is likely upside-down
        const densityDiff = bottomDensity - topDensity;
        const isUpsideDown = (bottomDensity > topDensity * 1.15 && densityDiff > 0.015) || densityDiff > 0.03;

        console.log(
          `[Orientation] Top: ${(topDensity * 100).toFixed(1)}%, Bottom: ${(bottomDensity * 100).toFixed(1)}%, Diff: ${(densityDiff * 100).toFixed(1)}%, Upside-down: ${isUpsideDown}`
        );

        resolve(isUpsideDown);
      } catch {
        resolve(false);
      }
    };

    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}

/**
 * Rotate an image by 180 degrees and return a DATA URL (JPEG)
 */
export async function rotateImage180(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        // Rotate 180 degrees
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        canvas.remove();
        resolve(rotatedDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for rotation'));
    img.src = dataUrl;
  });
}

/**
 * Rotate an image by 180 degrees and return a Blob (useful to avoid huge base64 strings).
 */
export async function rotateImage180ToBlob(
  dataUrl: string,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
  quality: number = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        canvas.toBlob(
          (b) => {
            canvas.remove();
            if (!b) {
              reject(new Error('Failed to create rotated image blob'));
              return;
            }
            resolve(b);
          },
          mime,
          mime === 'image/jpeg' ? quality : undefined
        );
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for rotation'));
    img.src = dataUrl;
  });
}

/**
 * Check and auto-correct upside-down pages
 * @param dataUrl The image data URL
 * @returns Promise resolving to corrected data URL (rotated if needed)
 */
export async function autoCorrectOrientation(dataUrl: string): Promise<{ dataUrl: string; wasRotated: boolean }> {
  try {
    const upsideDown = await isPageUpsideDown(dataUrl);
    if (upsideDown) {
      const rotatedUrl = await rotateImage180(dataUrl);
      return { dataUrl: rotatedUrl, wasRotated: true };
    }
    return { dataUrl, wasRotated: false };
  } catch {
    return { dataUrl, wasRotated: false };
  }
}

/**
 * Preserve-quality variant: rotate into a Blob URL (avoids massive base64 strings).
 *
 * NOTE: Caller is responsible for calling URL.revokeObjectURL() when finished.
 */
export async function autoCorrectOrientationToBlobUrl(
  dataUrl: string,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
  quality: number = 0.92
): Promise<{ dataUrl: string; wasRotated: boolean; blob?: Blob }> {
  try {
    const upsideDown = await isPageUpsideDown(dataUrl);
    if (!upsideDown) return { dataUrl, wasRotated: false };

    const blob = await rotateImage180ToBlob(dataUrl, mime, quality);
    const blobUrl = URL.createObjectURL(blob);
    return { dataUrl: blobUrl, wasRotated: true, blob };
  } catch {
    return { dataUrl, wasRotated: false };
  }
}

