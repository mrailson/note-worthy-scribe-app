import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logVaultAction } from './useNRESVaultAudit';

export type VaultScope = 'nres_vault' | 'enn_vault';

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

const storagePrefix = (scope: VaultScope) => scope === 'enn_vault' ? 'enn-vault' : 'nres-vault';

export const useVaultFolders = (parentId: string | null, scope: VaultScope = 'nres_vault') => {
  return useQuery({
    queryKey: ['vault-folders', scope, parentId],
    queryFn: async () => {
      let query = supabase
        .from('shared_drive_folders')
        .select('id, name, parent_id, created_by, created_at, updated_at, path')
        .eq('scope', scope)
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

export const useVaultFiles = (folderId: string | null, scope: VaultScope = 'nres_vault') => {
  return useQuery({
    queryKey: ['vault-files', scope, folderId],
    queryFn: async () => {
      let query = supabase
        .from('shared_drive_files')
        .select('id, name, original_name, folder_id, file_path, file_size, file_type, mime_type, created_by, created_at, updated_at, tags, description')
        .eq('scope', scope)
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

export const useVaultBreadcrumbs = (folderId: string | null, _scope: VaultScope = 'nres_vault') => {
  return useQuery({
    queryKey: ['vault-breadcrumbs', _scope, folderId],
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

      ancestors.reverse();
      return [{ id: null, name: 'Document Vault Home' }, ...ancestors];
    },
    enabled: true,
  });
};

export const useVaultSearch = (searchQuery: string, scope: VaultScope = 'nres_vault') => {
  return useQuery({
    queryKey: ['vault-search', scope, searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return { folders: [], files: [] };

      const [foldersRes, filesRes] = await Promise.all([
        supabase
          .from('shared_drive_folders')
          .select('id, name, parent_id, created_by, created_at, updated_at, path')
          .eq('scope', scope)
          .ilike('name', `%${searchQuery}%`)
          .limit(20),
        supabase
          .from('shared_drive_files')
          .select('id, name, original_name, folder_id, file_path, file_size, file_type, mime_type, created_by, created_at, updated_at, tags, description')
          .eq('scope', scope)
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

export const useCreateVaultFolder = (scope: VaultScope = 'nres_vault') => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId: string | null }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Check for duplicate folder name in the same scope and parent
      let dupQuery = supabase
        .from('shared_drive_folders')
        .select('id')
        .eq('scope', scope)
        .eq('name', name);
      if (parentId) {
        dupQuery = dupQuery.eq('parent_id', parentId);
      } else {
        dupQuery = dupQuery.is('parent_id', null);
      }
      const { data: existing } = await dupQuery.maybeSingle();
      if (existing) throw new Error('A folder with this name already exists here');

      const path = parentId ? `${parentId}/${name}` : name;

      const { data, error } = await supabase
        .from('shared_drive_folders')
        .insert({
          name,
          parent_id: parentId,
          created_by: user.id,
          path,
          scope,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: permissionError } = await supabase
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

      if (permissionError) {
        await supabase.from('shared_drive_folders').delete().eq('id', data.id);
        throw new Error(`Failed to apply private owner permission: ${permissionError.message}`);
      }

      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vault-folders', scope] });
      if (user?.id) logVaultAction(user.id, { action: 'create_folder', target_type: 'folder', target_id: data.id, target_name: variables.name });
    },
    onError: (error: any) => {
      toast.error('Failed to create folder', { description: error.message });
    },
  });
};

export const useUploadVaultFile = (scope: VaultScope = 'nres_vault') => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ file, folderId }: { file: File; folderId: string | null }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const storagePath = `${storagePrefix(scope)}/${user.id}/${timestamp}.${ext}`;

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
          scope,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vault-files', scope] });
      if (user?.id) logVaultAction(user.id, { action: 'upload_file', target_type: 'file', target_id: data?.id, target_name: variables.file.name });
    },
    onError: (error: any) => {
      toast.error('Failed to upload file', { description: error.message });
    },
  });
};

export const useReplaceVaultFile = (scope: VaultScope = 'nres_vault') => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ fileId, oldFilePath, newFile }: { fileId: string; oldFilePath: string; newFile: File }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const timestamp = Date.now();
      const ext = newFile.name.split('.').pop();
      const storagePath = `${storagePrefix(scope)}/${user.id}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('shared-drive')
        .upload(storagePath, newFile);

      if (uploadError) throw uploadError;

      await supabase.storage.from('shared-drive').remove([oldFilePath]);

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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vault-files', scope] });
      if (user?.id) logVaultAction(user.id, { action: 'replace_file', target_type: 'file', target_id: variables.fileId, target_name: variables.newFile.name });
    },
    onError: (error: any) => {
      toast.error('Failed to replace file', { description: error.message });
    },
  });
};

export const useDeleteVaultItem = (scope: VaultScope = 'nres_vault') => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, type, filePath, name }: { id: string; type: 'folder' | 'file'; filePath?: string; name?: string }) => {
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
      return { id, type, name };
    },
    onSuccess: (result) => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['vault-folders', scope] });
        queryClient.invalidateQueries({ queryKey: ['vault-files', scope] });
      }, 0);
      if (user?.id) {
        queueMicrotask(() => {
          logVaultAction(user.id, { action: result.type === 'folder' ? 'delete_folder' : 'delete_file', target_type: result.type, target_id: result.id, target_name: result.name });
        });
      }
    },
    onError: (error: any) => {
      toast.error('Failed to delete', { description: error.message });
    },
  });
};

export const useRenameVaultItem = (scope: VaultScope = 'nres_vault') => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, type, newName }: { id: string; type: 'folder' | 'file'; newName: string }) => {
      if (type === 'folder') {
        const { error } = await supabase.from('shared_drive_folders').update({ name: newName }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shared_drive_files').update({ name: newName, original_name: newName }).eq('id', id);
        if (error) throw error;
      }
      return { id, type, newName };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vault-folders', scope] });
      queryClient.invalidateQueries({ queryKey: ['vault-files', scope] });
      if (user?.id) logVaultAction(user.id, { action: result.type === 'folder' ? 'rename_folder' : 'rename_file', target_type: result.type, target_id: result.id, target_name: result.newName });
    },
    onError: (error: any) => {
      toast.error('Failed to rename', { description: error.message });
    },
  });
};

export const useMoveVaultItem = (scope: VaultScope = 'nres_vault') => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, type, targetFolderId }: { id: string; type: 'folder' | 'file'; targetFolderId: string | null }) => {
      if (type === 'folder') {
        const { error } = await supabase.from('shared_drive_folders').update({ parent_id: targetFolderId }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shared_drive_files').update({ folder_id: targetFolderId }).eq('id', id);
        if (error) throw error;
      }
      return { id, type };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vault-folders', scope] });
      queryClient.invalidateQueries({ queryKey: ['vault-files', scope] });
      if (user?.id) logVaultAction(user.id, { action: result.type === 'folder' ? 'move_folder' : 'move_file', target_type: result.type, target_id: result.id });
    },
    onError: (error: any) => {
      toast.error('Failed to move', { description: error.message });
    },
  });
};

export const useCopyVaultFile = (scope: VaultScope = 'nres_vault') => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ fileId, targetFolderId }: { fileId: string; targetFolderId: string | null }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: original, error: fetchError } = await supabase
        .from('shared_drive_files')
        .select('*')
        .eq('id', fileId)
        .single();
      if (fetchError || !original) throw fetchError || new Error('File not found');

      const { data: blob, error: dlError } = await supabase.storage
        .from('shared-drive')
        .download(original.file_path);
      if (dlError) throw dlError;

      const timestamp = Date.now();
      const ext = original.name.split('.').pop();
      const newPath = `${storagePrefix(scope)}/${user.id}/${timestamp}.${ext}`;
      const { error: upError } = await supabase.storage
        .from('shared-drive')
        .upload(newPath, blob);
      if (upError) throw upError;

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
          scope,
        });
      if (insertError) throw insertError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vault-files', scope] });
      if (user?.id) logVaultAction(user.id, { action: 'copy_file', target_type: 'file', target_id: variables.fileId });
    },
    onError: (error: any) => {
      toast.error('Failed to copy file', { description: error.message });
    },
  });
};

export const useUpdateFileDescription = (scope: VaultScope = 'nres_vault') => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ fileId, description }: { fileId: string; description: string }) => {
      const { error } = await supabase
        .from('shared_drive_files')
        .update({ description: description || null, updated_at: new Date().toISOString() })
        .eq('id', fileId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vault-files', scope] });
      queryClient.invalidateQueries({ queryKey: ['vault-search', scope] });
      queryClient.invalidateQueries({ queryKey: ['all-vault-files', scope] });
      if (user?.id) logVaultAction(user.id, { action: 'edit_description', target_type: 'file', target_id: variables.fileId });
    },
    onError: (error: any) => {
      toast.error('Failed to update description', { description: error.message });
    },
  });
};

// ── V2 hooks ──────────────────────────────────────────────

export const useAllVaultFiles = (scope: VaultScope = 'nres_vault') => {
  return useQuery({
    queryKey: ['all-vault-files', scope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_drive_files')
        .select('id, name, original_name, folder_id, file_path, file_size, file_type, mime_type, created_by, created_at, updated_at, tags, description')
        .eq('scope', scope)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as VaultFile[];
    },
  });
};

export const useVaultFolderMap = (scope: VaultScope = 'nres_vault') => {
  return useQuery({
    queryKey: ['vault-folder-map', scope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_drive_folders')
        .select('id, name, path')
        .eq('scope', scope);
      if (error) throw error;
      const map: Record<string, { name: string; path: string }> = {};
      (data || []).forEach((f: any) => { map[f.id] = { name: f.name, path: f.path }; });
      return map;
    },
  });
};

export const useVaultFavourites = (scope: VaultScope = 'nres_vault') => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['vault-favourites', scope, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('vault_favourites')
        .select('file_id')
        .eq('user_id', user.id)
        .eq('scope', scope);
      if (error) throw error;
      return (data || []).map((r: any) => r.file_id as string);
    },
    enabled: !!user?.id,
  });
};

export const useToggleFavourite = (scope: VaultScope = 'nres_vault') => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ fileId, isFavourite }: { fileId: string; isFavourite: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (isFavourite) {
        const { error } = await supabase
          .from('vault_favourites')
          .delete()
          .eq('user_id', user.id)
          .eq('file_id', fileId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vault_favourites')
          .insert({ user_id: user.id, file_id: fileId, scope });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault-favourites', scope] });
    },
    onError: (error: any) => {
      toast.error('Failed to update favourite', { description: error.message });
    },
  });
};
