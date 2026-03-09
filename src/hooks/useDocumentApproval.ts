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

export interface ApprovalContactGroup {
  id: string;
  name: string;
  description: string | null;
  members: ApprovalContact[];
}

export interface ApprovalDocumentWithSignatories extends ApprovalDocument {
  signatories: ApprovalSignatory[];
}

export function useDocumentApproval() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ApprovalDocumentWithSignatories[]>([]);
  const [contacts, setContacts] = useState<ApprovalContact[]>([]);
  const [contactGroups, setContactGroups] = useState<ApprovalContactGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: docs, error } = await supabase
        .from('approval_documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const docIds = (docs || []).map((d: any) => d.id);
      let allSigs: ApprovalSignatory[] = [];

      if (docIds.length > 0) {
        const { data: sigs, error: sigErr } = await supabase
          .from('approval_signatories')
          .select('*')
          .in('document_id', docIds)
          .order('sort_order');

        if (!sigErr && sigs) {
          allSigs = sigs as ApprovalSignatory[];
        }
      }

      const enriched: ApprovalDocumentWithSignatories[] = (docs || []).map((d: any) => ({
        ...d,
        signatories: allSigs.filter(s => s.document_id === d.id),
      }));

      setDocuments(enriched);
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

  const fetchContactGroups = useCallback(async () => {
    if (!user) return;
    const { data: groups } = await supabase
      .from('approval_contact_groups')
      .select('*')
      .order('name');

    if (!groups || groups.length === 0) {
      setContactGroups([]);
      return;
    }

    const groupIds = groups.map((g: any) => g.id);
    const { data: members } = await supabase
      .from('approval_contact_group_members')
      .select('*, approval_contacts(*)')
      .in('group_id', groupIds);

    const enriched: ApprovalContactGroup[] = groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      members: (members || [])
        .filter((m: any) => m.group_id === g.id)
        .map((m: any) => m.approval_contacts as ApprovalContact)
        .filter(Boolean),
    }));

    setContactGroups(enriched);
  }, [user]);

  useEffect(() => {
    fetchDocuments();
    fetchContacts();
    fetchContactGroups();
  }, [fetchDocuments, fetchContacts, fetchContactGroups]);

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

  const saveContactGroup = useCallback(async (name: string, contactIds: string[]) => {
    if (!user) return;

    const { data: group, error } = await supabase
      .from('approval_contact_groups')
      .upsert({ user_id: user.id, name, updated_at: new Date().toISOString() }, { onConflict: 'user_id,name' })
      .select()
      .single();

    if (error || !group) throw error;

    // Remove existing members
    await supabase.from('approval_contact_group_members').delete().eq('group_id', group.id);

    // Add new members
    if (contactIds.length > 0) {
      await supabase.from('approval_contact_group_members').insert(
        contactIds.map(cid => ({ group_id: group.id, contact_id: cid }))
      );
    }

    await fetchContactGroups();
    toast.success(`Group "${name}" saved`);
  }, [user, fetchContactGroups]);

  const deleteContactGroup = useCallback(async (groupId: string) => {
    await supabase.from('approval_contact_groups').delete().eq('id', groupId);
    await fetchContactGroups();
  }, [fetchContactGroups]);

  return {
    documents,
    contacts,
    contactGroups,
    loading,
    uploadDocument,
    addSignatories,
    sendForApproval,
    revokeDocument,
    fetchSignatories,
    fetchAuditLog,
    saveContact,
    saveContactGroup,
    deleteContactGroup,
    refetch: fetchDocuments,
    refetchContacts: fetchContacts,
  };
}
