import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderLock } from 'lucide-react';
import { VaultToolbar } from './VaultToolbar';
import { VaultContentView } from './VaultContentView';
import { VaultBreadcrumbs } from './VaultBreadcrumbs';
import { VaultPermissionManager } from './VaultPermissionManager';
import {
  useVaultFolders,
  useVaultFiles,
  useVaultBreadcrumbs,
  useVaultSearch,
  useCreateVaultFolder,
  useUploadVaultFile,
  useDeleteVaultItem,
} from '@/hooks/useNRESVaultData';
import { useVaultPermission, useIsVaultAdmin, canUpload, canDelete, canManageAccess } from '@/hooks/useNRESVaultPermissions';
import { useAuth } from '@/contexts/AuthContext';

export const NRESDocumentVault = () => {
  const { user } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [permissionTarget, setPermissionTarget] = useState<{
    id: string;
    type: 'folder' | 'file';
    name: string;
  } | null>(null);

  // Data queries
  const { data: folders = [], isLoading: foldersLoading } = useVaultFolders(currentFolderId);
  const { data: files = [], isLoading: filesLoading } = useVaultFiles(currentFolderId);
  const { data: breadcrumbs = [] } = useVaultBreadcrumbs(currentFolderId);
  const { data: searchResults } = useVaultSearch(searchQuery);

  // Permission queries
  const { data: currentPermission = 'full_access' } = useVaultPermission(currentFolderId, 'folder');
  const { data: isAdmin = false } = useIsVaultAdmin();

  // Mutations
  const createFolder = useCreateVaultFolder();
  const uploadFile = useUploadVaultFile();
  const deleteItem = useDeleteVaultItem();

  const handleNavigate = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearchQuery('');
  }, []);

  const handleUploadFiles = useCallback((fileList: File[]) => {
    fileList.forEach((file) => {
      uploadFile.mutate({ file, folderId: currentFolderId });
    });
  }, [uploadFile, currentFolderId]);

  const handleDelete = useCallback((id: string, type: 'folder' | 'file', filePath?: string) => {
    deleteItem.mutate({ id, type, filePath });
  }, [deleteItem]);

  const handleManageAccess = useCallback((id: string, type: 'folder' | 'file', name: string) => {
    setPermissionTarget({ id, type, name });
  }, []);

  // Determine what to show
  const isSearching = searchQuery.trim().length > 0;
  const displayFolders = isSearching ? (searchResults?.folders || []) : folders;
  const displayFiles = isSearching ? (searchResults?.files || []) : files;

  // Check if current user created the current folder (for access management)
  const currentFolderCreatedByUser = folders.length > 0 || !currentFolderId; // simplified check

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderLock className="h-5 w-5" />
            Document Vault
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <VaultToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onCreateFolder={(name) => createFolder.mutate({ name, parentId: currentFolderId })}
            onUploadFiles={handleUploadFiles}
            canUpload={canUpload(currentPermission)}
            isCreating={createFolder.isPending}
            isUploading={uploadFile.isPending}
          />

          {!isSearching && (
            <VaultBreadcrumbs items={breadcrumbs} onNavigate={handleNavigate} />
          )}

          {isSearching && (
            <p className="text-sm text-muted-foreground">
              Showing results for "{searchQuery}" — {displayFolders.length + displayFiles.length} items found
            </p>
          )}

          <VaultContentView
            folders={displayFolders}
            files={displayFiles}
            onNavigateToFolder={(id) => handleNavigate(id)}
            onDelete={handleDelete}
            onManageAccess={handleManageAccess}
            canDeleteItems={canDelete(currentPermission)}
            canManageAccessItems={canManageAccess(currentPermission, isAdmin, currentFolderCreatedByUser)}
            isLoading={foldersLoading || filesLoading}
          />
        </CardContent>
      </Card>

      {permissionTarget && (
        <VaultPermissionManager
          open={!!permissionTarget}
          onOpenChange={(open) => !open && setPermissionTarget(null)}
          targetId={permissionTarget.id}
          targetType={permissionTarget.type}
          targetName={permissionTarget.name}
        />
      )}
    </>
  );
};
