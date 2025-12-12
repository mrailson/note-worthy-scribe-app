import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CapturedImage } from '@/hooks/useLGCapture';
import { compressLgImageFromDataUrl } from '@/utils/lgImageCompressor';

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
  queuedAt: Date;
}

interface QueuePatientOptions {
  fileName?: string;
  fileSize?: number;
  serviceLevel?: ServiceLevel;
  aiModel?: LGAIModel;
}

interface LGUploadQueueContextType {
  queue: QueuedPatient[];
  queuePatient: (patientId: string, practiceOds: string, images: CapturedImage[], options?: QueuePatientOptions) => void;
  activeUploads: number;
  isProcessing: boolean;
}

const LGUploadQueueContext = createContext<LGUploadQueueContextType | null>(null);

export const useLGUploadQueue = () => {
  const context = useContext(LGUploadQueueContext);
  if (!context) {
    throw new Error('useLGUploadQueue must be used within LGUploadQueueProvider');
  }
  return context;
};

export const LGUploadQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<QueuedPatient[]>([]);
  const processingCountRef = useRef(0);
  const MAX_CONCURRENT = 3; // Process up to 3 files simultaneously
  const isProcessing = queue.some(q => q.status === 'uploading' || q.status === 'processing');
  const activeUploads = queue.filter(q => q.status === 'queued' || q.status === 'uploading').length;

  const queuePatient = useCallback((patientId: string, practiceOds: string, images: CapturedImage[], options?: QueuePatientOptions) => {
    setQueue(prev => [...prev, {
      patientId,
      practiceOds,
      images,
      status: 'queued',
      uploadProgress: 0,
      fileName: options?.fileName,
      fileSize: options?.fileSize,
      serviceLevel: options?.serviceLevel || 'full_service',
      aiModel: options?.aiModel || 'gpt-4o-mini',
      queuedAt: new Date()
    }]);
  }, []);

  const processOnePatient = useCallback(async (patient: QueuedPatient) => {
    try {
      // Update status to uploading with start timestamp
      setQueue(prev => prev.map(q => 
        q.patientId === patient.patientId 
          ? { ...q, status: 'uploading' as const } 
          : q
      ));

      // Update DB status with upload start time
      await supabase
        .from('lg_patients')
        .update({ 
          job_status: 'uploading', 
          upload_progress: 0,
          upload_started_at: new Date().toISOString()
        })
        .eq('id', patient.patientId);

      // Upload images one by one with CLIENT-SIDE COMPRESSION
      const { images, patientId, practiceOds } = patient;
      
      console.log(`Starting upload with client-side compression for ${images.length} images`);
      
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        // COMPRESS IMAGE CLIENT-SIDE before upload
        // Target: 600px wide, grayscale, 40% JPEG quality
        let blob: Blob;
        try {
          blob = await compressLgImageFromDataUrl(img.dataUrl);
          console.log(`Page ${i + 1}: Compressed to ${(blob.size / 1024).toFixed(1)} KB`);
        } catch (compressErr) {
          console.error(`Failed to compress page ${i + 1}, using original:`, compressErr);
          // Fallback to original if compression fails
          const base64Data = img.dataUrl.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: 'image/jpeg' });
        }

        const fileName = `${practiceOds}/${patientId}/raw/page_${String(i + 1).padStart(3, '0')}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('lg')
          .upload(fileName, blob, { upsert: true });

        if (uploadError) {
          throw new Error(`Failed to upload page ${i + 1}: ${uploadError.message}`);
        }

        // Update progress
        const progress = Math.round(((i + 1) / images.length) * 100);
        setQueue(prev => prev.map(q => 
          q.patientId === patientId 
            ? { ...q, uploadProgress: progress } 
            : q
        ));

        // Update DB progress
        await supabase
          .from('lg_patients')
          .update({ upload_progress: progress })
          .eq('id', patientId);
      }

      // Update images_count and status to queued (ready for processing) with upload complete time
      await supabase
        .from('lg_patients')
        .update({ 
          images_count: images.length, 
          job_status: 'queued',
          upload_progress: 100,
          upload_completed_at: new Date().toISOString()
        })
        .eq('id', patientId);

      // Update local status
      setQueue(prev => prev.map(q => 
        q.patientId === patientId 
          ? { ...q, status: 'processing' as const, uploadProgress: 100 } 
          : q
      ));

      // Trigger processing (fire and forget) - pass service level and AI model
      supabase.functions.invoke('lg-process-patient', {
        body: { patientId, serviceLevel: patient.serviceLevel, aiModel: patient.aiModel }
      }).catch(err => {
        console.error('Processing trigger error:', err);
      });

      // Mark as complete after a delay (processing happens in background)
      setTimeout(() => {
        setQueue(prev => prev.filter(q => q.patientId !== patientId));
      }, 3000);

    } catch (err) {
      console.error('Queue processing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      
      setQueue(prev => prev.map(q => 
        q.patientId === patient.patientId 
          ? { ...q, status: 'failed' as const, error: errorMessage } 
          : q
      ));

      await supabase
        .from('lg_patients')
        .update({ job_status: 'failed' })
        .eq('id', patient.patientId);

      toast.error(`Upload failed: ${errorMessage}`);
    } finally {
      processingCountRef.current--;
    }
  }, []);

  const processQueue = useCallback(async () => {
    // Find all queued items and process up to MAX_CONCURRENT
    const queuedItems = queue.filter(q => q.status === 'queued');
    const slotsAvailable = MAX_CONCURRENT - processingCountRef.current;
    
    if (slotsAvailable <= 0 || queuedItems.length === 0) return;

    // Take as many items as we have slots for
    const itemsToProcess = queuedItems.slice(0, slotsAvailable);
    
    for (const item of itemsToProcess) {
      processingCountRef.current++;
      // Process each in parallel (don't await)
      processOnePatient(item);
    }
  }, [queue, processOnePatient]);

  // Process queue when items are added
  useEffect(() => {
    const queuedCount = queue.filter(q => q.status === 'queued').length;
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
    <LGUploadQueueContext.Provider value={{ queue, queuePatient, activeUploads, isProcessing }}>
      {children}
    </LGUploadQueueContext.Provider>
  );
};
