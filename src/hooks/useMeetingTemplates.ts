import { useState, useCallback } from 'react';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface MeetingTemplate {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  category: 'format' | 'instruction' | 'style';
  description?: string;
  created_at: string;
  file_size?: number;
}

export const useMeetingTemplates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MeetingTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('meeting_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      showToast.error('Failed to load templates', { section: 'meeting_manager' });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const uploadTemplate = useCallback(async (
    file: File,
    category: 'format' | 'instruction' | 'style',
    description?: string
  ) => {
    if (!user) return null;

    setIsUploading(true);
    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('meeting-templates')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Save metadata to database
      const { data, error } = await (supabase as any)
        .from('meeting_templates')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          category,
          description
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [data, ...prev]);
      showToast.success('Template uploaded successfully', { section: 'meeting_manager' });
      return data;
    } catch (error) {
      console.error('Error uploading template:', error);
      showToast.error('Failed to upload template', { section: 'meeting_manager' });
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [user]);

  const deleteTemplate = useCallback(async (templateId: string, filePath: string) => {
    if (!user) return;

    try {
      // Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('meeting-templates')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete metadata from database
      const { error } = await (supabase as any)
        .from('meeting_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTemplates(prev => prev.filter(t => t.id !== templateId));
      showToast.success('Template deleted successfully', { section: 'meeting_manager' });
    } catch (error) {
      console.error('Error deleting template:', error);
      showToast.error('Failed to delete template', { section: 'meeting_manager' });
    }
  }, [user]);

  const downloadTemplate = useCallback(async (template: MeetingTemplate) => {
    try {
      const { data, error } = await supabase.storage
        .from('meeting-templates')
        .download(template.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      showToast.error('Failed to download template', { section: 'meeting_manager' });
    }
  }, []);

  const getTemplateContent = useCallback(async (template: MeetingTemplate): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('meeting-templates')
        .download(template.file_path);

      if (error) throw error;
      return await data.text();
    } catch (error) {
      console.error('Error getting template content:', error);
      return null;
    }
  }, []);

  return {
    templates,
    isLoading,
    isUploading,
    fetchTemplates,
    uploadTemplate,
    deleteTemplate,
    downloadTemplate,
    getTemplateContent
  };
};