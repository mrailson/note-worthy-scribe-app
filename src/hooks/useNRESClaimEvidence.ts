import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ClaimEvidenceFile {
  id: string;
  claim_id: string;
  user_id: string;
  evidence_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  notes: string | null;
  uploaded_at: string;
  staff_index: number | null;
}

export function useNRESClaimEvidence(claimId?: string) {
  const { user } = useAuth();
  const [files, setFiles] = useState<ClaimEvidenceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const hasFetchedRef = useRef(false);

  const fetchEvidence = useCallback(async (force = false) => {
    if (!claimId || !user?.id) return;
    if (!force && hasFetchedRef.current) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('nres_claim_evidence')
        .select('*')
        .eq('claim_id', claimId)
        .order('uploaded_at', { ascending: true });
      if (error) throw error;
      setFiles((data || []) as ClaimEvidenceFile[]);
      hasFetchedRef.current = true;
    } catch (err) {
      console.error('Error fetching claim evidence:', err);
    } finally {
      setLoading(false);
    }
  }, [claimId, user?.id]);

  useEffect(() => {
    hasFetchedRef.current = false;
    if (claimId && user?.id) fetchEvidence();
  }, [claimId, user?.id]);

  const uploadEvidence = useCallback(async (evidenceType: string, file: File, staffIndex?: number, silent?: boolean) => {
    if (!claimId || !user?.id) return null;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const storagePath = `${user.id}/${claimId}/${evidenceType}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('nres-claim-evidence')
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      const insertPayload: any = {
        claim_id: claimId,
        user_id: user.id,
        evidence_type: evidenceType,
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        file_type: file.type,
      };
      if (staffIndex !== undefined) {
        insertPayload.staff_index = staffIndex;
      }

      const { data, error } = await supabase
        .from('nres_claim_evidence')
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;

      const newFile = data as ClaimEvidenceFile;
      setFiles(prev => [...prev, newFile]);
      toast.success(`${file.name} uploaded`);
      return newFile;
    } catch (err) {
      console.error('Error uploading evidence:', err);
      toast.error(`Failed to upload ${file.name}`);
      return null;
    } finally {
      setUploading(false);
    }
  }, [claimId, user?.id]);

  const deleteEvidence = useCallback(async (evidenceId: string) => {
    try {
      const file = files.find(f => f.id === evidenceId);
      if (file) {
        await supabase.storage.from('nres-claim-evidence').remove([file.file_path]);
      }
      const { error } = await supabase
        .from('nres_claim_evidence')
        .delete()
        .eq('id', evidenceId);
      if (error) throw error;
      setFiles(prev => prev.filter(f => f.id !== evidenceId));
      toast.success('Evidence file removed');
    } catch (err) {
      console.error('Error deleting evidence:', err);
      toast.error('Failed to remove evidence file');
    }
  }, [files]);

  const getDownloadUrl = useCallback(async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('nres-claim-evidence')
      .createSignedUrl(filePath, 3600);
    if (error) {
      toast.error('Failed to generate download link');
      return null;
    }
    return data.signedUrl;
  }, []);

  /** Legacy claim-level uploaded types (staff_index IS NULL) */
  const uploadedTypes = files.filter(f => f.staff_index == null).reduce<Record<string, ClaimEvidenceFile>>((acc, f) => {
    acc[f.evidence_type] = f;
    return acc;
  }, {});

  /** Get uploaded types map for a specific staff index */
  const getUploadedTypesForStaff = useCallback((staffIndex: number): Record<string, ClaimEvidenceFile> => {
    return files.filter(f => f.staff_index === staffIndex).reduce<Record<string, ClaimEvidenceFile>>((acc, f) => {
      acc[f.evidence_type] = f;
      return acc;
    }, {});
  }, [files]);

  /** Get all files for a specific staff index */
  const getFilesForStaff = useCallback((staffIndex: number): ClaimEvidenceFile[] => {
    return files.filter(f => f.staff_index === staffIndex);
  }, [files]);

  return {
    files,
    loading,
    uploading,
    uploadedTypes,
    getUploadedTypesForStaff,
    getFilesForStaff,
    uploadEvidence,
    deleteEvidence,
    getDownloadUrl,
    refetch: () => fetchEvidence(true),
  };
}
