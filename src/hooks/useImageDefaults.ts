import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { UserGeneratedImage } from './useImageGallery';

export interface ImageDefault {
  id: string;
  user_id: string;
  template_type: string;
  image_id: string | null;
  created_at: string;
  updated_at: string;
}

export const TEMPLATE_TYPES = [
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'poster', label: 'Poster' },
  { value: 'infographic', label: 'Infographic' },
  { value: 'social-media', label: 'Social Media' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'header', label: 'Header/Banner' },
] as const;

export type TemplateType = typeof TEMPLATE_TYPES[number]['value'];

export interface UseImageDefaults {
  defaults: Record<string, ImageDefault>;
  isLoading: boolean;
  getDefault: (templateType: string) => ImageDefault | null;
  setDefault: (templateType: string, imageId: string) => Promise<boolean>;
  clearDefault: (templateType: string) => Promise<boolean>;
  getDefaultImage: (templateType: string, images: UserGeneratedImage[]) => UserGeneratedImage | null;
}

export const useImageDefaults = (): UseImageDefaults => {
  const { user } = useAuth();
  const [defaults, setDefaults] = useState<Record<string, ImageDefault>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchDefaults = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_image_defaults')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const defaultsMap: Record<string, ImageDefault> = {};
      (data || []).forEach(d => {
        defaultsMap[d.template_type] = d as ImageDefault;
      });
      setDefaults(defaultsMap);
    } catch (err) {
      console.error('Error fetching image defaults:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const getDefault = useCallback((templateType: string): ImageDefault | null => {
    return defaults[templateType] || null;
  }, [defaults]);

  const setDefault = useCallback(async (templateType: string, imageId: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { data, error } = await supabase
        .from('user_image_defaults')
        .upsert({
          user_id: user.id,
          template_type: templateType,
          image_id: imageId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,template_type'
        })
        .select()
        .single();

      if (error) throw error;

      setDefaults(prev => ({
        ...prev,
        [templateType]: data as ImageDefault,
      }));

      toast.success(`Set as default for ${templateType}`);
      return true;
    } catch (err) {
      console.error('Error setting image default:', err);
      toast.error('Failed to set default');
      return false;
    }
  }, [user?.id]);

  const clearDefault = useCallback(async (templateType: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error } = await supabase
        .from('user_image_defaults')
        .delete()
        .eq('user_id', user.id)
        .eq('template_type', templateType);

      if (error) throw error;

      setDefaults(prev => {
        const newDefaults = { ...prev };
        delete newDefaults[templateType];
        return newDefaults;
      });

      toast.success(`Cleared default for ${templateType}`);
      return true;
    } catch (err) {
      console.error('Error clearing image default:', err);
      toast.error('Failed to clear default');
      return false;
    }
  }, [user?.id]);

  const getDefaultImage = useCallback((templateType: string, images: UserGeneratedImage[]): UserGeneratedImage | null => {
    const defaultEntry = defaults[templateType];
    if (!defaultEntry?.image_id) return null;
    return images.find(img => img.id === defaultEntry.image_id) || null;
  }, [defaults]);

  useEffect(() => {
    if (user?.id) {
      fetchDefaults();
    }
  }, [user?.id, fetchDefaults]);

  return {
    defaults,
    isLoading,
    getDefault,
    setDefault,
    clearDefault,
    getDefaultImage,
  };
};
