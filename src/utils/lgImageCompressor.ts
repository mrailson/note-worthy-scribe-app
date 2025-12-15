/**
 * LG Capture Client-Side Image Compression
 * 
 * Compresses images BEFORE upload to Supabase Storage.
 * Target: 700px wide, grayscale JPEG at 45% quality.
 * Expected output: ~20-25 KB per text-only Lloyd George page.
 * 
 * Works on iPhone Safari, desktop Chrome/Firefox/Edge.
 */

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
 * @returns Promise<Blob> - Compressed JPEG blob ready for upload
 */
export async function compressLgImageFromDataUrl(dataUrl: string): Promise<Blob> {
  const img = await dataUrlToImage(dataUrl);
  return compressImageElement(img);
}

/**
 * Compress an image File for LG Capture
 * 
 * @param file - The original image File
 * @returns Promise<File> - Compressed JPEG File ready for upload
 */
export async function compressLgImageFile(file: File): Promise<File> {
  const img = await blobToImage(file);
  const compressedBlob = await compressImageElement(img);
  
  // Create a new File with the compressed blob
  const compressedFileName = file.name.replace(/\.(jpe?g|png|heic|webp)$/i, '_c.jpg');
  return new File([compressedBlob], compressedFileName, { type: 'image/jpeg' });
}

/**
 * Core compression logic - works with any HTMLImageElement
 */
async function compressImageElement(img: HTMLImageElement): Promise<Blob> {
  const MAX_WIDTH = 700;  // Balanced width for Lloyd George pages - readable text with good compression
  const JPEG_QUALITY = 0.45;  // 45% quality - balanced between readability and file size
  
  // Calculate scaled dimensions (maintain aspect ratio)
  const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
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
        JPEG_QUALITY
      );
    });
  }
  
  // Draw the scaled image
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  
  // Convert to grayscale using luminance formula
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Standard luminance formula
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = luminance;     // R
    data[i + 1] = luminance; // G
    data[i + 2] = luminance; // B
    // Alpha (data[i + 3]) remains unchanged
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  // Convert to JPEG blob
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log(`Compressed image: ${targetWidth}x${targetHeight}, ${(blob.size / 1024).toFixed(1)} KB`);
          resolve(blob);
        } else {
          console.warn('Canvas toBlob returned null, creating empty blob');
          resolve(new Blob([], { type: 'image/jpeg' }));
        }
      },
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

/**
 * Compress multiple image data URLs for batch upload
 * 
 * @param dataUrls - Array of image data URLs
 * @returns Promise<Blob[]> - Array of compressed JPEG blobs
 */
export async function compressLgImagesFromDataUrls(dataUrls: string[]): Promise<Blob[]> {
  const results: Blob[] = [];
  
  for (let i = 0; i < dataUrls.length; i++) {
    try {
      const compressed = await compressLgImageFromDataUrl(dataUrls[i]);
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
 * @returns Promise<File[]> - Array of compressed JPEG Files
 */
export async function compressLgImageFiles(files: File[]): Promise<File[]> {
  const results: File[] = [];
  
  for (let i = 0; i < files.length; i++) {
    try {
      const compressed = await compressLgImageFile(files[i]);
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
