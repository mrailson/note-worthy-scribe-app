import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
// Toast messages removed from LG Capture service
import { CapturedImage } from '@/hooks/useLGCapture';
import {
  compressLgImageFromDataUrl,
  compressLgImageFile,
  CompressionLevel,
  DEFAULT_COMPRESSION_LEVEL,
} from '@/utils/lgImageCompressor';

export type ServiceLevel = 'rename_only' | 'index_summary' | 'full_service';
export type LGAIModel = 'gpt-4o-mini' | 'gpt-5';

interface QueuedPatient {
  patientId: string;
  practiceOds: string;
  images: CapturedImage[];
  status: 'queued' | 'uploading' | 'processing' | 'complete' | 'failed';
  uploadProgress: number;
  error?: string;
  fileName?: string;
  fileSize?: number;
  serviceLevel: ServiceLevel;
  aiModel: LGAIModel;
  compressionLevel: CompressionLevel;
  preserveQuality: boolean;
  queuedAt: Date;
}

interface QueuePatientOptions {
  fileName?: string;
  fileSize?: number;
  serviceLevel?: ServiceLevel;
  aiModel?: LGAIModel;
  compressionLevel?: CompressionLevel;
  preserveQuality?: boolean;
}

interface LGUploadQueueContextType {
  queue: QueuedPatient[];
  queuePatient: (patientId: string, practiceOds: string, images: CapturedImage[], options?: QueuePatientOptions) => void;
  removeFromQueue: (patientId: string) => void;
  clearFailed: () => void;
  activeUploads: number;
  isProcessing: boolean;
}

const LGUploadQueueContext = createContext<LGUploadQueueContextType | null>(null);

export const useLGUploadQueue = () => {
  const context = useContext(LGUploadQueueContext);
  if (!context) {
    // Return a safe fallback for read-only usage when provider is missing (HMR edge case)
    console.warn('useLGUploadQueue called outside LGUploadQueueProvider - returning fallback');
    return {
      queue: [],
      queuePatient: () => {
        console.error('Cannot queue patient - provider missing');
      },
      removeFromQueue: () => {},
      clearFailed: () => {},
      activeUploads: 0,
      isProcessing: false,
    } as LGUploadQueueContextType;
  }
  return context;
};

function fileExtensionFromMime(mime: string | undefined): 'png' | 'jpg' {
  if (!mime) return 'png';
  if (mime.includes('png')) return 'png';
  return 'jpg';
}

function cleanupPreserveQualityUrls(patient: QueuedPatient) {
  if (!patient.preserveQuality) return;
  for (const img of patient.images) {
    if (img.dataUrl?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(img.dataUrl);
      } catch {
        // ignore
      }
    }
  }
}

export const LGUploadQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueuedPatient[]>([]);
  const processingCountRef = useRef(0);
  const MAX_CONCURRENT = 3; // Process up to 3 files simultaneously
  const isProcessing = queue.some((q) => q.status === 'uploading' || q.status === 'processing');
  const activeUploads = queue.filter((q) => q.status === 'queued' || q.status === 'uploading').length;

  const queuePatient = useCallback(
    (patientId: string, practiceOds: string, images: CapturedImage[], options?: QueuePatientOptions) => {
      setQueue((prev) => [
        ...prev,
        {
          patientId,
          practiceOds,
          images,
          status: 'queued',
          uploadProgress: 0,
          fileName: options?.fileName,
          fileSize: options?.fileSize,
          serviceLevel: options?.serviceLevel || 'full_service',
          aiModel: options?.aiModel || 'gpt-4o-mini',
          compressionLevel: options?.compressionLevel || DEFAULT_COMPRESSION_LEVEL,
          preserveQuality: options?.preserveQuality || false,
          queuedAt: new Date(),
        },
      ]);
    },
    []
  );

  const removeFromQueue = useCallback(
    (patientId: string) => {
      setQueue((prev) => {
        const item = prev.find((q) => q.patientId === patientId);
        if (item) cleanupPreserveQualityUrls(item);
        return prev.filter((q) => q.patientId !== patientId);
      });
    },
    []
  );

  const clearFailed = useCallback(() => {
    setQueue((prev) => {
      prev.filter((q) => q.status === 'failed').forEach(cleanupPreserveQualityUrls);
      return prev.filter((q) => q.status !== 'failed');
    });
  }, []);

  const processOnePatient = useCallback(async (patient: QueuedPatient) => {
    try {
      // Update status to uploading with start timestamp
      setQueue((prev) =>
        prev.map((q) => (q.patientId === patient.patientId ? { ...q, status: 'uploading' as const } : q))
      );

      // Update DB status with upload start time
      await supabase
        .from('lg_patients')
        .update({
          job_status: 'uploading',
          upload_progress: 0,
          upload_started_at: new Date().toISOString(),
        })
        .eq('id', patient.patientId);

      // Upload images
      // - preserveQuality=true means: prefer the original extracted blobs as the INPUT (best fidelity)
      // - BUT still compress before upload using the selected compressionLevel (keeps file sizes sane)
      const { images, patientId, practiceOds } = patient;

      console.log(
        `Starting upload for ${images.length} images (preserveQuality=${patient.preserveQuality}, compressionLevel=${patient.compressionLevel})`
      );

      for (let i = 0; i < images.length; i++) {
        const img = images[i];

        let sourceBlob: Blob | null = null;

        if (patient.preserveQuality) {
          // Prefer the original extracted blob (e.g. from PDF direct extraction / rotation correction)
          try {
            if (img.blob) {
              sourceBlob = img.blob;
            } else {
              const response = await fetch(img.dataUrl);
              sourceBlob = await response.blob();
            }
          } catch (fetchErr) {
            console.error(`Failed to read page ${i + 1} image data:`, fetchErr);
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            throw new Error(`Failed to process page ${i + 1}: ${msg}`);
          }
        }

        // Compress before upload - skip if already small enough (saves time)
        const SKIP_THRESHOLD_KB = 60;
        let blob: Blob;
        try {
          const sourceSizeKB = sourceBlob ? sourceBlob.size / 1024 : 0;
          
          // Skip compression if source is already small
          if (sourceBlob && sourceSizeKB < SKIP_THRESHOLD_KB) {
            blob = sourceBlob;
            console.log(`Page ${i + 1}: Already small (${sourceSizeKB.toFixed(1)} KB), skipping compression`);
          } else if (sourceBlob) {
            const sourceExt = fileExtensionFromMime(sourceBlob.type);
            const sourceFile = new File([sourceBlob], `page_${i + 1}.${sourceExt}`, {
              type: sourceBlob.type || 'image/jpeg',
            });
            blob = await compressLgImageFile(sourceFile, patient.compressionLevel);
            console.log(`Page ${i + 1}: Compressed to ${(blob.size / 1024).toFixed(1)} KB`);
          } else {
            blob = await compressLgImageFromDataUrl(img.dataUrl, patient.compressionLevel);
            console.log(`Page ${i + 1}: Compressed to ${(blob.size / 1024).toFixed(1)} KB`);
          }
        } catch (compressErr) {
          console.error(`Failed to compress page ${i + 1}, using original:`, compressErr);

          // Last-resort fallback: upload original bytes
          if (sourceBlob) {
            blob = sourceBlob;
          } else if (img.dataUrl.startsWith('blob:')) {
            const response = await fetch(img.dataUrl);
            blob = await response.blob();
          } else {
            const base64Data = img.dataUrl.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let j = 0; j < byteCharacters.length; j++) {
              byteNumbers[j] = byteCharacters.charCodeAt(j);
            }
            const byteArray = new Uint8Array(byteNumbers);
            blob = new Blob([byteArray], { type: 'image/jpeg' });
          }
        }

        // We mostly upload JPEGs (compressor always outputs JPEG)
        const fileExtension: 'png' | 'jpg' = fileExtensionFromMime(blob.type);
        const fileName = `${practiceOds}/${patientId}/raw/page_${String(i + 1).padStart(3, '0')}.${fileExtension}`;

        const { error: uploadError } = await supabase.storage.from('lg').upload(fileName, blob, {
          upsert: true,
          contentType: blob.type || (fileExtension === 'png' ? 'image/png' : 'image/jpeg'),
        });

        if (uploadError) {
          throw new Error(`Failed to upload page ${i + 1}: ${uploadError.message}`);
        }

        // Free memory for blob URLs (preserveQuality mode)
        if (patient.preserveQuality && img.dataUrl.startsWith('blob:')) {
          URL.revokeObjectURL(img.dataUrl);
        }

        // Update progress
        const progress = Math.round(((i + 1) / images.length) * 100);
        setQueue((prev) => prev.map((q) => (q.patientId === patientId ? { ...q, uploadProgress: progress } : q)));

        // Update DB progress
        await supabase.from('lg_patients').update({ upload_progress: progress }).eq('id', patientId);
      }

      // Update images_count and status to queued (ready for processing) with upload complete time
      await supabase
        .from('lg_patients')
        .update({
          images_count: images.length,
          job_status: 'queued',
          upload_progress: 100,
          upload_completed_at: new Date().toISOString(),
        })
        .eq('id', patientId);

      // Update local status
      setQueue((prev) =>
        prev.map((q) => (q.patientId === patientId ? { ...q, status: 'processing' as const, uploadProgress: 100 } : q))
      );

      // Trigger processing (fire and forget) - pass service level and AI model
      supabase.functions
        .invoke('lg-process-patient', {
          body: { patientId, serviceLevel: patient.serviceLevel, aiModel: patient.aiModel },
        })
        .catch((err) => {
          console.error('Processing trigger error:', err);
        });

      // Mark as complete after a delay (processing happens in background)
      setTimeout(() => {
        setQueue((prev) => prev.filter((q) => q.patientId !== patientId));
      }, 3000);
    } catch (err) {
      console.error('Queue processing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';

      setQueue((prev) =>
        prev.map((q) => (q.patientId === patient.patientId ? { ...q, status: 'failed' as const, error: errorMessage } : q))
      );

      await supabase.from('lg_patients').update({ job_status: 'failed', error_message: errorMessage }).eq('id', patient.patientId);

      console.error(`Upload failed: ${errorMessage}`);
    } finally {
      processingCountRef.current--;
    }
  }, []);

  const processQueue = useCallback(
    async () => {
      // Find all queued items and process up to MAX_CONCURRENT
      const queuedItems = queue.filter((q) => q.status === 'queued');
      const slotsAvailable = MAX_CONCURRENT - processingCountRef.current;

      if (slotsAvailable <= 0 || queuedItems.length === 0) return;

      // Take as many items as we have slots for
      const itemsToProcess = queuedItems.slice(0, slotsAvailable);

      for (const item of itemsToProcess) {
        processingCountRef.current++;
        // Process each in parallel (don't await)
        processOnePatient(item);
      }
    },
    [queue, processOnePatient]
  );

  // Process queue when items are added
  useEffect(() => {
    const queuedCount = queue.filter((q) => q.status === 'queued').length;
    if (queuedCount > 0 && processingCountRef.current < MAX_CONCURRENT) {
      processQueue();
    }
  }, [queue, processQueue]);

  // Warn before closing tab if uploads pending
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeUploads > 0) {
        e.preventDefault();
        e.returnValue = `You have ${activeUploads} upload(s) in progress. Are you sure you want to leave?`;
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeUploads]);

  return (
    <LGUploadQueueContext.Provider value={{ queue, queuePatient, removeFromQueue, clearFailed, activeUploads, isProcessing }}>
      {children}
    </LGUploadQueueContext.Provider>
  );
};

