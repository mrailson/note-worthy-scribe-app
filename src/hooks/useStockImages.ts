import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const STOCK_IMAGE_CATEGORIES = [
  'Patients',
  'Buildings',
  'Reception & Waiting Areas',
  'Clinical Rooms',
  'Staff & Teams',
  'Technology',
  'Community & Wellbeing',
  'Meetings & Training',
  'Branding & Logos',
  'Infographic Elements',
  'Health Promotion & Campaigns',
  'Signage & Wayfinding',
  'Patient Safety & Infection Control',
  'Pharmacy & Prescriptions',
  'Mental Health & Wellbeing',
  'Access & Inclusivity',
  'Seasonal & Calendar Events',
  'Self-Care & Prevention',
  'Urgent & Emergency Care',
  'HR & Recruitment',
  'Data & Digital Services',
  'CQC & Compliance',
] as const;

export type StockImageCategory = typeof STOCK_IMAGE_CATEGORIES[number];

export const CATEGORY_GROUPS: { label: string; categories: StockImageCategory[] }[] = [
  {
    label: 'Clinical',
    categories: ['Patients', 'Clinical Rooms', 'Patient Safety & Infection Control', 'Pharmacy & Prescriptions', 'Urgent & Emergency Care'],
  },
  {
    label: 'Practice & Facilities',
    categories: ['Buildings', 'Reception & Waiting Areas', 'Signage & Wayfinding', 'Access & Inclusivity'],
  },
  {
    label: 'People & Culture',
    categories: ['Staff & Teams', 'HR & Recruitment', 'Meetings & Training'],
  },
  {
    label: 'Health & Community',
    categories: ['Community & Wellbeing', 'Mental Health & Wellbeing', 'Health Promotion & Campaigns', 'Self-Care & Prevention', 'Seasonal & Calendar Events'],
  },
  {
    label: 'Digital & Governance',
    categories: ['Technology', 'Data & Digital Services', 'CQC & Compliance'],
  },
  {
    label: 'Design Assets',
    categories: ['Branding & Logos', 'Infographic Elements'],
  },
];


export interface StockImage {
  id: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[];
  image_url: string;
  storage_path: string;
  file_size: number | null;
  is_active: boolean;
  created_at: string;
}

export function useStockImages() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc('is_system_admin', { _user_id: user.id });
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, []);

  // Fetch all stock images
  const { data: images = [], isLoading } = useQuery({
    queryKey: ['stock-images'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_images' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as StockImage[];
    },
  });

  // Filter images by search and category
  const filteredImages = useMemo(() => {
    let result = images;
    
    if (selectedCategory) {
      result = result.filter(img => img.category === selectedCategory);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(img =>
        img.title.toLowerCase().includes(q) ||
        img.description?.toLowerCase().includes(q) ||
        img.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    
    return result;
  }, [images, searchQuery, selectedCategory]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of STOCK_IMAGE_CATEGORIES) {
      counts[cat] = images.filter(img => img.category === cat).length;
    }
    return counts;
  }, [images]);

  // Upload stock image (admin only)
  const uploadMutation = useMutation({
    mutationFn: async ({ file, title, category, tags, description }: {
      file: File;
      title: string;
      category: string;
      tags: string[];
      description?: string;
    }) => {
      const ext = file.name.split('.').pop();
      const storagePath = `${category.toLowerCase().replace(/[^a-z0-9]/g, '-')}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('stock-images')
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('stock-images')
        .getPublicUrl(storagePath);

      const { error: insertError } = await supabase
        .from('stock_images' as any)
        .insert({
          title,
          description: description || null,
          category,
          tags,
          image_url: publicUrl,
          storage_path: storagePath,
          file_size: file.size,
          is_active: true,
        } as any);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-images'] });
      toast.success('Stock image uploaded successfully');
    },
    onError: (err: any) => {
      toast.error(`Upload failed: ${err.message}`);
    },
  });

  // Replace stock image file (admin only) — keeps metadata, swaps the file
  const replaceMutation = useMutation({
    mutationFn: async ({ image, newImageDataUrl }: { image: StockImage; newImageDataUrl: string }) => {
      // Convert data URL to blob without fetch (avoids "Failed to fetch" on large base64)
      const [header, base64] = newImageDataUrl.split(',');
      const mimeMatch = header.match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const byteString = atob(base64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mime });

      // Upload replacement to same storage path (overwrite)
      const { error: uploadError } = await supabase.storage
        .from('stock-images')
        .upload(image.storage_path, blob, { upsert: true });
      if (uploadError) throw uploadError;

      // Update timestamp so caches refresh
      const { data: { publicUrl } } = supabase.storage
        .from('stock-images')
        .getPublicUrl(image.storage_path);

      const freshUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('stock_images' as any)
        .update({ image_url: freshUrl } as any)
        .eq('id', image.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-images'] });
      toast.success('Stock image replaced successfully');
    },
    onError: (err: any) => {
      toast.error(`Replace failed: ${err.message}`);
    },
  });

  // Delete stock image (admin only)
  const deleteMutation = useMutation({
    mutationFn: async (image: StockImage) => {
      await supabase.storage.from('stock-images').remove([image.storage_path]);
      const { error } = await supabase
        .from('stock_images' as any)
        .delete()
        .eq('id', image.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-images'] });
      toast.success('Stock image deleted');
    },
    onError: (err: any) => {
      toast.error(`Delete failed: ${err.message}`);
    },
  });

  return {
    images: filteredImages,
    allImages: images,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    categoryCounts,
    isAdmin,
    uploadImage: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deleteImage: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    replaceStockImage: replaceMutation.mutateAsync,
    isReplacing: replaceMutation.isPending,
  };
}
