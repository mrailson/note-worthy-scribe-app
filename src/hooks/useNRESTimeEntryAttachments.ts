import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TimeEntryAttachment {
  id: string;
  entry_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_at: string;
}

const BUCKET = 'nres-time-tracker-attachments';

export function useNRESTimeEntryAttachments(entryId?: string) {
  const { user } = useAuth();
  const [files, setFiles] = useState<TimeEntryAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchFiles = useCallback(async () => {
    if (!entryId || !user?.id) { setFiles([]); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('nres_time_entry_attachments')
        .select('*')
        .eq('entry_id', entryId)
        .order('uploaded_at', { ascending: true });
      if (error) throw error;
      setFiles((data || []) as TimeEntryAttachment[]);
    } catch (e) {
      console.error('fetch attachments failed', e);
    } finally { setLoading(false); }
  }, [entryId, user?.id]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const uploadFile = useCallback(async (file: File, targetEntryId?: string): Promise<TimeEntryAttachment | null> => {
    const eId = targetEntryId || entryId;
    if (!eId || !user?.id) { toast.error('Save the entry first'); return null; }
    setUploading(true);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      const safeName = file.name || `paste-${Date.now()}.${ext}`;
      const path = `${user.id}/${eId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
      });
      if (upErr) throw upErr;
      const { data, error } = await (supabase as any)
        .from('nres_time_entry_attachments')
        .insert({
          entry_id: eId, user_id: user.id,
          file_name: safeName, file_path: path,
          file_size: file.size, file_type: file.type || null,
        }).select().single();
      if (error) throw error;
      const row = data as TimeEntryAttachment;
      if (eId === entryId) setFiles(prev => [...prev, row]);
      return row;
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || `Failed to upload ${file.name}`);
      return null;
    } finally { setUploading(false); }
  }, [entryId, user?.id]);

  const deleteFile = useCallback(async (id: string) => {
    const f = files.find(x => x.id === id);
    if (!f) return;
    try {
      await supabase.storage.from(BUCKET).remove([f.file_path]);
      const { error } = await (supabase as any)
        .from('nres_time_entry_attachments').delete().eq('id', id);
      if (error) throw error;
      setFiles(prev => prev.filter(x => x.id !== id));
      toast.success('Attachment removed');
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  }, [files]);

  const getSignedUrl = useCallback(async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) { toast.error('Could not load file'); return null; }
    return data.signedUrl;
  }, []);

  return { files, loading, uploading, uploadFile, deleteFile, getSignedUrl, refetch: fetchFiles };
}

/** Fetch attachment counts for many entries at once */
export function useTimeEntryAttachmentCounts(entryIds: string[]) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!user?.id || entryIds.length === 0) { setCounts({}); return; }
    try {
      const { data, error } = await (supabase as any)
        .from('nres_time_entry_attachments')
        .select('entry_id')
        .in('entry_id', entryIds);
      if (error) throw error;
      const c: Record<string, number> = {};
      (data || []).forEach((r: any) => { c[r.entry_id] = (c[r.entry_id] || 0) + 1; });
      setCounts(c);
    } catch (e) {
      console.error('count attachments failed', e);
    }
  }, [user?.id, entryIds.join(',')]);

  useEffect(() => { refresh(); }, [refresh]);

  return { counts, refresh };
}
