import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FolderLock, LayoutGrid, List, GitBranch, Settings, Search, X, ChevronDown, ChevronUp, Info, Lightbulb, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { VaultToolbar } from '@/components/nres/vault/VaultToolbar';
import { VaultContentView, ClipboardState, VaultViewMode } from '@/components/nres/vault/VaultContentView';
import { VaultBreadcrumbs } from '@/components/nres/vault/VaultBreadcrumbs';
import { VaultPermissionManager } from '@/components/nres/vault/VaultPermissionManager';
import { VaultSettingsModal } from '@/components/nres/vault/VaultSettingsModal';
import { VaultDocumentTable } from './VaultDocumentTable';
import { VaultFileTypeFilter, type FileTypeFilterValue } from './VaultFileTypeFilter';
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
  useAllVaultFiles,
  useVaultFolderMap,
  useVaultFavourites,
  useToggleFavourite,
  type VaultFile,
} from '@/hooks/useNRESVaultData';
import { useVaultPermission, useIsVaultAdmin, canUpload, canDelete, canManageAccess } from '@/hooks/useNRESVaultPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const SCOPE = 'enn_vault' as const;

// Columns for each tab
const LATEST_EDITS_COLS = [
  { key: 'name', label: 'Document' },
  { key: 'type', label: 'Type' },
  { key: 'edited_by', label: 'Edited by' },
  { key: 'when', label: 'When' },
  { key: 'star', label: '' },
];
const NEW_UPLOADS_COLS = [
  { key: 'name', label: 'Document' },
  { key: 'type', label: 'Type' },
  { key: 'uploaded_by', label: 'Uploaded by' },
  { key: 'uploaded_date', label: 'Uploaded' },
  { key: 'star', label: '' },
];
const MY_DOCS_COLS = [
  { key: 'name', label: 'Document' },
  { key: 'type', label: 'Type' },
  { key: 'uploaded_date', label: 'Uploaded' },
  { key: 'last_edited', label: 'Last edited' },
  { key: 'star', label: '' },
];
const FAVOURITES_COLS = [
  { key: 'name', label: 'Document' },
  { key: 'type', label: 'Type' },
  { key: 'location', label: 'Location' },
  { key: 'last_edited', label: 'Last edited' },
  { key: 'star', label: '' },
];
const ALL_DOCS_COLS = [
  { key: 'name', label: 'Document' },
  { key: 'type', label: 'Type' },
  { key: 'location', label: 'Location' },
  { key: 'edited_by', label: 'Edited by' },
  { key: 'last_edited', label: 'Last edited' },
  { key: 'star', label: '' },
];

function filterByType(files: VaultFile[], filter: FileTypeFilterValue) {
  if (filter === 'all') return files;
  return files.filter((f) => {
    const t = f.file_type?.toLowerCase();
    if (filter === 'docx') return t === 'doc' || t === 'docx';
    if (filter === 'xlsx') return t === 'xls' || t === 'xlsx' || t === 'csv';
    return t === filter;
  });
}

export const ENNDocumentVaultV2 = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('folders');

  // Folders tab state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cardsCollapsed, setCardsCollapsed] = useState(false);
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [permissionTarget, setPermissionTarget] = useState<{ id: string; type: 'folder' | 'file'; name: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // V2 tab state
  const [typeFilter, setTypeFilter] = useState<FileTypeFilterValue>('all');
  const [tabSearch, setTabSearch] = useState('');

  // Data queries
  const { data: folders = [], isLoading: foldersLoading } = useVaultFolders(currentFolderId, SCOPE);
  const { data: files = [], isLoading: filesLoading } = useVaultFiles(currentFolderId, SCOPE);
  const { data: breadcrumbs = [] } = useVaultBreadcrumbs(currentFolderId, SCOPE);
  const { data: searchResults } = useVaultSearch(searchQuery, SCOPE);
  const { data: allFiles = [] } = useAllVaultFiles(SCOPE);
  const { data: folderMap = {} } = useVaultFolderMap(SCOPE);
  const { data: favouriteIds = [] } = useVaultFavourites(SCOPE);

  // Permissions
  const { data: currentPermission = 'full_access' } = useVaultPermission(currentFolderId, 'folder');
  const { data: isAdmin = false } = useIsVaultAdmin();

  // Mutations
  const createFolder = useCreateVaultFolder(SCOPE);
  const uploadFile = useUploadVaultFile(SCOPE);
  const deleteItem = useDeleteVaultItem(SCOPE);
  const renameItem = useRenameVaultItem(SCOPE);
  const moveItem = useMoveVaultItem(SCOPE);
  const copyFile = useCopyVaultFile(SCOPE);
  const toggleFav = useToggleFavourite(SCOPE);

  // Derived file lists
  const latestEdits = useMemo(() => {
    const sorted = [...allFiles].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    let filtered = filterByType(sorted, typeFilter);
    if (tabSearch) filtered = filtered.filter((f) => f.name.toLowerCase().includes(tabSearch.toLowerCase()));
    return filtered;
  }, [allFiles, typeFilter, tabSearch]);

  const newUploads = useMemo(() => {
    const sorted = [...allFiles].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    let filtered = filterByType(sorted, typeFilter);
    if (tabSearch) filtered = filtered.filter((f) => f.name.toLowerCase().includes(tabSearch.toLowerCase()));
    return filtered;
  }, [allFiles, typeFilter, tabSearch]);

  const myDocuments = useMemo(() => {
    if (!user?.id) return [];
    let filtered = allFiles.filter((f) => f.created_by === user.id);
    filtered = filterByType(filtered, typeFilter);
    if (tabSearch) filtered = filtered.filter((f) => f.name.toLowerCase().includes(tabSearch.toLowerCase()));
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allFiles, user?.id, typeFilter, tabSearch]);

  const favouriteFiles = useMemo(() => {
    let filtered = allFiles.filter((f) => favouriteIds.includes(f.id));
    filtered = filterByType(filtered, typeFilter);
    if (tabSearch) filtered = filtered.filter((f) => f.name.toLowerCase().includes(tabSearch.toLowerCase()));
    return filtered;
  }, [allFiles, favouriteIds, typeFilter, tabSearch]);

  const allDocsSorted = useMemo(() => {
    let filtered = filterByType(allFiles, typeFilter);
    if (tabSearch) filtered = filtered.filter((f) => f.name.toLowerCase().includes(tabSearch.toLowerCase()));
    return filtered;
  }, [allFiles, typeFilter, tabSearch]);

  const handleToggleFavourite = useCallback((fileId: string, isFav: boolean) => {
    toggleFav.mutate({ fileId, isFavourite: isFav });
  }, [toggleFav]);

  // Folder navigation handlers
  const handleNavigate = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearchQuery('');
  }, []);

  const handleUploadFiles = useCallback(async (fileList: File[], targetFolderId?: string | null) => {
    const folderId = targetFolderId !== undefined ? targetFolderId : currentFolderId;
    try {
      await Promise.all(fileList.map((file) => uploadFile.mutateAsync({ file, folderId })));
      queryClient.invalidateQueries({ queryKey: ['vault-files', SCOPE] });
      queryClient.invalidateQueries({ queryKey: ['all-vault-files', SCOPE] });
    } catch { /* handled by mutation */ }
  }, [uploadFile, currentFolderId, queryClient]);

  const handleDelete = useCallback(async (id: string, type: 'folder' | 'file', filePath?: string, name?: string) => {
    try {
      await deleteItem.mutateAsync({ id, type, filePath, name });
      queryClient.invalidateQueries({ queryKey: ['all-vault-files', SCOPE] });
    } catch (e) { console.error('Delete failed:', e); }
  }, [deleteItem, queryClient]);

  const handleRename = useCallback(async (id: string, type: 'folder' | 'file', newName: string) => {
    try {
      await renameItem.mutateAsync({ id, type, newName });
      queryClient.invalidateQueries({ queryKey: ['all-vault-files', SCOPE] });
    } catch (e) { console.error('Rename failed:', e); }
  }, [renameItem, queryClient]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['vault-folders', SCOPE] });
    queryClient.invalidateQueries({ queryKey: ['vault-files', SCOPE] });
    queryClient.invalidateQueries({ queryKey: ['all-vault-files', SCOPE] });
  }, [queryClient]);

  const handlePaste = useCallback(() => {
    if (!clipboard) return;
    clipboard.items.forEach((item) => {
      if (clipboard.operation === 'cut') {
        moveItem.mutate({ id: item.id, type: item.type, targetFolderId: currentFolderId });
      } else if (item.type === 'file') {
        copyFile.mutate({ fileId: item.id, targetFolderId: currentFolderId });
      }
    });
    if (clipboard.operation === 'cut') setClipboard(null);
  }, [clipboard, currentFolderId, moveItem, copyFile]);

  const isSearching = searchQuery.trim().length > 0;
  const displayFolders = isSearching ? (searchResults?.folders || []) : folders;
  const displayFiles = isSearching ? (searchResults?.files || []) : files;

  // Search + filter bar for V2 tabs
  const renderTabToolbar = () => (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={tabSearch}
          onChange={(e) => setTabSearch(e.target.value)}
          className="pl-9 pr-8 h-9"
        />
        {tabSearch && (
          <button onClick={() => setTabSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <VaultFileTypeFilter value={typeFilter} onChange={setTypeFilter} />
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FolderLock className="h-5 w-5 shrink-0" />
            <span>ENN Document Vault <span className="font-normal text-muted-foreground">— your secure, centralised store for practice documents and files.</span></span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setTabSearch(''); setTypeFilter('all'); }}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="folders">Folders</TabsTrigger>
              <TabsTrigger value="latest">Latest edits</TabsTrigger>
              <TabsTrigger value="new">New uploads</TabsTrigger>
              <TabsTrigger value="mine">My documents</TabsTrigger>
              <TabsTrigger value="favourites">Favourites</TabsTrigger>
              <TabsTrigger value="all">All documents</TabsTrigger>
            </TabsList>

            {/* ── Folders tab (existing V1 view) ── */}
            <TabsContent value="folders" className="space-y-3 mt-3">
              {/* ── Collapsible info cards ── */}
              {currentFolderId === null && (
                <div className="space-y-2">
                  <button
                    onClick={() => setCardsCollapsed(!cardsCollapsed)}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {cardsCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                    {cardsCollapsed ? 'Show guidance' : 'Hide guidance'}
                  </button>
                  {!cardsCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 animate-in slide-in-from-top-2 duration-200">
                      <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs space-y-1.5">
                        <p className="font-medium text-foreground text-sm flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-primary" />What to store here</p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                          <li>Policies, procedures &amp; protocols</li>
                          <li>Meeting agendas, minutes &amp; action logs</li>
                          <li>Training materials &amp; guides</li>
                          <li>Templates &amp; standard forms</li>
                          <li>Reports &amp; audits (anonymised/aggregated)</li>
                        </ul>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-xs space-y-1.5">
                        <p className="font-medium text-foreground text-sm flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5 text-amber-500" />Document hygiene tips</p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                          <li>Use clear naming (e.g. <span className="font-mono text-[10px]">ENN_Policy_InfectionControl_v1.2_Jan2026</span>)</li>
                          <li>Archive outdated versions rather than deleting</li>
                          <li>Finalise documents before uploading to shared folders</li>
                        </ul>
                        <p className="text-muted-foreground/80 italic pt-1">Access is role-based and audit-logged.</p>
                      </div>
                      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs space-y-1.5">
                        <p className="font-medium text-destructive text-sm flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" />Important notice</p>
                        <p className="text-destructive/90">This vault is for operational and governance documents. <span className="font-semibold">Do not upload patient identifiable information</span> — clinical records should remain in your clinical system (EMIS/TPP).</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Modern toolbar with integrated view/settings ── */}
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex-1">
                  <VaultToolbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
                </div>
                <div className="h-5 w-px bg-border/60" />
                <div className="flex items-center gap-0.5 bg-background rounded-md border border-border/60 p-0.5">
                  <Tooltip><TooltipTrigger asChild><Button variant={viewMode === 'icons' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('icons')}><LayoutGrid className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Icons</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant={viewMode === 'details' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('details')}><List className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Details</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant={viewMode === 'tree' ? 'default' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('tree')}><GitBranch className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Tree</TooltipContent></Tooltip>
                </div>
                {isAdmin && (
                  <>
                    <div className="h-5 w-px bg-border/60" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSettingsOpen(true)}>
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Vault Settings</TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>

              {!isSearching && <VaultBreadcrumbs items={breadcrumbs} onNavigate={handleNavigate} />}

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
                  const parentCrumb = breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2] : null;
                  handleNavigate(parentCrumb?.id ?? null);
                }}
                currentFolderId={currentFolderId}
                onDelete={handleDelete}
                onManageAccess={(id, type, name) => setPermissionTarget({ id, type, name })}
                onCopy={(items) => setClipboard({ items, operation: 'copy' })}
                onCut={(items) => setClipboard({ items, operation: 'cut' })}
                onPaste={handlePaste}
                onRename={handleRename}
                onCreateFolder={(name, parentId) => createFolder.mutate({ name, parentId: parentId !== undefined ? parentId : currentFolderId })}
                onUploadFiles={handleUploadFiles}
                onRefresh={handleRefresh}
                clipboard={clipboard}
                canDeleteItems={canDelete(currentPermission)}
                canManageAccessItems={canManageAccess(currentPermission, isAdmin, true)}
                canUpload={canUpload(currentPermission)}
                isLoading={foldersLoading || filesLoading}
              />
            </TabsContent>

            {/* ── Latest edits ── */}
            <TabsContent value="latest" className="space-y-3 mt-3">
              {renderTabToolbar()}
              <VaultDocumentTable
                files={latestEdits}
                columns={LATEST_EDITS_COLS}
                favouriteIds={favouriteIds}
                onToggleFavourite={handleToggleFavourite}
                folderMap={folderMap}
                showGroupHeaders
                groupByKey="updated_at"
                emptyMessage="No recently edited documents"
              />
            </TabsContent>

            {/* ── New uploads ── */}
            <TabsContent value="new" className="space-y-3 mt-3">
              {renderTabToolbar()}
              <VaultDocumentTable
                files={newUploads}
                columns={NEW_UPLOADS_COLS}
                favouriteIds={favouriteIds}
                onToggleFavourite={handleToggleFavourite}
                folderMap={folderMap}
                showGroupHeaders
                groupByKey="created_at"
                emptyMessage="No new uploads"
              />
            </TabsContent>

            {/* ── My documents ── */}
            <TabsContent value="mine" className="space-y-3 mt-3">
              {renderTabToolbar()}
              <VaultDocumentTable
                files={myDocuments}
                columns={MY_DOCS_COLS}
                favouriteIds={favouriteIds}
                onToggleFavourite={handleToggleFavourite}
                folderMap={folderMap}
                emptyMessage="You haven't uploaded any documents yet"
              />
            </TabsContent>

            {/* ── Favourites ── */}
            <TabsContent value="favourites" className="space-y-3 mt-3">
              {renderTabToolbar()}
              <VaultDocumentTable
                files={favouriteFiles}
                columns={FAVOURITES_COLS}
                favouriteIds={favouriteIds}
                onToggleFavourite={handleToggleFavourite}
                folderMap={folderMap}
                emptyMessage="No favourite documents — click the star on any document to add it here"
              />
            </TabsContent>

            {/* ── All documents ── */}
            <TabsContent value="all" className="space-y-3 mt-3">
              {renderTabToolbar()}
              <VaultDocumentTable
                files={allDocsSorted}
                columns={ALL_DOCS_COLS}
                favouriteIds={favouriteIds}
                onToggleFavourite={handleToggleFavourite}
                folderMap={folderMap}
                emptyMessage="No documents in the vault yet"
              />
            </TabsContent>
          </Tabs>
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
