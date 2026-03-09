import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { hashFile } from '@/utils/fileHash';

export interface ApprovalDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string;
  file_hash: string;
  original_filename: string;
  file_size_bytes: number | null;
  deadline: string | null;
  status: string;
  message: string | null;
  created_at: string;
  completed_at: string | null;
  revoked_at: string | null;
  sender_name: string | null;
  sender_email: string | null;
}

export interface ApprovalSignatory {
  id: string;
  document_id: string;
  name: string;
  email: string;
  role: string | null;
  organisation: string | null;
  approval_token: string;
  status: string;
  signed_at: string | null;
  signed_name: string | null;
  signed_role: string | null;
  signed_organisation: string | null;
  decline_comment: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  viewed_at: string | null;
  created_at: string;
  sort_order: number;
}

export interface ApprovalContact {
  id: string;
  name: string;
  email: string;
  role: string | null;
  organisation: string | null;
  is_favourite: boolean;
}

export function useDocumentApproval() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ApprovalDocument[]>([]);
  const [contacts, setContacts] = useState<ApprovalContact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('approval_documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setDocuments((data as ApprovalDocument[]) || []);
    } catch (err) {
      console.error('Error fetching approval documents:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('approval_contacts')
      .select('*')
      .order('is_favourite', { ascending: false })
      .order('name');
    setContacts((data as ApprovalContact[]) || []);
  }, [user]);

  useEffect(() => {
    fetchDocuments();
    fetchContacts();
  }, [fetchDocuments, fetchContacts]);

  const uploadDocument = useCallback(async (
    file: File,
    metadata: {
      title: string;
      description?: string;
      category: string;
      deadline?: string;
      message?: string;
    }
  ) => {
    if (!user) throw new Error('Not authenticated');

    const fileHash = await hashFile(file);
    const ext = file.name.split('.').pop();
    const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('approval-documents')
      .upload(storagePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('approval-documents')
      .getPublicUrl(storagePath);

    const { data, error } = await supabase
      .from('approval_documents')
      .insert({
        sender_id: user.id,
        sender_name: user.user_metadata?.full_name || user.email,
        sender_email: user.email,
        title: metadata.title,
        description: metadata.description || null,
        category: metadata.category,
        file_url: publicUrl,
        file_hash: fileHash,
        original_filename: file.name,
        file_size_bytes: file.size,
        deadline: metadata.deadline || null,
        status: 'draft',
        message: metadata.message || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabase.from('approval_audit_log').insert({
      document_id: data.id,
      action: 'created',
      actor_name: user.user_metadata?.full_name || user.email,
      actor_email: user.email,
    });

    await fetchDocuments();
    return data as ApprovalDocument;
  }, [user, fetchDocuments]);

  const addSignatories = useCallback(async (
    documentId: string,
    signatories: { name: string; email: string; role?: string; organisation?: string }[]
  ) => {
    const rows = signatories.map((s, i) => ({
      document_id: documentId,
      name: s.name,
      email: s.email,
      role: s.role || null,
      organisation: s.organisation || null,
      sort_order: i,
    }));

    const { data, error } = await supabase
      .from('approval_signatories')
      .insert(rows)
      .select();

    if (error) throw error;
    return data as ApprovalSignatory[];
  }, []);

  const sendForApproval = useCallback(async (documentId: string) => {
    const { error } = await supabase
      .from('approval_documents')
      .update({ status: 'pending' })
      .eq('id', documentId);

    if (error) throw error;

    await supabase.from('approval_audit_log').insert({
      document_id: documentId,
      action: 'sent',
      actor_name: user?.user_metadata?.full_name || user?.email,
      actor_email: user?.email,
    });

    await fetchDocuments();
    toast.success('Document sent for approval');
  }, [user, fetchDocuments]);

  const revokeDocument = useCallback(async (documentId: string) => {
    const { error } = await supabase
      .from('approval_documents')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', documentId);

    if (error) throw error;

    await supabase.from('approval_audit_log').insert({
      document_id: documentId,
      action: 'revoked',
      actor_name: user?.user_metadata?.full_name || user?.email,
      actor_email: user?.email,
    });

    await fetchDocuments();
    toast.success('Document approval revoked');
  }, [user, fetchDocuments]);

  const fetchSignatories = useCallback(async (documentId: string) => {
    const { data, error } = await supabase
      .from('approval_signatories')
      .select('*')
      .eq('document_id', documentId)
      .order('sort_order');

    if (error) throw error;
    return (data as ApprovalSignatory[]) || [];
  }, []);

  const fetchAuditLog = useCallback(async (documentId: string) => {
    const { data, error } = await supabase
      .from('approval_audit_log')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }, []);

  const saveContact = useCallback(async (contact: { name: string; email: string; role?: string; organisation?: string }) => {
    if (!user) return;
    await supabase.from('approval_contacts').upsert({
      user_id: user.id,
      name: contact.name,
      email: contact.email,
      role: contact.role || null,
      organisation: contact.organisation || null,
    }, { onConflict: 'user_id,email' });
    await fetchContacts();
  }, [user, fetchContacts]);

  return {
    documents,
    contacts,
    loading,
    uploadDocument,
    addSignatories,
    sendForApproval,
    revokeDocument,
    fetchSignatories,
    fetchAuditLog,
    saveContact,
    refetch: fetchDocuments,
  };
}
