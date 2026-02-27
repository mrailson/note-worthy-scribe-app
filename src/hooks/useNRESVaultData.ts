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
  description: string | null;
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
        .select('id, name, original_name, folder_id, file_path, file_size, file_type, mime_type, created_by, created_at, updated_at, tags, description')
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
      if (!folderId) return [{ id: null, name: 'Document Vault Home' }];

      const ancestors: BreadcrumbItem[] = [];
      let currentId: string | null = folderId;

      while (currentId) {
        const { data } = await supabase
          .from('shared_drive_folders')
          .select('id, name, parent_id')
          .eq('id', currentId)
          .single();

        if (!data) break;
        ancestors.push({ id: data.id, name: data.name });
        currentId = data.parent_id;
      }

      // ancestors is [current, parent, grandparent, ...] — reverse to get root-first
      ancestors.reverse();
      return [{ id: null, name: 'Document Vault Home' }, ...ancestors];
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
          .select('id, name, original_name, folder_id, file_path, file_size, file_type, mime_type, created_by, created_at, updated_at, tags, description')
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

      // Auto-assign owner permission so folder is private by default
      await supabase
        .from('shared_drive_permissions')
        .insert({
          target_id: data.id,
          target_type: 'folder' as any,
          user_id: user.id,
          permission_level: 'owner' as any,
          granted_by: user.id,
          is_inherited: false,
          actions: ['view', 'edit', 'delete', 'share', 'upload'] as any,
        });

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

export const useReplaceVaultFile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ fileId, oldFilePath, newFile }: { fileId: string; oldFilePath: string; newFile: File }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Upload new file to a new storage path
      const timestamp = Date.now();
      const ext = newFile.name.split('.').pop();
      const storagePath = `nres-vault/${user.id}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('shared-drive')
        .upload(storagePath, newFile);

      if (uploadError) throw uploadError;

      // Remove old file from storage
      await supabase.storage.from('shared-drive').remove([oldFilePath]);

      // Update the DB record with new file details
      const { error } = await supabase
        .from('shared_drive_files')
        .update({
          name: newFile.name,
          original_name: newFile.name,
          file_path: storagePath,
          file_size: newFile.size,
          file_type: ext || null,
          mime_type: newFile.type || null,
        })
        .eq('id', fileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-files'] });
      toast.success('File replaced successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to replace file', { description: error.message });
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

export const useRenameVaultItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, type, newName }: { id: string; type: 'folder' | 'file'; newName: string }) => {
      if (type === 'folder') {
        const { error } = await supabase.from('shared_drive_folders').update({ name: newName }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shared_drive_files').update({ name: newName, original_name: newName }).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-folders'] });
      queryClient.invalidateQueries({ queryKey: ['nres-vault-files'] });
      toast.success('Item renamed');
    },
    onError: (error: any) => {
      toast.error('Failed to rename', { description: error.message });
    },
  });
};

export const useMoveVaultItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, type, targetFolderId }: { id: string; type: 'folder' | 'file'; targetFolderId: string | null }) => {
      if (type === 'folder') {
        const { error } = await supabase.from('shared_drive_folders').update({ parent_id: targetFolderId }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shared_drive_files').update({ folder_id: targetFolderId }).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-folders'] });
      queryClient.invalidateQueries({ queryKey: ['nres-vault-files'] });
      toast.success('Item moved');
    },
    onError: (error: any) => {
      toast.error('Failed to move', { description: error.message });
    },
  });
};

export const useCopyVaultFile = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ fileId, targetFolderId }: { fileId: string; targetFolderId: string | null }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Get original file record
      const { data: original, error: fetchError } = await supabase
        .from('shared_drive_files')
        .select('*')
        .eq('id', fileId)
        .single();
      if (fetchError || !original) throw fetchError || new Error('File not found');

      // Download from storage
      const { data: blob, error: dlError } = await supabase.storage
        .from('shared-drive')
        .download(original.file_path);
      if (dlError) throw dlError;

      // Upload copy
      const timestamp = Date.now();
      const ext = original.name.split('.').pop();
      const newPath = `nres-vault/${user.id}/${timestamp}.${ext}`;
      const { error: upError } = await supabase.storage
        .from('shared-drive')
        .upload(newPath, blob);
      if (upError) throw upError;

      // Insert new record
      const { error: insertError } = await supabase
        .from('shared_drive_files')
        .insert({
          name: original.name,
          original_name: original.original_name,
          folder_id: targetFolderId,
          file_path: newPath,
          file_size: original.file_size,
          file_type: original.file_type,
          mime_type: original.mime_type,
          created_by: user.id,
          scope: 'nres_vault',
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-files'] });
      toast.success('File copied');
    },
    onError: (error: any) => {
      toast.error('Failed to copy file', { description: error.message });
    },
  });
};

export const useUpdateFileDescription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, description }: { fileId: string; description: string }) => {
      const { error } = await supabase
        .from('shared_drive_files')
        .update({ description: description || null, updated_at: new Date().toISOString() })
        .eq('id', fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nres-vault-files'] });
      queryClient.invalidateQueries({ queryKey: ['nres-vault-search'] });
      toast.success('Description updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update description', { description: error.message });
    },
  });
};
