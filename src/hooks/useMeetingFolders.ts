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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user authenticated, skipping folder fetch');
        setFolders([]);
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('meeting_folders')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching folders:', error);
        // Don't show toast for RLS-related errors during recording stop
        if (!error.message?.includes('JWT')) {
          showToast.error('Failed to load folders');
        }
        setFolders([]);
        return;
      }
      setFolders(data || []);
    } catch (error: any) {
      console.error('Error fetching folders:', error);
      // Silent fail - don't block the UI
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders();

    const channel = supabase
      .channel('meeting_folders_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_folders' },
        () => {
          fetchFolders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFolders]);

  const createFolder = async (name: string, description?: string, colour?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check for duplicate folder name
      const existingFolder = folders.find(f => f.name.toLowerCase() === name.toLowerCase());
      if (existingFolder) {
        showToast.error('A folder with this name already exists');
        return null;
      }

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
      // Check for duplicate folder name when renaming (excluding current folder)
      if (updates.name) {
        const existingFolder = folders.find(f => 
          f.id !== id && f.name.toLowerCase() === updates.name!.toLowerCase()
        );
        if (existingFolder) {
          showToast.error('A folder with this name already exists');
          return null;
        }
      }

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
      console.log('🗂 assignMeetingToFolder called', { meetingId, folderId });
 
      const { data, error } = await supabase
        .from('meetings')
        .update({ folder_id: folderId })
        .eq('id', meetingId)
        .select('id, folder_id, user_id')
        .maybeSingle();
 
      if (error) {
        console.error('🛑 assignMeetingToFolder error:', {
          message: error.message,
          details: (error as any).details,
          code: (error as any).code,
        });
        throw error;
      }
 
      // Check if the update actually happened
      if (!data) {
        console.error('🛑 assignMeetingToFolder: No rows updated - meeting may not exist or RLS blocked the update');
        showToast.error('Failed to assign meeting to folder - please try again');
        return false;
      }

      // Verify the folder_id was actually set correctly
      if (data.folder_id !== folderId) {
        console.error('🛑 assignMeetingToFolder: folder_id mismatch', { expected: folderId, actual: data.folder_id });
        showToast.error('Folder assignment did not persist correctly');
        return false;
      }
 
      console.log('✅ assignMeetingToFolder success - verified update:', data);
      return true;
    } catch (error: any) {
      console.error('Error assigning meeting to folder (caught):', {
        message: error.message,
        details: error.details,
        code: error.code,
      });
      showToast.error(`Failed to assign meeting to folder: ${error.message || 'Unknown error'}`);
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
