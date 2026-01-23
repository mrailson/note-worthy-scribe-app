/**
 * Image optimisation utilities for reducing base64 image sizes
 * before sending to edge functions.
 */

const MAX_IMAGE_SIZE_KB = 800; // Max size in KB before compression
const TARGET_MAX_DIMENSION = 1536; // Max dimension for reference images

/**
 * Calculate the approximate size of a base64 string in KB
 */
export function getBase64SizeKB(base64: string): number {
  // Remove data URL prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  // Base64 encodes 3 bytes as 4 characters, so size = (length * 3) / 4
  const sizeBytes = (base64Data.length * 3) / 4;
  return Math.round(sizeBytes / 1024);
}

/**
 * Compress and resize an image if it exceeds size threshold
 * Returns the optimised base64 data URL
 */
export async function optimiseImageForUpload(
  imageDataUrl: string,
  options: {
    maxSizeKB?: number;
    maxDimension?: number;
    quality?: number;
  } = {}
): Promise<{ 
  optimised: string; 
  originalSizeKB: number; 
  finalSizeKB: number; 
  wasOptimised: boolean;
}> {
  const {
    maxSizeKB = MAX_IMAGE_SIZE_KB,
    maxDimension = TARGET_MAX_DIMENSION,
    quality = 0.85
  } = options;

  const originalSizeKB = getBase64SizeKB(imageDataUrl);
  
  // If already small enough, return as-is
  if (originalSizeKB <= maxSizeKB) {
    return {
      optimised: imageDataUrl,
      originalSizeKB,
      finalSizeKB: originalSizeKB,
      wasOptimised: false
    };
  }

  console.log(`🖼️ Optimising image: ${originalSizeKB}KB -> target ${maxSizeKB}KB`);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to create canvas context'));
          return;
        }

        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw with smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try JPEG for photos (usually smaller), PNG for graphics
        const mimeType = imageDataUrl.includes('image/png') && originalSizeKB < 500 
          ? 'image/png' 
          : 'image/jpeg';
        
        // Progressive quality reduction if still too large
        let currentQuality = quality;
        let optimised = canvas.toDataURL(mimeType, currentQuality);
        let finalSizeKB = getBase64SizeKB(optimised);

        // Reduce quality until size is acceptable (minimum 0.5)
        while (finalSizeKB > maxSizeKB && currentQuality > 0.5) {
          currentQuality -= 0.1;
          optimised = canvas.toDataURL('image/jpeg', currentQuality);
          finalSizeKB = getBase64SizeKB(optimised);
        }

        console.log(`✅ Image optimised: ${originalSizeKB}KB -> ${finalSizeKB}KB (quality: ${Math.round(currentQuality * 100)}%)`);

        resolve({
          optimised,
          originalSizeKB,
          finalSizeKB,
          wasOptimised: true
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for optimisation'));
    };

    img.src = imageDataUrl;
  });
}

/**
 * Check if an image exceeds the recommended size threshold
 */
export function isImageTooLarge(imageDataUrl: string, maxSizeKB = MAX_IMAGE_SIZE_KB): boolean {
  return getBase64SizeKB(imageDataUrl) > maxSizeKB;
}
