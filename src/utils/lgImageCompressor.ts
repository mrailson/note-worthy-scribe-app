/**
 * LG Capture Client-Side Image Compression
 * 
 * Compresses images BEFORE upload to Supabase Storage.
 * Converts to TRUE BLACK & WHITE (1-bit threshold) for scanned documents.
 * Configurable compression levels 1-7 for file size vs quality balance.
 * 
 * Works on iPhone Safari, desktop Chrome/Firefox/Edge.
 */

// Compression level configuration (1 = smallest, 7 = best quality)
export type CompressionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface CompressionSettings {
  maxWidth: number;
  quality: number;
  label: string;
  description: string;
  estimatedSize: string;
}

// Levels 1-4 use true black & white (threshold at 128) for very small files.
// Levels 5-7 keep grayscale to preserve faint handwriting/low-contrast scans.
export const COMPRESSION_LEVELS: Record<CompressionLevel, CompressionSettings> = {
  1: { maxWidth: 500, quality: 0.30, label: 'Minimum', description: 'Smallest files', estimatedSize: '~8-12 KB/page' },
  2: { maxWidth: 550, quality: 0.35, label: 'Very Low', description: 'Very compressed', estimatedSize: '~10-15 KB/page' },
  3: { maxWidth: 600, quality: 0.40, label: 'Low', description: 'Small files', estimatedSize: '~12-18 KB/page' },
  4: { maxWidth: 700, quality: 0.45, label: 'Balanced', description: 'Default (smaller files)', estimatedSize: '~15-22 KB/page' },
  5: { maxWidth: 800, quality: 0.55, label: 'Good', description: 'Better readability', estimatedSize: '~20-35 KB/page' },
  6: { maxWidth: 900, quality: 0.65, label: 'High', description: 'High readability', estimatedSize: '~35-55 KB/page' },
  7: { maxWidth: 1200, quality: 0.80, label: 'Maximum', description: 'Best readability', estimatedSize: '~60-100 KB/page' },
};

// Default tuned for readability (scanned clinical documents must remain legible)
export const DEFAULT_COMPRESSION_LEVEL: CompressionLevel = 6;

export function getCompressionSettings(level: number): CompressionSettings {
  const safeLevel = Math.max(1, Math.min(7, Math.round(level))) as CompressionLevel;
  return COMPRESSION_LEVELS[safeLevel];
}

// Convert a File or Blob to an HTMLImageElement
function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

// Convert a data URL to an HTMLImageElement
function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image from data URL'));
    img.src = dataUrl;
  });
}

/**
 * Compress a single image (from data URL) for LG Capture
 * 
 * @param dataUrl - The image data URL (from camera capture or file upload)
 * @param level - Compression level 1-7 (default 4 = Balanced)
 * @returns Promise<Blob> - Compressed JPEG blob ready for upload
 */
export async function compressLgImageFromDataUrl(dataUrl: string, level: CompressionLevel = DEFAULT_COMPRESSION_LEVEL): Promise<Blob> {
  const img = await dataUrlToImage(dataUrl);
  return compressImageElement(img, level);
}

/**
 * Compress an image File for LG Capture
 * 
 * @param file - The original image File
 * @param level - Compression level 1-7 (default 4 = Balanced)
 * @returns Promise<File> - Compressed JPEG File ready for upload
 */
export async function compressLgImageFile(file: File, level: CompressionLevel = DEFAULT_COMPRESSION_LEVEL): Promise<File> {
  const img = await blobToImage(file);
  const compressedBlob = await compressImageElement(img, level);
  
  // Create a new File with the compressed blob
  const compressedFileName = file.name.replace(/\.(jpe?g|png|heic|webp)$/i, '_c.jpg');
  return new File([compressedBlob], compressedFileName, { type: 'image/jpeg' });
}

/**
 * Core compression logic - works with any HTMLImageElement
 *
 * Levels 1-4: binarise to true black/white (smallest files)
 * Levels 5-7: keep grayscale (better readability for faint text)
 */
async function compressImageElement(img: HTMLImageElement, level: CompressionLevel = DEFAULT_COMPRESSION_LEVEL): Promise<Blob> {
  const settings = getCompressionSettings(level);
  const { maxWidth, quality } = settings;
  const THRESHOLD = 128; // Used only for levels 1-4
  const keepGrayscale = level >= 5;
  
  // Calculate scaled dimensions (maintain aspect ratio)
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('Could not get 2D context, returning original as JPEG');
    // Fallback: just convert to JPEG without compression
    return new Promise((resolve) => {
      canvas.width = img.width;
      canvas.height = img.height;
      const fallbackCtx = canvas.getContext('2d')!;
      fallbackCtx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => resolve(blob || new Blob([], { type: 'image/jpeg' })),
        'image/jpeg',
        quality
      );
    });
  }
  
  // Draw the scaled image
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  
  // Post-process pixels for legibility
  // - Lower levels: true black/white reduces size but can lose faint handwriting
  // - Higher levels: grayscale preserves low-contrast detail
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Calculate luminance
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    const v = keepGrayscale
      ? Math.max(0, Math.min(255, Math.round(luminance)))
      : (luminance >= THRESHOLD ? 255 : 0);

    data[i] = v;     // R
    data[i + 1] = v; // G
    data[i + 2] = v; // B
    // Alpha (data[i + 3]) remains unchanged
  }
  ctx.putImageData(imageData, 0, 0);
  
  // Convert to JPEG blob
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log(`Compressed image (level ${level}): ${targetWidth}x${targetHeight}, ${(blob.size / 1024).toFixed(1)} KB`);
          resolve(blob);
        } else {
          console.warn('Canvas toBlob returned null, creating empty blob');
          resolve(new Blob([], { type: 'image/jpeg' }));
        }
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Compress multiple image data URLs for batch upload
 * 
 * @param dataUrls - Array of image data URLs
 * @param level - Compression level 1-7 (default 4 = Balanced)
 * @returns Promise<Blob[]> - Array of compressed JPEG blobs
 */
export async function compressLgImagesFromDataUrls(dataUrls: string[], level: CompressionLevel = DEFAULT_COMPRESSION_LEVEL): Promise<Blob[]> {
  const results: Blob[] = [];
  
  for (let i = 0; i < dataUrls.length; i++) {
    try {
      const compressed = await compressLgImageFromDataUrl(dataUrls[i], level);
      results.push(compressed);
      console.log(`Compressed page ${i + 1}/${dataUrls.length}`);
    } catch (err) {
      console.error(`Failed to compress page ${i + 1}:`, err);
      // Return an empty blob for failed pages (will be skipped in PDF)
      results.push(new Blob([], { type: 'image/jpeg' }));
    }
  }
  
  return results;
}

/**
 * Compress multiple Files for batch upload
 * 
 * @param files - Array of image Files
 * @param level - Compression level 1-7 (default 4 = Balanced)
 * @returns Promise<File[]> - Array of compressed JPEG Files
 */
export async function compressLgImageFiles(files: File[], level: CompressionLevel = DEFAULT_COMPRESSION_LEVEL): Promise<File[]> {
  const results: File[] = [];
  
  for (let i = 0; i < files.length; i++) {
    try {
      const compressed = await compressLgImageFile(files[i], level);
      results.push(compressed);
      console.log(`Compressed file ${i + 1}/${files.length}`);
    } catch (err) {
      console.error(`Failed to compress file ${i + 1}:`, err);
      // Keep original file if compression fails
      results.push(files[i]);
    }
  }
  
  return results;
}
