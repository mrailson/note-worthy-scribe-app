import { useState, useCallback, useRef } from 'react';
import { Folder, FileText, FileImage, FileSpreadsheet, File, Download, Trash2, Shield, Copy, Scissors, ClipboardPaste, FolderPlus, Upload, RefreshCw, PencilLine, FolderOpen } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VaultFolder, VaultFile } from '@/hooks/useNRESVaultData';

export interface ClipboardState {
  items: Array<{ id: string; type: 'folder' | 'file'; name: string; filePath?: string }>;
  operation: 'copy' | 'cut';
}

interface VaultContentViewProps {
  folders: VaultFolder[];
  files: VaultFile[];
  onNavigateToFolder: (folderId: string) => void;
  onDelete: (id: string, type: 'folder' | 'file', filePath?: string) => void;
  onManageAccess: (id: string, type: 'folder' | 'file', name: string) => void;
  onCopy: (items: ClipboardState['items']) => void;
  onCut: (items: ClipboardState['items']) => void;
  onPaste: () => void;
  onRename: (id: string, type: 'folder' | 'file', newName: string) => void;
  onCreateFolder: (name: string) => void;
  onUploadFiles: (files: File[]) => void;
  onRefresh: () => void;
  clipboard: ClipboardState | null;
  canDeleteItems: boolean;
  canManageAccessItems: boolean;
  canUpload: boolean;
  isLoading: boolean;
}

const getFileIcon = (fileType: string | null) => {
  const type = (fileType || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(type)) return FileImage;
  if (['xls', 'xlsx', 'csv'].includes(type)) return FileSpreadsheet;
  if (['doc', 'docx', 'pdf', 'txt', 'rtf'].includes(type)) return FileText;
  return File;
};

const getFileIconColour = (fileType: string | null) => {
  const type = (fileType || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(type)) return 'text-green-500';
  if (['xls', 'xlsx', 'csv'].includes(type)) return 'text-emerald-600';
  if (['pdf'].includes(type)) return 'text-red-500';
  if (['doc', 'docx'].includes(type)) return 'text-blue-600';
  return 'text-muted-foreground';
};

export const VaultContentView = ({
  folders,
  files,
  onNavigateToFolder,
  onDelete,
  onManageAccess,
  onCopy,
  onCut,
  onPaste,
  onRename,
  onCreateFolder,
  onUploadFiles,
  onRefresh,
  clipboard,
  canDeleteItems,
  canManageAccessItems,
  canUpload,
  isLoading,
}: VaultContentViewProps) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string; type: 'folder' | 'file'; name: string; filePath?: string;
  } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{
    id: string; type: 'folder' | 'file'; currentName: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCutItem = (id: string) => clipboard?.operation === 'cut' && clipboard.items.some(i => i.id === id);

  const handleSelect = useCallback((id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedItems(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedItems(new Set([id]));
    }
  }, []);

  const handleDoubleClickFolder = useCallback((folderId: string) => {
    setSelectedItems(new Set());
    onNavigateToFolder(folderId);
  }, [onNavigateToFolder]);

  const handleDownload = async (file: VaultFile) => {
    try {
      const { data, error } = await supabase.storage.from('shared-drive').download(file.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name || file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Download failed', { description: err.message });
    }
  };

  const handleRenameSubmit = () => {
    if (renameTarget && renameValue.trim()) {
      onRename(renameTarget.id, renameTarget.type, renameValue.trim());
      setRenameTarget(null);
    }
  };

  const handleCreateFolderSubmit = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setFolderDialogOpen(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length > 0) onUploadFiles(fileList);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearSelection = useCallback(() => setSelectedItems(new Set()), []);

  const totalItems = folders.length + files.length;
  const selectedCount = selectedItems.size;

  // Build selected items for clipboard
  const getSelectedClipboardItems = useCallback(() => {
    const items: ClipboardState['items'] = [];
    folders.forEach(f => { if (selectedItems.has(f.id)) items.push({ id: f.id, type: 'folder', name: f.name }); });
    files.forEach(f => { if (selectedItems.has(f.id)) items.push({ id: f.id, type: 'file', name: f.original_name || f.name, filePath: f.file_path }); });
    return items;
  }, [selectedItems, folders, files]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading...
      </div>
    );
  }

  const renderItemContextMenu = (
    id: string,
    type: 'folder' | 'file',
    name: string,
    filePath?: string,
    file?: VaultFile
  ) => (
    <ContextMenuContent>
      {type === 'folder' ? (
        <ContextMenuItem onClick={() => handleDoubleClickFolder(id)}>
          <FolderOpen className="h-4 w-4 mr-2" />Open
        </ContextMenuItem>
      ) : file ? (
        <ContextMenuItem onClick={() => handleDownload(file)}>
          <Download className="h-4 w-4 mr-2" />Download
        </ContextMenuItem>
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => {
        const items = selectedItems.has(id) && selectedItems.size > 1
          ? getSelectedClipboardItems()
          : [{ id, type, name, filePath }];
        onCopy(items);
      }}>
        <Copy className="h-4 w-4 mr-2" />Copy
      </ContextMenuItem>
      <ContextMenuItem onClick={() => {
        const items = selectedItems.has(id) && selectedItems.size > 1
          ? getSelectedClipboardItems()
          : [{ id, type, name, filePath }];
        onCut(items);
      }}>
        <Scissors className="h-4 w-4 mr-2" />Cut
      </ContextMenuItem>
      <ContextMenuItem onClick={() => { setRenameTarget({ id, type, currentName: name }); setRenameValue(name); }}>
        <PencilLine className="h-4 w-4 mr-2" />Rename
      </ContextMenuItem>
      {canManageAccessItems && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onManageAccess(id, type, name)}>
            <Shield className="h-4 w-4 mr-2" />Manage Access
          </ContextMenuItem>
        </>
      )}
      {canDeleteItems && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget({ id, type, name, filePath })}>
            <Trash2 className="h-4 w-4 mr-2" />Delete
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );

  return (
    <>
      {/* Empty space context menu wraps the grid area */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="min-h-[200px] rounded-lg border bg-background p-3 select-none"
            onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
          >
            {totalItems === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Folder className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">This folder is empty</p>
                <p className="text-xs mt-1">Right-click to create a folder or upload files</p>
              </div>
            ) : (
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
                {folders.map(folder => (
                  <ContextMenu key={folder.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        className={`flex flex-col items-center gap-1 p-2 rounded cursor-pointer transition-colors
                          ${selectedItems.has(folder.id) ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-muted/60'}
                          ${isCutItem(folder.id) ? 'opacity-40' : ''}`}
                        onClick={(e) => { e.stopPropagation(); handleSelect(folder.id, e); }}
                        onDoubleClick={() => handleDoubleClickFolder(folder.id)}
                      >
                        <Folder className="h-10 w-10 text-amber-500 shrink-0" fill="currentColor" strokeWidth={1} />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-center leading-tight truncate w-full">{folder.name}</span>
                          </TooltipTrigger>
                          <TooltipContent>{folder.name}</TooltipContent>
                        </Tooltip>
                      </div>
                    </ContextMenuTrigger>
                    {renderItemContextMenu(folder.id, 'folder', folder.name)}
                  </ContextMenu>
                ))}

                {files.map(file => {
                  const IconComp = getFileIcon(file.file_type);
                  const iconColour = getFileIconColour(file.file_type);
                  const displayName = file.original_name || file.name;
                  return (
                    <ContextMenu key={file.id}>
                      <ContextMenuTrigger asChild>
                        <div
                          className={`flex flex-col items-center gap-1 p-2 rounded cursor-pointer transition-colors
                            ${selectedItems.has(file.id) ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-muted/60'}
                            ${isCutItem(file.id) ? 'opacity-40' : ''}`}
                          onClick={(e) => { e.stopPropagation(); handleSelect(file.id, e); }}
                          onDoubleClick={() => handleDownload(file)}
                        >
                          <IconComp className={`h-10 w-10 shrink-0 ${iconColour}`} strokeWidth={1} />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-center leading-tight truncate w-full">{displayName}</span>
                            </TooltipTrigger>
                            <TooltipContent>{displayName}</TooltipContent>
                          </Tooltip>
                        </div>
                      </ContextMenuTrigger>
                      {renderItemContextMenu(file.id, 'file', displayName, file.file_path, file)}
                    </ContextMenu>
                  );
                })}
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        {/* Empty-space context menu */}
        <ContextMenuContent>
          {canUpload && (
            <>
              <ContextMenuItem onClick={() => setFolderDialogOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />New Folder
              </ContextMenuItem>
              <ContextMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />Upload Files
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem onClick={onPaste} disabled={!clipboard}>
            <ClipboardPaste className="h-4 w-4 mr-2" />Paste
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Status bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pt-1">
        <span>{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
        {selectedCount > 0 && <span>{selectedCount} selected</span>}
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="rename-input">New name</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRenameSubmit} disabled={!renameValue.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="new-folder-name">Folder Name</Label>
            <Input
              id="new-folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter folder name"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolderSubmit()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateFolderSubmit} disabled={!newFolderName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'folder' ? 'Folder' : 'File'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"?
              {deleteTarget?.type === 'folder' && ' This will also delete all contents within it.'}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget.id, deleteTarget.type, deleteTarget.filePath);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
