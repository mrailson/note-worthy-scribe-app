import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderLock, LayoutGrid, List, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { VaultToolbar } from './VaultToolbar';
import { VaultContentView, ClipboardState, VaultViewMode } from './VaultContentView';
import { VaultBreadcrumbs } from './VaultBreadcrumbs';
import { VaultPermissionManager } from './VaultPermissionManager';
import { VaultSettingsModal } from './VaultSettingsModal';
import {
  useVaultFolders,
  useVaultFiles,
  useVaultBreadcrumbs,
  useVaultSearch,
  useCreateVaultFolder,
  useUploadVaultFile,
  useDeleteVaultItem,
  useRenameVaultItem,
  useMoveVaultItem,
  useCopyVaultFile,
} from '@/hooks/useNRESVaultData';
import { useVaultPermission, useIsVaultAdmin, canUpload, canDelete, canManageAccess } from '@/hooks/useNRESVaultPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const NRESDocumentVault = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [permissionTarget, setPermissionTarget] = useState<{
    id: string;
    type: 'folder' | 'file';
    name: string;
  } | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [viewMode, setViewMode] = useState<VaultViewMode>('details');
  const [settingsOpen, setSettingsOpen] = useState(false);

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
  const renameItem = useRenameVaultItem();
  const moveItem = useMoveVaultItem();
  const copyFile = useCopyVaultFile();

  const handleNavigate = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearchQuery('');
  }, []);

  const handleUploadFiles = useCallback((fileList: File[]) => {
    fileList.forEach((file) => {
      uploadFile.mutate({ file, folderId: currentFolderId });
    });
  }, [uploadFile, currentFolderId]);

  const handleDelete = useCallback((id: string, type: 'folder' | 'file', filePath?: string, name?: string) => {
    deleteItem.mutate({ id, type, filePath, name });
  }, [deleteItem]);

  const handleManageAccess = useCallback((id: string, type: 'folder' | 'file', name: string) => {
    setPermissionTarget({ id, type, name });
  }, []);

  const handleCopy = useCallback((items: ClipboardState['items']) => {
    setClipboard({ items, operation: 'copy' });
    toast.success(`${items.length} item${items.length > 1 ? 's' : ''} copied`);
  }, []);

  const handleCut = useCallback((items: ClipboardState['items']) => {
    setClipboard({ items, operation: 'cut' });
    toast.success(`${items.length} item${items.length > 1 ? 's' : ''} cut`);
  }, []);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;

    clipboard.items.forEach((item) => {
      if (clipboard.operation === 'cut') {
        moveItem.mutate({ id: item.id, type: item.type, targetFolderId: currentFolderId });
      } else if (item.type === 'file') {
        copyFile.mutate({ fileId: item.id, targetFolderId: currentFolderId });
      } else {
        // Copying folders not supported yet - just inform the user
        toast.info('Folder copying is not yet supported');
      }
    });

    if (clipboard.operation === 'cut') {
      setClipboard(null);
    }
  }, [clipboard, currentFolderId, moveItem, copyFile]);

  const handleRename = useCallback((id: string, type: 'folder' | 'file', newName: string) => {
    renameItem.mutate({ id, type, newName });
  }, [renameItem]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['nres-vault-folders'] });
    queryClient.invalidateQueries({ queryKey: ['nres-vault-files'] });
  }, [queryClient]);

  // Determine what to show
  const isSearching = searchQuery.trim().length > 0;
  const displayFolders = isSearching ? (searchResults?.folders || []) : folders;
  const displayFiles = isSearching ? (searchResults?.files || []) : files;

  const currentFolderCreatedByUser = folders.length > 0 || !currentFolderId;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderLock className="h-5 w-5" />
              Document Vault Home
            </CardTitle>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vault Settings</TooltipContent>
                </Tooltip>
              )}
              <div className="flex items-center border rounded-md">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'icons' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8 rounded-r-none"
                      onClick={() => setViewMode('icons')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Icons</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'details' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8 rounded-l-none"
                      onClick={() => setViewMode('details')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Details</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <VaultToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {!isSearching && (
            <>
              <VaultBreadcrumbs items={breadcrumbs} onNavigate={handleNavigate} />
              {currentFolderId === null && (
                <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  <p>
                    Welcome to the Document Vault — your secure, centralised store for practice documents and files.
                    <span className="font-medium text-foreground"> Double-click</span> any folder to open it, just like Windows Explorer.
                    Use the breadcrumbs above to navigate back, or right-click items for more options.
                  </p>
                </div>
              )}
            </>
          )}

          {isSearching && (
            <p className="text-sm text-muted-foreground">
              Showing results for "{searchQuery}" — {displayFolders.length + displayFiles.length} items found
            </p>
          )}

          <VaultContentView
            folders={displayFolders}
            files={displayFiles}
            viewMode={viewMode}
            onNavigateToFolder={(id) => handleNavigate(id)}
            onNavigateUp={() => {
              // Find parent of current folder from breadcrumbs
              const parentCrumb = breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2] : null;
              handleNavigate(parentCrumb?.id ?? null);
            }}
            currentFolderId={currentFolderId}
            onDelete={handleDelete}
            onManageAccess={handleManageAccess}
            onCopy={handleCopy}
            onCut={handleCut}
            onPaste={handlePaste}
            onRename={handleRename}
            onCreateFolder={(name) => createFolder.mutate({ name, parentId: currentFolderId })}
            onUploadFiles={handleUploadFiles}
            onRefresh={handleRefresh}
            clipboard={clipboard}
            canDeleteItems={canDelete(currentPermission)}
            canManageAccessItems={canManageAccess(currentPermission, isAdmin, currentFolderCreatedByUser)}
            canUpload={canUpload(currentPermission)}
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

      <VaultSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};
