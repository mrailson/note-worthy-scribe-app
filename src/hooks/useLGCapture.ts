import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateULID } from '@/utils/ulid';
// Toast messages removed from LG Capture service
import { compressLgImageFromDataUrl } from '@/utils/lgImageCompressor';
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

export interface PreviousName {
  name: string;
  type: 'maiden' | 'married' | 'previous';
  evidence?: string;
}

export interface IdentityIssue {
  type: 'nhs_mismatch' | 'dob_mismatch' | 'name_mismatch' | 'third_party_document';
  description: string;
  page_reference?: string;
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
  // PDF generation status
  pdf_generation_status: 'pending' | 'queued' | 'processing' | 'generating' | 'complete' | 'completed' | 'failed' | null;
  // Compression tracking fields
  pdf_final_size_mb: number | null;
  compression_tier: 'Tier 1' | 'Tier 2' | null;
  pdf_split: boolean;
  pdf_parts: number;
  compression_attempts: number;
  original_size_mb: number | null;
  // Split PDF URLs
  pdf_part_urls: string[] | null;
  // Previous names and identity verification (new) - use unknown for JSONB compatibility
  previous_names: unknown;
  identity_verification_status: string | null;
  identity_verification_issues: unknown;
  nhs_number_validated: boolean | null;
  // Conflict pages for mixed patient detection
  conflict_pages: unknown;
  // OCR analysis tracking for large documents
  ocr_total_chars: number | null;
  ocr_analysed_chars: number | null;
  ocr_analysed_percentage: number | null;
  // Source filename tracking
  source_filename: string | null;
}

// Helper functions to safely extract typed data from JSONB fields
export function getPreviousNames(patient: LGPatient): PreviousName[] {
  if (!patient.previous_names || !Array.isArray(patient.previous_names)) return [];
  return patient.previous_names as PreviousName[];
}

export function getIdentityIssues(patient: LGPatient): IdentityIssue[] {
  if (!patient.identity_verification_issues || !Array.isArray(patient.identity_verification_issues)) return [];
  return patient.identity_verification_issues as IdentityIssue[];
}

export interface CapturedImage {
  id: string;
  dataUrl: string;
  timestamp: number;
  hash?: string;
  /**
   * Optional original image blob (used for preserve-quality PDF extraction to avoid huge base64 strings).
   */
  blob?: Blob;
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

      // Upload each image with CLIENT-SIDE COMPRESSION
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const seq = String(i + 1).padStart(3, '0');
        const path = `${practiceOds}/${patientId}/raw/${seq}.jpg`;
        
        console.log(`Compressing and uploading image ${i + 1}/${images.length}`);
        
        // Validate data URL
        if (!image.dataUrl || !image.dataUrl.startsWith('data:')) {
          throw new Error(`Invalid image data for page ${i + 1}`);
        }
        
        // COMPRESS IMAGE CLIENT-SIDE before upload
        // Target: 600px wide, grayscale, 40% JPEG quality
        let blob: Blob;
        try {
          blob = await compressLgImageFromDataUrl(image.dataUrl);
          console.log(`Page ${i + 1}: Compressed to ${(blob.size / 1024).toFixed(1)} KB`);
        } catch (compressErr) {
          console.error(`Failed to compress image ${i + 1}:`, compressErr);
          // Fallback to original conversion
          try {
            blob = dataUrlToBlob(image.dataUrl);
            console.log(`Page ${i + 1}: Using original (${(blob.size / 1024).toFixed(1)} KB)`);
          } catch (convErr) {
            console.error(`Failed to convert image ${i + 1}:`, convErr);
            throw new Error(`Failed to process image ${i + 1}: ${convErr instanceof Error ? convErr.message : 'Unknown error'}`);
          }
        }
        
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
          throw uploadError;
        }

        console.log(`Image ${i + 1} uploaded successfully`);

        // Log each page capture
        await logAuditEvent(patientId, 'page_uploaded', user.email || 'unknown', user.id, {
          page_number: i + 1,
          total_pages: images.length,
          compressed_size_kb: Math.round(blob.size / 1024),
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
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restartOCR = useCallback(async (patientId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      console.log('Restarting OCR processing for patient:', patientId);

      // Clear existing OCR batches from database
      const { error: deleteError } = await supabase
        .from('lg_ocr_batches')
        .delete()
        .eq('patient_id', patientId);
      
      if (deleteError) {
        console.error('Failed to clear OCR batches:', deleteError);
        // Continue anyway - not critical
      } else {
        console.log('Cleared existing OCR batches from database');
      }

      // Reset patient status to restart OCR from batch 0
      const { error: updateError } = await supabase
        .from('lg_patients')
        .update({
          processing_phase: 'ocr',
          ocr_batches_completed: 0,
          ocr_text_url: null,
          ocr_started_at: null,
          ocr_completed_at: null,
          error_message: null,
        })
        .eq('id', patientId);

      if (updateError) {
        throw updateError;
      }

      // Trigger OCR batch 0
      const { error: invokeError } = await supabase.functions.invoke('lg-ocr-batch', {
        body: { patientId, batchNumber: 0 },
      });

      if (invokeError) {
        console.error('Failed to invoke lg-ocr-batch:', invokeError);
        throw invokeError;
      }

      console.log('OCR restart triggered successfully');
      await logAuditEvent(patientId, 'ocr_restart', user.email || 'unknown', user.id, {});
      return true;
    } catch (err) {
      console.error('restartOCR error:', err);
      const message = err instanceof Error ? err.message : 'Failed to restart OCR';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Retry PDF generation for stuck queued PDFs
  const retryPdfGeneration = useCallback(async (patientId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update pdf_generation_status to processing
      const { error: updateError } = await supabase
        .from('lg_patients')
        .update({ 
          pdf_generation_status: 'processing',
          pdf_started_at: new Date().toISOString()
        })
        .eq('id', patientId);

      if (updateError) throw updateError;

      // Invoke the PDF generation function
      const { error: invokeError } = await supabase.functions.invoke('lg-generate-pdf', {
        body: { patientId, sendEmail: true },
      });

      if (invokeError) {
        console.error('Failed to invoke lg-generate-pdf:', invokeError);
        throw invokeError;
      }

      console.log('PDF generation triggered successfully');
      await logAuditEvent(patientId, 'pdf_retry', user.email || 'unknown', user.id, {});
      return true;
    } catch (err) {
      console.error('retryPdfGeneration error:', err);
      const message = err instanceof Error ? err.message : 'Failed to retry PDF generation';
      setError(message);
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
    restartOCR,
    retryPdfGeneration,
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
