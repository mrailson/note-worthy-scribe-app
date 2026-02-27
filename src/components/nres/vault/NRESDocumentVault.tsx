import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderLock, LayoutGrid, List, GitBranch, Settings } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<VaultViewMode>('tree');
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

  const handleUploadFiles = useCallback(async (fileList: File[], targetFolderId?: string | null) => {
    const folderId = targetFolderId !== undefined ? targetFolderId : currentFolderId;
    try {
      await Promise.all(fileList.map((file) => uploadFile.mutateAsync({ file, folderId })));
      // Force immediate refetch after all uploads complete
      queryClient.invalidateQueries({ queryKey: ['nres-vault-files'] });
      queryClient.invalidateQueries({ queryKey: ['nres-vault-folders'] });
    } catch {
      // Individual errors already handled by mutation's onError
    }
  }, [uploadFile, currentFolderId, queryClient]);

  const handleDelete = useCallback(async (id: string, type: 'folder' | 'file', filePath?: string, name?: string) => {
    try {
      await deleteItem.mutateAsync({ id, type, filePath, name });
    } catch (error) {
      console.error('Delete failed:', error);
    }
  }, [deleteItem]);

  const handleManageAccess = useCallback((id: string, type: 'folder' | 'file', name: string) => {
    setPermissionTarget({ id, type, name });
  }, []);

  const handleCopy = useCallback((items: ClipboardState['items']) => {
    setClipboard({ items, operation: 'copy' });
    // toast removed
  }, []);

  const handleCut = useCallback((items: ClipboardState['items']) => {
    setClipboard({ items, operation: 'cut' });
    // toast removed
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
        // Folder copying not yet supported — silent
      }
    });

    if (clipboard.operation === 'cut') {
      setClipboard(null);
    }
  }, [clipboard, currentFolderId, moveItem, copyFile]);

  const handleRename = useCallback(async (id: string, type: 'folder' | 'file', newName: string) => {
    try {
      await renameItem.mutateAsync({ id, type, newName });
    } catch (error) {
      console.error('Rename failed:', error);
    }
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
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FolderLock className="h-5 w-5 shrink-0" />
              <span>Welcome to the Document Vault <span className="font-normal text-muted-foreground">— your secure, centralised store for practice documents and files.</span></span>
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
                      className="h-8 w-8 rounded-none border-x-0"
                      onClick={() => setViewMode('details')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Details</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8 rounded-l-none"
                      onClick={() => setViewMode('tree')}
                    >
                      <GitBranch className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Tree</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isSearching && currentFolderId === null && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs space-y-1.5">
                  <p className="font-medium text-foreground text-sm">What to store here</p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    <li>Policies, procedures &amp; protocols</li>
                    <li>Meeting agendas, minutes &amp; action logs</li>
                    <li>Training materials &amp; guides</li>
                    <li>Templates &amp; standard forms</li>
                    <li>Reports &amp; audits (anonymised/aggregated)</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs space-y-1.5">
                  <p className="font-medium text-foreground text-sm">Document hygiene tips</p>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    <li>Use clear naming (e.g. <span className="font-mono text-[10px]">NRES_Policy_InfectionControl_v1.2_Jan2026</span>)</li>
                    <li>Archive outdated versions rather than deleting</li>
                    <li>Finalise documents before uploading to shared folders</li>
                  </ul>
                  <p className="text-muted-foreground/80 italic pt-1">Access is role-based and audit-logged.</p>
                </div>
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs space-y-1.5">
                  <p className="font-medium text-destructive text-sm">Important notice</p>
                  <p className="text-destructive/90">This vault is for operational and governance documents. <span className="font-semibold">Do not upload patient identifiable information</span> — clinical records should remain in your clinical system (EMIS/TPP).</p>
                  <p className="text-muted-foreground/80 pt-1 border-t border-border/40">
                    {viewMode === 'tree' ? (
                      <>Use <span className="font-medium text-foreground">expand arrows</span> to browse, or right-click for options.</>
                    ) : (
                      <><span className="font-medium text-foreground">Double-click</span> folders to open. Use breadcrumbs to navigate back.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <VaultToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
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
            onCreateFolder={(name, parentId) => {
              try {
                createFolder.mutate({ name, parentId: parentId !== undefined ? parentId : currentFolderId });
              } catch (error) {
                console.error("Unexpected error during folder creation:", error);
              }
            }}
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
