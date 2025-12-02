import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CapturedImage } from '@/hooks/useLGCapture';

interface QueuedPatient {
  patientId: string;
  practiceOds: string;
  images: CapturedImage[];
  status: 'queued' | 'uploading' | 'processing' | 'complete' | 'failed';
  uploadProgress: number;
  error?: string;
}

interface LGUploadQueueContextType {
  queue: QueuedPatient[];
  queuePatient: (patientId: string, practiceOds: string, images: CapturedImage[]) => void;
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
  const processingRef = useRef(false);
  const isProcessing = queue.some(q => q.status === 'uploading' || q.status === 'processing');
  const activeUploads = queue.filter(q => q.status === 'queued' || q.status === 'uploading').length;

  const queuePatient = useCallback((patientId: string, practiceOds: string, images: CapturedImage[]) => {
    setQueue(prev => [...prev, {
      patientId,
      practiceOds,
      images,
      status: 'queued',
      uploadProgress: 0
    }]);
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    
    const nextInQueue = queue.find(q => q.status === 'queued');
    if (!nextInQueue) return;

    processingRef.current = true;

    try {
      // Update status to uploading
      setQueue(prev => prev.map(q => 
        q.patientId === nextInQueue.patientId 
          ? { ...q, status: 'uploading' as const } 
          : q
      ));

      // Update DB status
      await supabase
        .from('lg_patients')
        .update({ job_status: 'uploading', upload_progress: 0 })
        .eq('id', nextInQueue.patientId);

      // Upload images one by one with progress
      const { images, patientId, practiceOds } = nextInQueue;
      
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const base64Data = img.dataUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });

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

      // Update images_count and status to queued (ready for processing)
      await supabase
        .from('lg_patients')
        .update({ 
          images_count: images.length, 
          job_status: 'queued',
          upload_progress: 100
        })
        .eq('id', patientId);

      // Update local status
      setQueue(prev => prev.map(q => 
        q.patientId === patientId 
          ? { ...q, status: 'processing' as const, uploadProgress: 100 } 
          : q
      ));

      // Trigger processing (fire and forget)
      supabase.functions.invoke('lg-process-patient', {
        body: { patientId }
      }).catch(err => {
        console.error('Processing trigger error:', err);
      });

      // Show success toast
      toast.success(`Upload complete for patient, processing started`);

      // Mark as complete after a delay (processing happens in background)
      setTimeout(() => {
        setQueue(prev => prev.filter(q => q.patientId !== patientId));
      }, 3000);

    } catch (err) {
      console.error('Queue processing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      
      setQueue(prev => prev.map(q => 
        q.patientId === nextInQueue.patientId 
          ? { ...q, status: 'failed' as const, error: errorMessage } 
          : q
      ));

      await supabase
        .from('lg_patients')
        .update({ job_status: 'failed' })
        .eq('id', nextInQueue.patientId);

      toast.error(`Upload failed: ${errorMessage}`);
    } finally {
      processingRef.current = false;
    }
  }, [queue]);

  // Process queue when items are added
  useEffect(() => {
    if (queue.some(q => q.status === 'queued') && !processingRef.current) {
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
