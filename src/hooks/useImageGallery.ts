import { useState, useCallback } from 'react';
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

const DEFAULT_PAGE_SIZE = 20;

export interface UseImageGallery {
  images: UserGeneratedImage[];
  favourites: UserGeneratedImage[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;

  fetchImages: (filters?: ImageFilters) => Promise<void>;
  loadMore: () => Promise<void>;
  toggleFavourite: (imageId: string) => Promise<boolean>;
  deleteImage: (imageId: string) => Promise<boolean>;
  updateCategory: (imageId: string, category: string | null) => Promise<boolean>;
  updateTitle: (imageId: string, title: string) => Promise<boolean>;
  saveImage: (imageData: Partial<UserGeneratedImage>) => Promise<string | null>;
  refetch: () => Promise<void>;
  reset: () => void;
}

export const useImageGallery = (): UseImageGallery => {
  const { user } = useAuth();
  const [images, setImages] = useState<UserGeneratedImage[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [lastFilters, setLastFilters] = useState<ImageFilters | undefined>();

  const fetchImages = useCallback(async (filters?: ImageFilters) => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);
    setCurrentOffset(0);
    setLastFilters(filters);

    try {
      const pageSize = filters?.limit || DEFAULT_PAGE_SIZE;

      let query = supabase
        .from('user_generated_images')
        .select('id, user_id, image_url, prompt, alt_text, source, category, title, is_favourite, created_at, detailed_prompt, image_settings')
        .eq('user_id', user.id)
        .in('source', ['image-studio', 'infographic'])
        .order('created_at', { ascending: false })
        .range(0, pageSize - 1);

      if (filters?.source) {
        query = query.eq('source', filters.source);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.isFavourite !== undefined) {
        query = query.eq('is_favourite', filters.isFavourite);
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
      setHasMore(filteredData.length >= pageSize);
      setCurrentOffset(filteredData.length);

      // Extract unique categories
      const uniqueCategories = [...new Set(
        filteredData
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

  const loadMore = useCallback(async () => {
    if (!user?.id || isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const pageSize = lastFilters?.limit || DEFAULT_PAGE_SIZE;

      let query = supabase
        .from('user_generated_images')
        .select('id, user_id, image_url, prompt, alt_text, source, category, title, is_favourite, created_at, detailed_prompt, image_settings')
        .eq('user_id', user.id)
        .in('source', ['image-studio', 'infographic'])
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + pageSize - 1);

      if (lastFilters?.source) {
        query = query.eq('source', lastFilters.source);
      }
      if (lastFilters?.category) {
        query = query.eq('category', lastFilters.category);
      }
      if (lastFilters?.isFavourite !== undefined) {
        query = query.eq('is_favourite', lastFilters.isFavourite);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const newImages = (data || []) as UserGeneratedImage[];
      setImages(prev => [...prev, ...newImages]);
      setHasMore(newImages.length >= pageSize);
      setCurrentOffset(prev => prev + newImages.length);
    } catch (err) {
      console.error('Error loading more images:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isLoading, hasMore, currentOffset, lastFilters]);

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
      if (category && !categories.includes(category)) {
        setCategories(prev => [...prev, category]);
      }
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

      // Prepend new image to local state instead of full refetch
      if (data) {
        const newImage: UserGeneratedImage = {
          id: data.id,
          user_id: user.id,
          image_url: imageData.image_url!,
          prompt: imageData.prompt || null,
          detailed_prompt: imageData.detailed_prompt || null,
          alt_text: imageData.alt_text || null,
          image_settings: imageData.image_settings || null,
          source: imageData.source || 'image-studio',
          category: imageData.category || null,
          title: imageData.title || null,
          is_favourite: imageData.is_favourite || false,
          created_at: new Date().toISOString(),
        };
        setImages(prev => [newImage, ...prev]);
      }

      return data?.id || null;
    } catch (err) {
      console.error('Error saving image:', err);
      toast.error('Failed to save image');
      return null;
    }
  }, [user?.id]);

  const reset = useCallback(() => {
    setImages([]);
    setCategories([]);
    setCurrentOffset(0);
    setHasMore(true);
    setError(null);
    setLastFilters(undefined);
  }, []);

  const refetch = useCallback(() => fetchImages(lastFilters), [fetchImages, lastFilters]);
  const favourites = images.filter(img => img.is_favourite);

  return {
    images,
    favourites,
    categories,
    isLoading,
    error,
    hasMore,
    fetchImages,
    loadMore,
    toggleFavourite,
    deleteImage,
    updateCategory,
    updateTitle,
    saveImage,
    refetch,
    reset,
  };
};
