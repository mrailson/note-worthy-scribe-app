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
  batch_id: string | null;
  multi_doc_group_id: string | null;
  signed_file_url: string | null;
  signature_placement: any;
}

export interface ApprovalSignatory {
  id: string;
  document_id: string;
  name: string;
  email: string;
  role: string | null;
  organisation: string | null;
  signatory_title: string | null;
  organisation_type: string | null;
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
  title: string | null;
  organisation_type: string | null;
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
      signaturePlacement?: Record<string, any>;
      auto_send_on_completion?: boolean;
    },
    onStatusChange?: (status: string) => void,
  ) => {
    if (!user) throw new Error('Not authenticated');

    let uploadFile: File | Blob = file;
    let uploadExt = file.name.split('.').pop()?.toLowerCase() || '';
    const isDocx = uploadExt === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    // ── Convert .docx → PDF before upload ──
    if (isDocx) {
      onStatusChange?.('Converting Word document to PDF…');
      try {
        const mammoth = (await import('mammoth')).default;
        const html2pdf = (await import('html2pdf.js')).default;

        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!result.value || result.value.trim().length === 0) {
          throw new Error('Mammoth returned empty HTML');
        }

        console.log('📄 DOCX HTML content length:', result.value.length);

        // Create a hidden container positioned in viewport for html2canvas capture
        const container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:0;top:0;width:210mm;background:white;z-index:-9999;opacity:0;pointer-events:none;padding:20mm;font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.4;color:#000;';
        
        // Add basic styling for tables and document elements
        container.innerHTML = `
          <style>
            .docx-container * { box-sizing: border-box; }
            .docx-container table { border-collapse: collapse; width: 100%; margin: 8px 0; }
            .docx-container th, .docx-container td { border: 1px solid #999; padding: 6px 8px; text-align: left; font-size: 10pt; }
            .docx-container th { background: #f0f0f0; font-weight: bold; }
            .docx-container h1 { font-size: 18pt; font-weight: bold; margin: 12px 0 6px; }
            .docx-container h2 { font-size: 16pt; font-weight: bold; margin: 10px 0 5px; }
            .docx-container h3 { font-size: 14pt; font-weight: bold; margin: 8px 0 4px; }
            .docx-container h4 { font-size: 12pt; font-weight: bold; margin: 6px 0 3px; }
            .docx-container p { margin: 4px 0; }
            .docx-container ul, .docx-container ol { margin: 4px 0; padding-left: 20px; }
            .docx-container li { margin: 2px 0; }
            .docx-container img { max-width: 100%; height: auto; }
            .docx-container strong, .docx-container b { font-weight: bold; }
            .docx-container em, .docx-container i { font-style: italic; }
          </style>
          <div class="docx-container">${result.value}</div>
        `;
        document.body.appendChild(container);

        // Allow a moment for styles and layout to settle
        await new Promise(r => setTimeout(r, 200));

        const pdfBlob: Blob = await (html2pdf()
          .set({
            margin: [15, 15, 15, 15],
            filename: 'document.pdf',
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { 
              scale: 2, 
              useCORS: true, 
              letterRendering: true,
              scrollY: 0,
              scrollX: 0,
              windowWidth: container.scrollWidth,
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          }) as any)
          .from(container.querySelector('.docx-container'))
          .outputPdf('blob');

        document.body.removeChild(container);

        uploadFile = pdfBlob;
        uploadExt = 'pdf';
        console.log('✅ DOCX→PDF conversion successful, PDF size:', (pdfBlob.size / 1024 / 1024).toFixed(2), 'MB');
      } catch (conversionError) {
        console.error('DOCX→PDF conversion failed:', conversionError);
        throw new Error(
          "This Word document couldn't be converted to PDF automatically. " +
          "Please save it as PDF from Word or Google Docs and re-upload."
        );
      }
    }

    onStatusChange?.('Calculating document hash…');
    // Hash the actual file being uploaded (converted PDF for docx, original for others)
    const hashBuffer = uploadFile instanceof File
      ? await uploadFile.arrayBuffer()
      : await uploadFile.arrayBuffer();
    const hashArray = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', hashBuffer)));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    onStatusChange?.('Uploading document…');
    const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${uploadExt}`;

    const { error: uploadError } = await supabase.storage
      .from('approval-documents')
      .upload(storagePath, uploadFile, {
        contentType: isDocx ? 'application/pdf' : file.type,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('approval-documents')
      .getPublicUrl(storagePath);

    const insertData: Record<string, any> = {
      sender_id: user.id,
      sender_name: user.user_metadata?.full_name || user.email,
      sender_email: user.email,
      title: metadata.title,
      description: metadata.description || null,
      category: metadata.category,
      file_url: publicUrl,
      file_hash: fileHash,
      original_filename: file.name,
      file_size_bytes: uploadFile instanceof File ? uploadFile.size : (uploadFile as Blob).size,
      deadline: metadata.deadline || null,
      status: 'draft',
      message: metadata.message || null,
      auto_send_on_completion: metadata.auto_send_on_completion !== undefined ? metadata.auto_send_on_completion : true,
    };

    if (metadata.signaturePlacement) {
      insertData.signature_placement = metadata.signaturePlacement;
    }

    const { data, error } = await supabase
      .from('approval_documents')
      .insert(insertData as any)
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

  const updateSignaturePlacement = useCallback(async (documentId: string, placement: Record<string, any>) => {
    const { error } = await supabase
      .from('approval_documents')
      .update({ signature_placement: placement } as any)
      .eq('id', documentId);
    if (error) throw error;
  }, []);

  const addSignatories = useCallback(async (
    documentId: string,
    signatories: { name: string; email: string; role?: string; organisation?: string; signatory_title?: string; organisation_type?: string }[]
  ) => {
    const rows = signatories.map((s, i) => ({
      document_id: documentId,
      name: s.name,
      email: s.email,
      role: s.role || null,
      organisation: s.organisation || null,
      signatory_title: s.signatory_title || null,
      organisation_type: s.organisation_type || null,
      sort_order: i,
    }));

    const { data, error } = await supabase
      .from('approval_signatories')
      .insert(rows)
      .select();

    if (error) throw error;
    return data as ApprovalSignatory[];
  }, []);

  const sendForApproval = useCallback(async (documentId: string, customEmailBody?: string) => {
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

    // Send initial request emails to all signatories
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const body: Record<string, unknown> = {
        type: 'request',
        document_id: documentId,
      };
      if (customEmailBody) {
        body.custom_body = customEmailBody;
      }

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-approval-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify(body),
        }
      );

      const result = await res.json();
      if (!res.ok) {
        console.error('Failed to send approval request emails:', result);
      }
    } catch (emailError) {
      console.error('Error sending approval request emails:', emailError);
    }

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

  const chaseSignatory = useCallback(async (documentId: string, signatoryId: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/send-approval-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          type: 'reminder',
          document_id: documentId,
          signatory_id: signatoryId,
        }),
      }
    );

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to send reminder');

    await fetchDocuments();
    return result;
  }, [fetchDocuments]);

  const chaseAllPending = useCallback(async (documentId: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/send-approval-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          type: 'reminder',
          document_id: documentId,
        }),
      }
    );

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to send reminders');

    await fetchDocuments();
    return result;
  }, [fetchDocuments]);

  const chaseAllOverdue = useCallback(async (overdueDocumentIds: string[]) => {
    const results = [];
    for (const docId of overdueDocumentIds) {
      try {
        const result = await chaseAllPending(docId);
        results.push({ docId, ...result });
      } catch (err) {
        console.error(`Failed to chase doc ${docId}:`, err);
        results.push({ docId, success: false });
      }
    }
    return results;
  }, [chaseAllPending]);

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

  const saveContact = useCallback(async (contact: { name: string; email: string; role?: string; organisation?: string; title?: string; organisation_type?: string }) => {
    if (!user) return;
    await supabase.from('approval_contacts').upsert({
      user_id: user.id,
      name: contact.name,
      email: contact.email,
      role: contact.role || null,
      organisation: contact.organisation || null,
      title: contact.title || null,
      organisation_type: contact.organisation_type || null,
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

  const deleteContact = useCallback(async (contactId: string) => {
    await supabase.from('approval_contact_group_members').delete().eq('contact_id', contactId);
    await supabase.from('approval_contacts').delete().eq('id', contactId);
    await fetchContacts();
    toast.success('Contact deleted');
  }, [fetchContacts]);

  const updateContact = useCallback(async (contactId: string, updates: { name: string; email: string; role?: string; organisation?: string; title?: string; organisation_type?: string }) => {
    await supabase.from('approval_contacts').update({
      name: updates.name,
      email: updates.email,
      role: updates.role || null,
      organisation: updates.organisation || null,
      title: updates.title || null,
      organisation_type: updates.organisation_type || null,
    }).eq('id', contactId);
    await fetchContacts();
    toast.success('Contact updated');
  }, [fetchContacts]);

  const toggleContactFavourite = useCallback(async (contact: ApprovalContact) => {
    await supabase.from('approval_contacts').update({ is_favourite: !contact.is_favourite }).eq('id', contact.id);
    await fetchContacts();
  }, [fetchContacts]);

  const deleteContactGroup = useCallback(async (groupId: string) => {
    await supabase.from('approval_contact_groups').delete().eq('id', groupId);
    await fetchContactGroups();
  }, [fetchContactGroups]);

  const cloneDocumentForBatch = useCallback(async (
    sourceDocId: string,
    practiceTitle: string,
    batchId: string,
  ) => {
    if (!user) throw new Error('Not authenticated');

    // Fetch the source document
    const { data: source, error: srcErr } = await supabase
      .from('approval_documents')
      .select('*')
      .eq('id', sourceDocId)
      .single();

    if (srcErr || !source) throw srcErr || new Error('Source document not found');

    const insertData: Record<string, any> = {
      sender_id: user.id,
      sender_name: source.sender_name,
      sender_email: source.sender_email,
      title: `${source.title} — ${practiceTitle}`,
      description: source.description,
      category: source.category,
      file_url: source.file_url,
      file_hash: source.file_hash,
      original_filename: source.original_filename,
      file_size_bytes: source.file_size_bytes,
      deadline: source.deadline,
      status: 'draft',
      message: source.message,
      signature_placement: source.signature_placement,
      batch_id: batchId,
    };

    const { data, error } = await supabase
      .from('approval_documents')
      .insert(insertData as any)
      .select()
      .single();

    if (error) throw error;

    await supabase.from('approval_audit_log').insert({
      document_id: data.id,
      action: 'created',
      actor_name: user.user_metadata?.full_name || user.email,
      actor_email: user.email,
      metadata: { batch_id: batchId, source_document_id: sourceDocId } as any,
    });

    return data as ApprovalDocument;
  }, [user]);

  const sendBatchForApproval = useCallback(async (
    sourceDocId: string,
    practiceSignatories: { practiceName: string; signatories: { name: string; email: string; role?: string; organisation?: string; signatory_title?: string; organisation_type?: string }[] }[],
    customEmailBody?: string,
  ) => {
    const batchId = crypto.randomUUID();

    // Also tag the source document with the batch_id
    await supabase
      .from('approval_documents')
      .update({ batch_id: batchId } as any)
      .eq('id', sourceDocId);

    const results: { practiceName: string; documentId: string; success: boolean; error?: string }[] = [];

    for (const ps of practiceSignatories) {
      try {
        // Clone the document for this practice
        const cloned = await cloneDocumentForBatch(sourceDocId, ps.practiceName, batchId);

        // Add signatories
        await addSignatories(cloned.id, ps.signatories);

        // Send for approval
        await sendForApproval(cloned.id, customEmailBody);

        results.push({ practiceName: ps.practiceName, documentId: cloned.id, success: true });
      } catch (err) {
        console.error(`Batch send failed for ${ps.practiceName}:`, err);
        results.push({ practiceName: ps.practiceName, documentId: '', success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    await fetchDocuments();
    return { batchId, results };
  }, [cloneDocumentForBatch, addSignatories, sendForApproval, fetchDocuments]);

  const deleteDocument = useCallback(async (documentId: string) => {
    if (!user) throw new Error('Not authenticated');

    const doc = documents.find(d => d.id === documentId);

    // Optimistically remove from UI immediately
    setDocuments(prev => prev.filter(d => d.id !== documentId));

    // If pending, revoke first so signatories can't approve a deleted doc
    if (doc?.status === 'pending') {
      await supabase
        .from('approval_documents')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('id', documentId);
    }

    // Delete related records in order (signatories, audit log, then document)
    await supabase.from('approval_signatories').delete().eq('document_id', documentId);
    await supabase.from('approval_audit_log').delete().eq('document_id', documentId);

    // Delete the file from storage if present
    if (doc?.file_url) {
      const path = doc.file_url.split('/approval-documents/')[1];
      if (path) {
        await supabase.storage.from('approval-documents').remove([path]);
      }
    }

    const { error } = await supabase
      .from('approval_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;

    await fetchDocuments();
    toast.success('Document deleted');
  }, [user, documents, fetchDocuments]);

  const sendMultiDocForApproval = useCallback(async (docIds: string[], customEmailBody?: string) => {
    const groupId = crypto.randomUUID();

    // Tag all docs with the group ID and set to pending
    for (const id of docIds) {
      await supabase
        .from('approval_documents')
        .update({ multi_doc_group_id: groupId, status: 'pending' } as any)
        .eq('id', id);

      await supabase.from('approval_audit_log').insert({
        document_id: id,
        action: 'sent',
        actor_name: user?.user_metadata?.full_name || user?.email,
        actor_email: user?.email,
        metadata: { multi_doc_group_id: groupId } as any,
      });
    }

    // Collect all signatories across all docs and group by email
    const { data: allSigs } = await supabase
      .from('approval_signatories')
      .select('*')
      .in('document_id', docIds);

    // For each unique signatory email, generate ONE group_token
    const emailToGroupToken = new Map<string, string>();
    for (const sig of (allSigs || [])) {
      if (!emailToGroupToken.has(sig.email)) {
        emailToGroupToken.set(sig.email, crypto.randomUUID());
      }
    }

    // Update all signatory rows with their group_token
    for (const sig of (allSigs || [])) {
      const gt = emailToGroupToken.get(sig.email);
      if (gt) {
        await supabase
          .from('approval_signatories')
          .update({ group_token: gt } as any)
          .eq('id', sig.id);
      }
    }

    // Send ONE consolidated email per signatory via the new multi_request type
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const body: Record<string, unknown> = {
        type: 'multi_request',
        group_id: groupId,
      };
      if (customEmailBody) {
        body.custom_body = customEmailBody;
      }

      await fetch(
        `https://${projectId}.supabase.co/functions/v1/send-approval-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify(body),
        }
      );
    } catch (emailError) {
      console.error('Error sending multi-doc approval emails:', emailError);
    }

    await fetchDocuments();
    toast.success('All documents sent for approval');
    return groupId;
  }, [user, fetchDocuments]);

  return {
    documents,
    contacts,
    contactGroups,
    loading,
    uploadDocument,
    updateSignaturePlacement,
    addSignatories,
    sendForApproval,
    sendMultiDocForApproval,
    revokeDocument,
    deleteDocument,
    chaseSignatory,
    chaseAllPending,
    chaseAllOverdue,
    fetchSignatories,
    fetchAuditLog,
    saveContact,
    deleteContact,
    updateContact,
    toggleContactFavourite,
    saveContactGroup,
    deleteContactGroup,
    cloneDocumentForBatch,
    sendBatchForApproval,
    refetch: fetchDocuments,
    refetchContacts: fetchContacts,
  };
}
