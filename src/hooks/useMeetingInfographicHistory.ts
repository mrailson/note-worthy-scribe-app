import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SavedInfographic {
  id: string;
  meeting_id: string;
  image_url: string;
  storage_path: string | null;
  style: string | null;
  orientation: string | null;
  created_at: string;
}

export const useMeetingInfographicHistory = (meetingId: string | undefined) => {
  const [infographics, setInfographics] = useState<SavedInfographic[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInfographics = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meeting_infographics' as any)
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInfographics((data as any[]) || []);
    } catch (err) {
      console.error('Failed to fetch infographics:', err);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchInfographics();
  }, [fetchInfographics]);

  const saveInfographic = useCallback(async (
    imageUrl: string,
    style: string,
    orientation: string,
  ): Promise<boolean> => {
    if (!meetingId) return false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Download image and upload to storage
      let blob: Blob;
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: 'image/png' });
      } else {
        const response = await fetch(imageUrl);
        blob = await response.blob();
      }

      const timestamp = Date.now();
      const storagePath = `${user.id}/${meetingId}/${timestamp}.png`;

      const { error: uploadError } = await supabase.storage
        .from('meeting-infographics')
        .upload(storagePath, blob, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('meeting-infographics')
        .getPublicUrl(storagePath);

      const { error: insertError } = await supabase
        .from('meeting_infographics' as any)
        .insert({
          meeting_id: meetingId,
          user_id: user.id,
          image_url: publicUrl,
          storage_path: storagePath,
          style,
          orientation,
        });

      if (insertError) throw insertError;

      await fetchInfographics();
      return true;
    } catch (err) {
      console.error('Failed to save infographic:', err);
      toast.error('Failed to save infographic');
      return false;
    }
  }, [meetingId, fetchInfographics]);

  const deleteInfographic = useCallback(async (id: string) => {
    try {
      const target = infographics.find(i => i.id === id);
      if (!target) return;

      // Delete from storage if path exists
      if (target.storage_path) {
        await supabase.storage
          .from('meeting-infographics')
          .remove([target.storage_path]);
      }

      const { error } = await supabase
        .from('meeting_infographics' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInfographics(prev => prev.filter(i => i.id !== id));
      toast.success('Infographic deleted');
    } catch (err) {
      console.error('Failed to delete infographic:', err);
      toast.error('Failed to delete infographic');
    }
  }, [infographics]);

  return {
    infographics,
    loading,
    refresh: fetchInfographics,
    saveInfographic,
    deleteInfographic,
    count: infographics.length,
  };
};
