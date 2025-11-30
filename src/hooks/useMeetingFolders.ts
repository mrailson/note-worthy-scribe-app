import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

export interface MeetingFolder {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  colour: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const useMeetingFolders = () => {
  const [folders, setFolders] = useState<MeetingFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFolders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_folders')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setFolders(data || []);
    } catch (error: any) {
      console.error('Error fetching folders:', error);
      showToast.error('Failed to load folders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const createFolder = async (name: string, description?: string, colour?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const maxOrder = folders.length > 0 ? Math.max(...folders.map(f => f.display_order)) : 0;

      const { data, error } = await supabase
        .from('meeting_folders')
        .insert({
          user_id: user.id,
          name,
          description,
          colour: colour || '#3b82f6',
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      setFolders(prev => [...prev, data]);
      showToast.success('Folder created successfully');
      return data;
    } catch (error: any) {
      console.error('Error creating folder:', error);
      showToast.error('Failed to create folder');
      return null;
    }
  };

  const updateFolder = async (id: string, updates: Partial<MeetingFolder>) => {
    try {
      const { data, error } = await supabase
        .from('meeting_folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setFolders(prev => prev.map(f => f.id === id ? data : f));
      showToast.success('Folder updated successfully');
      return data;
    } catch (error: any) {
      console.error('Error updating folder:', error);
      showToast.error('Failed to update folder');
      return null;
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('meeting_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setFolders(prev => prev.filter(f => f.id !== id));
      showToast.success('Folder deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      showToast.error('Failed to delete folder');
      return false;
    }
  };

  const assignMeetingToFolder = async (meetingId: string, folderId: string | null) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ folder_id: folderId })
        .eq('id', meetingId);

      if (error) throw error;

      showToast.success(folderId ? 'Meeting assigned to folder' : 'Meeting removed from folder');
      return true;
    } catch (error: any) {
      console.error('Error assigning meeting to folder:', error);
      showToast.error('Failed to assign meeting to folder');
      return false;
    }
  };

  return {
    folders,
    loading,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    assignMeetingToFolder,
  };
};
