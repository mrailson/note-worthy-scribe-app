/**
 * Audio Transcoder Utility
 * 
 * DEPRECATED: Client-side transcoding has been removed.
 * All audio preprocessing (resampling, highpass filter, loudness normalisation,
 * FLAC encoding) is now handled server-side by the `transcode-audio` edge function.
 * 
 * Clients upload their native browser format (WebM/Opus or M4A/AAC) directly.
 * This file is retained for backward compatibility — all functions are now
 * pass-throughs that return the original audio unchanged.
 * 
 * CRITICAL RULE: Never force audio/wav or any uncompressed codec on mobile
 * MediaRecorder. The capture codec must remain the browser's native format.
 */

export interface TranscodeOptions {
  targetSampleRate?: number;
  channels?: number;
}

/**
 * @deprecated Server-side transcoding via transcode-audio edge function.
 * Returns the original blob unchanged — no client-side processing.
 */
export async function transcodeToWhisperFormat(
  blob: Blob,
  _options: TranscodeOptions = {}
): Promise<Blob> {
  console.log(`🔄 transcodeToWhisperFormat: pass-through (server-side transcoding active). Size: ${(blob.size / 1024).toFixed(1)}KB, type: ${blob.type}`);
  return blob;
}

/**
 * @deprecated Client-side transcoding is no longer performed.
 * Always returns false — audio is sent in its native browser format.
 */
export function shouldTranscode(_blob: Blob): boolean {
  return false;
}
