import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserGeneratedImage {
  id: string;
  user_id: string;
  image_url: string;
  prompt: string | null;
  detailed_prompt: string | null;
  alt_text: string | null;
  image_settings: Record<string, unknown> | null;
  source: string | null;
  category: string | null;
  title: string | null;
  is_favourite: boolean;
  created_at: string;
}

export interface ImageFilters {
  source?: string;
  category?: string;
  isFavourite?: boolean;
  searchQuery?: string;
  limit?: number;
}

export interface UseImageGallery {
  images: UserGeneratedImage[];
  favourites: UserGeneratedImage[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
  
  fetchImages: (filters?: ImageFilters) => Promise<void>;
  toggleFavourite: (imageId: string) => Promise<boolean>;
  deleteImage: (imageId: string) => Promise<boolean>;
  updateCategory: (imageId: string, category: string | null) => Promise<boolean>;
  updateTitle: (imageId: string, title: string) => Promise<boolean>;
  saveImage: (imageData: Partial<UserGeneratedImage>) => Promise<string | null>;
  refetch: () => Promise<void>;
}

export const useImageGallery = (): UseImageGallery => {
  const { user } = useAuth();
  const [images, setImages] = useState<UserGeneratedImage[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImages = useCallback(async (filters?: ImageFilters) => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('user_generated_images')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (filters?.source) {
        query = query.eq('source', filters.source);
      }

      if (filters?.category) {
        query = query.eq('category', filters.category);
      }

      if (filters?.isFavourite !== undefined) {
        query = query.eq('is_favourite', filters.isFavourite);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      let filteredData = (data || []) as UserGeneratedImage[];

      // Client-side search filtering
      if (filters?.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        filteredData = filteredData.filter(img =>
          img.title?.toLowerCase().includes(searchLower) ||
          img.prompt?.toLowerCase().includes(searchLower) ||
          img.category?.toLowerCase().includes(searchLower)
        );
      }

      setImages(filteredData);

      // Extract unique categories
      const uniqueCategories = [...new Set(
        (data || [])
          .map(img => img.category)
          .filter((cat): cat is string => !!cat)
      )];
      setCategories(uniqueCategories);

    } catch (err) {
      console.error('Error fetching images:', err);
      setError('Failed to load images');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const toggleFavourite = useCallback(async (imageId: string): Promise<boolean> => {
    if (!user?.id) return false;

    const image = images.find(img => img.id === imageId);
    if (!image) return false;

    const newValue = !image.is_favourite;

    try {
      const { error: updateError } = await supabase
        .from('user_generated_images')
        .update({ is_favourite: newValue })
        .eq('id', imageId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setImages(prev => prev.map(img =>
        img.id === imageId ? { ...img, is_favourite: newValue } : img
      ));

      toast.success(newValue ? 'Added to favourites' : 'Removed from favourites');
      return true;
    } catch (err) {
      console.error('Error toggling favourite:', err);
      toast.error('Failed to update favourite');
      return false;
    }
  }, [user?.id, images]);

  const deleteImage = useCallback(async (imageId: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error: deleteError } = await supabase
        .from('user_generated_images')
        .delete()
        .eq('id', imageId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setImages(prev => prev.filter(img => img.id !== imageId));
      toast.success('Image deleted');
      return true;
    } catch (err) {
      console.error('Error deleting image:', err);
      toast.error('Failed to delete image');
      return false;
    }
  }, [user?.id]);

  const updateCategory = useCallback(async (imageId: string, category: string | null): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error: updateError } = await supabase
        .from('user_generated_images')
        .update({ category })
        .eq('id', imageId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setImages(prev => prev.map(img =>
        img.id === imageId ? { ...img, category } : img
      ));

      // Update categories list
      if (category && !categories.includes(category)) {
        setCategories(prev => [...prev, category]);
      }

      toast.success('Category updated');
      return true;
    } catch (err) {
      console.error('Error updating category:', err);
      toast.error('Failed to update category');
      return false;
    }
  }, [user?.id, categories]);

  const updateTitle = useCallback(async (imageId: string, title: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { error: updateError } = await supabase
        .from('user_generated_images')
        .update({ title })
        .eq('id', imageId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setImages(prev => prev.map(img =>
        img.id === imageId ? { ...img, title } : img
      ));

      toast.success('Title updated');
      return true;
    } catch (err) {
      console.error('Error updating title:', err);
      toast.error('Failed to update title');
      return false;
    }
  }, [user?.id]);

  const saveImage = useCallback(async (imageData: Partial<UserGeneratedImage>): Promise<string | null> => {
    if (!user?.id) return null;

    try {
      const { data, error: insertError } = await supabase
        .from('user_generated_images')
        .insert({
          user_id: user.id,
          image_url: imageData.image_url!,
          prompt: imageData.prompt || '',
          detailed_prompt: imageData.detailed_prompt || null,
          alt_text: imageData.alt_text || null,
          image_settings: imageData.image_settings ? JSON.parse(JSON.stringify(imageData.image_settings)) : null,
          source: imageData.source || 'image-studio',
          category: imageData.category || null,
          title: imageData.title || null,
          is_favourite: imageData.is_favourite || false,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Refetch to get the new image in the list
      await fetchImages();
      
      return data?.id || null;
    } catch (err) {
      console.error('Error saving image:', err);
      toast.error('Failed to save image');
      return null;
    }
  }, [user?.id, fetchImages]);

  const refetch = useCallback(() => fetchImages(), [fetchImages]);

  // Get favourites from images
  const favourites = images.filter(img => img.is_favourite);

  // Initial fetch
  useEffect(() => {
    if (user?.id) {
      fetchImages();
    }
  }, [user?.id, fetchImages]);

  return {
    images,
    favourites,
    categories,
    isLoading,
    error,
    fetchImages,
    toggleFavourite,
    deleteImage,
    updateCategory,
    updateTitle,
    saveImage,
    refetch,
  };
};
