import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateULID } from '@/utils/ulid';
import { toast } from 'sonner';

// Helper function to convert data URL to Blob (more reliable than fetch)
function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export interface LGPatient {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  practice_ods: string;
  uploader_name: string;
  patient_name: string | null;
  nhs_number: string | null;
  dob: string | null;
  sex: string;
  images_count: number;
  job_status: 'draft' | 'uploading' | 'queued' | 'processing' | 'succeeded' | 'failed';
  upload_progress: number | null;
  pdf_url: string | null;
  summary_json_url: string | null;
  snomed_json_url: string | null;
  snomed_csv_url: string | null;
  error_message: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  // AI extraction fields
  ai_extracted_name: string | null;
  ai_extracted_nhs: string | null;
  ai_extracted_dob: string | null;
  ai_extracted_sex: string | null;
  ai_extraction_confidence: number | null;
  requires_verification: boolean;
  // Email tracking fields
  email_sent_at: string | null;
  email_error: string | null;
  // Processing timing fields
  upload_started_at: string | null;
  upload_completed_at: string | null;
  ocr_started_at: string | null;
  ocr_completed_at: string | null;
  pdf_started_at: string | null;
  pdf_completed_at: string | null;
}

export interface CapturedImage {
  id: string;
  dataUrl: string;
  timestamp: number;
  hash?: string;
}

// Simplified input - only requires practice and uploader
export interface CreatePatientInput {
  practice_ods: string;
  uploader_name: string;
}

export function useLGCapture() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPatient = useCallback(async (input: CreatePatientInput): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const patientId = generateULID();
      
      const { error: insertError } = await supabase
        .from('lg_patients')
        .insert({
          id: patientId,
          user_id: user.id,
          practice_ods: input.practice_ods,
          uploader_name: input.uploader_name,
          // Leave patient details null - AI will extract them
          patient_name: null,
          nhs_number: null,
          dob: null,
          sex: 'unknown',
        });

      if (insertError) throw insertError;

      // Log audit event
      await logAuditEvent(patientId, 'capture_started', user.email || 'unknown', user.id, {
        practice_ods: input.practice_ods,
      });

      return patientId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create session';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPatient = useCallback(async (patientId: string): Promise<LGPatient | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('lg_patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (fetchError) throw fetchError;
      return data as LGPatient;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch patient';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadImages = useCallback(async (
    patientId: string,
    practiceOds: string,
    images: CapturedImage[]
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log('Starting upload for patient:', patientId, 'images:', images.length);

      // Record upload start time and update status
      const uploadStartTime = new Date().toISOString();
      const { error: statusError } = await supabase
        .from('lg_patients')
        .update({ 
          job_status: 'uploading',
          upload_started_at: uploadStartTime,
        })
        .eq('id', patientId);
      
      if (statusError) {
        console.error('Failed to update status:', statusError);
      }

      // Upload each image
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const seq = String(i + 1).padStart(3, '0');
        const path = `${practiceOds}/${patientId}/raw/${seq}.jpg`;
        
        console.log(`Uploading image ${i + 1}/${images.length} to path:`, path);
        console.log(`DataUrl length: ${image.dataUrl?.length || 0}, starts with: ${image.dataUrl?.substring(0, 50)}`);
        
        // Validate data URL
        if (!image.dataUrl || !image.dataUrl.startsWith('data:')) {
          throw new Error(`Invalid image data for page ${i + 1}`);
        }
        
        // Convert data URL to blob (more reliable method)
        let blob: Blob;
        try {
          blob = dataUrlToBlob(image.dataUrl);
        } catch (convErr) {
          console.error(`Failed to convert image ${i + 1}:`, convErr);
          throw new Error(`Failed to process image ${i + 1}: ${convErr instanceof Error ? convErr.message : 'Unknown error'}`);
        }
        
        console.log(`Blob size: ${blob.size}, type: ${blob.type}`);
        
        if (blob.size === 0) {
          throw new Error(`Image ${i + 1} is empty - camera may not be working`);
        }
        
        const { error: uploadError } = await supabase.storage
          .from('lg')
          .upload(path, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for image ${i + 1}:`, uploadError);
          toast.error(`Upload failed: ${uploadError.message}`);
          throw uploadError;
        }

        console.log(`Image ${i + 1} uploaded successfully`);

        // Log each page capture
        await logAuditEvent(patientId, 'page_uploaded', user.email || 'unknown', user.id, {
          page_number: i + 1,
          total_pages: images.length,
        });
      }

      // Update images count and record upload completion time
      await supabase
        .from('lg_patients')
        .update({ 
          images_count: images.length,
          job_status: 'queued',
          upload_completed_at: new Date().toISOString(),
        })
        .eq('id', patientId);

      await logAuditEvent(patientId, 'upload_completed', user.email || 'unknown', user.id, {
        images_count: images.length,
      });

      console.log('All images uploaded successfully');
      return true;
    } catch (err) {
      console.error('Upload error:', err);
      const message = err instanceof Error ? err.message : 'Failed to upload images';
      setError(message);
      toast.error(`Upload failed: ${message}`);
      
      // Update status to failed
      await supabase
        .from('lg_patients')
        .update({ 
          job_status: 'failed',
          error_message: message,
        })
        .eq('id', patientId);

      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const triggerProcessing = useCallback(async (patientId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log('Triggering processing for patient:', patientId);
      
      // Retry logic for network failures (common on iOS)
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Processing attempt ${attempt}/3...`);
          const { error: invokeError } = await supabase.functions.invoke('lg-process-patient', {
            body: { patientId },
          });

          if (invokeError) {
            console.error(`Invoke error on attempt ${attempt}:`, invokeError);
            throw invokeError;
          }

          console.log('Processing triggered successfully');
          await logAuditEvent(patientId, 'processing_started', user.email || 'unknown', user.id, {});
          return true;
        } catch (attemptErr) {
          lastError = attemptErr instanceof Error ? attemptErr : new Error('Unknown error');
          console.error(`Attempt ${attempt} failed:`, lastError.message);
          
          if (attempt < 3) {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      throw lastError || new Error('Processing failed after 3 attempts');
    } catch (err) {
      console.error('triggerProcessing error:', err);
      const message = err instanceof Error ? err.message : 'Failed to start processing';
      setError(message);
      toast.error(`Processing failed: ${message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const listPatients = useCallback(async (searchTerm?: string): Promise<LGPatient[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('lg_patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`patient_name.ilike.%${searchTerm}%,nhs_number.ilike.%${searchTerm}%,ai_extracted_name.ilike.%${searchTerm}%,ai_extracted_nhs.ilike.%${searchTerm}%`);
      }

      const { data, error: fetchError } = await query.limit(50);

      if (fetchError) throw fetchError;
      return (data || []) as LGPatient[];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch patients';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deletePatient = useCallback(async (patientId: string, practiceOds: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Delete storage files first
      const storagePath = `${practiceOds}/${patientId}`;
      
      // List and delete all files in the patient folder
      const { data: files } = await supabase.storage
        .from('lg')
        .list(storagePath, { limit: 1000 });
      
      if (files && files.length > 0) {
        // Delete files in subdirectories (raw, final, work)
        for (const folder of ['raw', 'final', 'work']) {
          const { data: subFiles } = await supabase.storage
            .from('lg')
            .list(`${storagePath}/${folder}`, { limit: 1000 });
          
          if (subFiles && subFiles.length > 0) {
            const filePaths = subFiles.map(f => `${storagePath}/${folder}/${f.name}`);
            await supabase.storage.from('lg').remove(filePaths);
          }
        }
      }

      // Log deletion before removing record
      await logAuditEvent(patientId, 'patient_deleted', user.email || 'unknown', user.id, {});

      // Delete audit logs
      await supabase
        .from('lg_audit_logs')
        .delete()
        .eq('patient_id', patientId);

      // Delete patient record
      const { error: deleteError } = await supabase
        .from('lg_patients')
        .delete()
        .eq('id', patientId);

      if (deleteError) throw deleteError;

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete record';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Retry just the summary phase (for stuck jobs where OCR completed)
  const retrySummary = useCallback(async (patientId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log('Retrying summary processing for patient:', patientId);
      
      const { error: invokeError } = await supabase.functions.invoke('lg-process-summary', {
        body: { patientId },
      });

      if (invokeError) {
        console.error('Failed to invoke lg-process-summary:', invokeError);
        throw invokeError;
      }

      console.log('Summary processing triggered successfully');
      await logAuditEvent(patientId, 'summary_retry', user.email || 'unknown', user.id, {});
      return true;
    } catch (err) {
      console.error('retrySummary error:', err);
      const message = err instanceof Error ? err.message : 'Failed to retry summary';
      setError(message);
      toast.error(`Retry failed: ${message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    createPatient,
    getPatient,
    uploadImages,
    triggerProcessing,
    retrySummary,
    listPatients,
    deletePatient,
  };
}

async function logAuditEvent(
  patientId: string,
  event: string,
  actor: string,
  actorUserId: string,
  meta: Record<string, unknown>
) {
  const auditId = generateULID();
  
  await supabase.from('lg_audit_logs').insert({
    id: auditId,
    patient_id: patientId,
    event,
    actor,
    actor_user_id: actorUserId,
    meta: {
      ...meta,
      user_agent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    },
  });
}
