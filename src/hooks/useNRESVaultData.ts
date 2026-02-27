import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface VaultFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  path: string;
}

export interface VaultFile {
  id: string;
  name: string;
  original_name: string;
  folder_id: string | null;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  mime_type: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export const useVaultFolders = (parentId: string | null) => {
  return useQuery({
    queryKey: ['nres-vault-folders', parentId],
    queryFn: async () => {
      let query = supabase
        .from('shared_drive_folders')
        .select('id, name, parent_id, created_by, created_at, updated_at, path')
        .eq('scope', 'nres_vault')
        .order('name');

      if (parentId) {
        query = query.eq('parent_id', parentId);
      } else {
        query = query.is('parent_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as VaultFolder[];
    },
  });
};

export const useVaultFiles = (folderId: string | null) => {
  return useQuery({
    queryKey: ['nres-vault-files', folderId],
    queryFn: async () => {
      let query = supabase
        .from('shared_drive_files')
        .select('id, name, original_name, folder_id, file_path, file_size, file_type, mime_type, created_by, created_at, updated_at, tags')
        .eq('scope', 'nres_vault')
        .order('name');

      if (folderId) {
        query = query.eq('folder_id', folderId);
      } else {
        query = query.is('folder_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as VaultFile[];
    },
  });
};

export const useVaultBreadcrumbs = (folderId: string | null) => {
  return useQuery({
    queryKey: ['nres-vault-breadcrumbs', folderId],
    queryFn: async (): Promise<BreadcrumbItem[]> => {
      if (!folderId) return [{ id: null, name: 'Document Vault' }];

      const crumbs: BreadcrumbItem[] = [{ id: null, name: 'Document Vault' }];
      let currentId: string | null = folderId;

      while (currentId) {
        const { data } = await supabase
          .from('shared_drive_folders')
          .select('id, name, parent_id')
          .eq('id', currentId)
          .single();

        if (!data) break;
        crumbs.splice(1, 0, { id: data.id, name: data.name });
        currentId = data.parent_id;
      }

      // Reverse the inserted items so they're in correct order
      const root = crumbs[0];
      const rest = crumbs.slice(1).reverse();
      return [root, ...rest];
    },
    enabled: true,
  });
};

export const useVaultSearch = (searchQuery: string) => {
  return useQuery({
    queryKey: ['nres-vault-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return { folders: [], files: [] };

      const [foldersRes, filesRes] = await Promise.all([
        supabase
          .from('shared_drive_folders')
          .select('id, name, parent_id, created_by, created_at, updated_at, path')
          .eq('scope', 'nres_vault')
          .ilike('name', `%${searchQuery}%`)
          .limit(20),
        supabase
          .from('shared_drive_files')
          .select('id, name, original_name, folder_id, file_path, file_size, file_type, mime_type, created_by, created_at, updated_at, tags')
          .eq('scope', 'nres_vault')
          .ilike('name', `%${searchQuery}%`)
          .limit(20),
      ]);

      return {
        folders: (foldersRes.data || []) as VaultFolder[],
        files: (filesRes.data || []) as VaultFile[],
      };
    },
    enabled: searchQuery.trim().length > 0,
  });
};

export const useCreateVaultFolder = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId: string | null }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const path = parentId ? `${parentId}/${name}` : name;

      const { data, error } = await supabase
        .from('shared_drive_folders')
        .insert({
          name,
          parent_id: parentId,
          created_by: user.id,
          path,
          scope: 'nres_vault',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-folders'] });
      toast.success(`Folder "${variables.name}" created`);
    },
    onError: (error: any) => {
      toast.error('Failed to create folder', { description: error.message });
    },
  });
};

export const useUploadVaultFile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ file, folderId }: { file: File; folderId: string | null }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const storagePath = `nres-vault/${user.id}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('shared-drive')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('shared_drive_files')
        .insert({
          name: file.name,
          original_name: file.name,
          folder_id: folderId,
          file_path: storagePath,
          file_size: file.size,
          file_type: ext || null,
          mime_type: file.type || null,
          created_by: user.id,
          scope: 'nres_vault',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-files'] });
      toast.success('File uploaded successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to upload file', { description: error.message });
    },
  });
};

export const useDeleteVaultItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, type, filePath }: { id: string; type: 'folder' | 'file'; filePath?: string }) => {
      if (type === 'file') {
        if (filePath) {
          await supabase.storage.from('shared-drive').remove([filePath]);
        }
        const { error } = await supabase.from('shared_drive_files').delete().eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shared_drive_folders').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-folders'] });
      queryClient.invalidateQueries({ queryKey: ['nres-vault-files'] });
      toast.success('Item deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete', { description: error.message });
    },
  });
};
