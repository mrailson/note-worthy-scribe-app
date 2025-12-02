import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { generateULID } from '@/utils/ulid';
import { toast } from 'sonner';

export interface LGPatient {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  practice_ods: string;
  uploader_name: string;
  patient_name: string;
  nhs_number: string;
  dob: string;
  sex: string;
  images_count: number;
  job_status: 'draft' | 'uploading' | 'queued' | 'processing' | 'succeeded' | 'failed';
  pdf_url: string | null;
  summary_json_url: string | null;
  snomed_json_url: string | null;
  snomed_csv_url: string | null;
  error_message: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
}

export interface CapturedImage {
  id: string;
  dataUrl: string;
  timestamp: number;
  hash?: string;
}

export interface CreatePatientInput {
  practice_ods: string;
  uploader_name: string;
  patient_name: string;
  nhs_number: string;
  dob: string;
  sex: string;
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
          ...input,
        });

      if (insertError) throw insertError;

      // Log audit event
      await logAuditEvent(patientId, 'patient_created', user.email || 'unknown', user.id, {
        practice_ods: input.practice_ods,
        nhs_number: input.nhs_number,
      });

      return patientId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create patient';
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

      // Update status to uploading
      await supabase
        .from('lg_patients')
        .update({ job_status: 'uploading' })
        .eq('id', patientId);

      // Upload each image
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const seq = String(i + 1).padStart(3, '0');
        const path = `${practiceOds}/${patientId}/raw/${seq}.jpg`;
        
        // Convert data URL to blob
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        
        const { error: uploadError } = await supabase.storage
          .from('lg')
          .upload(path, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Log each page capture
        await logAuditEvent(patientId, 'page_uploaded', user.email || 'unknown', user.id, {
          page_number: i + 1,
          total_pages: images.length,
        });
      }

      // Update images count
      await supabase
        .from('lg_patients')
        .update({ 
          images_count: images.length,
          job_status: 'queued',
        })
        .eq('id', patientId);

      await logAuditEvent(patientId, 'upload_completed', user.email || 'unknown', user.id, {
        images_count: images.length,
      });

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload images';
      setError(message);
      toast.error(message);
      
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

      const { error: invokeError } = await supabase.functions.invoke('lg-process-patient', {
        body: { patientId },
      });

      if (invokeError) throw invokeError;

      await logAuditEvent(patientId, 'processing_started', user.email || 'unknown', user.id, {});

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start processing';
      setError(message);
      toast.error(message);
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
        query = query.or(`patient_name.ilike.%${searchTerm}%,nhs_number.ilike.%${searchTerm}%`);
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

  return {
    isLoading,
    error,
    createPatient,
    getPatient,
    uploadImages,
    triggerProcessing,
    listPatients,
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
