import { useState, useCallback, useRef, useMemo } from 'react';
import { Folder, FileText, FileImage, FileSpreadsheet, File, Download, Trash2, Shield, Copy, Scissors, ClipboardPaste, FolderPlus, Upload, RefreshCw, PencilLine, FolderOpen, ChevronDown, ArrowUp } from 'lucide-react';
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
import { format, isToday, isYesterday, startOfDay } from 'date-fns';

export type VaultViewMode = 'icons' | 'details';

export interface ClipboardState {
  items: Array<{ id: string; type: 'folder' | 'file'; name: string; filePath?: string }>;
  operation: 'copy' | 'cut';
}

interface VaultContentViewProps {
  folders: VaultFolder[];
  files: VaultFile[];
  viewMode: VaultViewMode;
  onNavigateToFolder: (folderId: string) => void;
  onNavigateUp: () => void;
  currentFolderId: string | null;
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

const getFileTypeName = (fileType: string | null, mimeType: string | null): string => {
  const type = (fileType || '').toLowerCase();
  if (['doc', 'docx'].includes(type)) return 'Microsoft Word D…';
  if (['xls', 'xlsx'].includes(type)) return 'Microsoft Excel S…';
  if (['ppt', 'pptx'].includes(type)) return 'Microsoft PowerP…';
  if (['pdf'].includes(type)) return 'PDF File';
  if (['png'].includes(type)) return 'PNG File';
  if (['jpg', 'jpeg'].includes(type)) return 'JPEG Image';
  if (['gif'].includes(type)) return 'GIF Image';
  if (['svg'].includes(type)) return 'SVG Image';
  if (['txt'].includes(type)) return 'Text File';
  if (['csv'].includes(type)) return 'CSV File';
  if (['zip'].includes(type)) return 'ZIP Archive';
  if (type) return `${type.toUpperCase()} File`;
  return 'File';
};

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getDateGroupLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd/MM/yyyy');
};

interface UnifiedItem {
  id: string;
  type: 'folder' | 'file';
  name: string;
  date: string;
  fileType: string | null;
  mimeType: string | null;
  fileSize: number | null;
  filePath?: string;
  folder?: VaultFolder;
  file?: VaultFile;
}

export const VaultContentView = ({
  folders,
  files,
  viewMode,
  onNavigateToFolder,
  onNavigateUp,
  currentFolderId,
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

  const getSelectedClipboardItems = useCallback(() => {
    const items: ClipboardState['items'] = [];
    folders.forEach(f => { if (selectedItems.has(f.id)) items.push({ id: f.id, type: 'folder', name: f.name }); });
    files.forEach(f => { if (selectedItems.has(f.id)) items.push({ id: f.id, type: 'file', name: f.original_name || f.name, filePath: f.file_path }); });
    return items;
  }, [selectedItems, folders, files]);

  // Build grouped items for details view
  const groupedItems = useMemo(() => {
    const allItems: UnifiedItem[] = [
      ...folders.map(f => ({
        id: f.id, type: 'folder' as const, name: f.name,
        date: f.updated_at, fileType: null, mimeType: null, fileSize: null, folder: f,
      })),
      ...files.map(f => ({
        id: f.id, type: 'file' as const, name: f.original_name || f.name,
        date: f.updated_at, fileType: f.file_type, mimeType: f.mime_type,
        fileSize: f.file_size, filePath: f.file_path, file: f,
      })),
    ];
    // Sort by date descending
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Group by date label
    const groups: Array<{ label: string; items: UnifiedItem[] }> = [];
    let currentLabel = '';
    allItems.forEach(item => {
      const label = getDateGroupLabel(item.date);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1].items.push(item);
    });
    return groups;
  }, [folders, files]);

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

  const emptySpaceContextMenu = (
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
  );

  const renderDetailsRow = (item: UnifiedItem) => {
    const IconComp = item.type === 'folder' ? Folder : getFileIcon(item.fileType);
    const iconColour = item.type === 'folder' ? 'text-amber-500' : getFileIconColour(item.fileType);
    const isSelected = selectedItems.has(item.id);
    const isCut = isCutItem(item.id);

    return (
      <ContextMenu key={item.id}>
        <ContextMenuTrigger asChild>
          <tr
            className={`border-b border-border/40 cursor-pointer transition-colors text-sm
              ${isSelected ? 'bg-primary/15' : 'hover:bg-muted/40'}
              ${isCut ? 'opacity-40' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleSelect(item.id, e); }}
            onDoubleClick={() => {
              if (item.type === 'folder') handleDoubleClickFolder(item.id);
              else if (item.file) handleDownload(item.file);
            }}
          >
            <td className="py-1.5 px-2">
              <div className="flex items-center gap-2 min-w-0">
                <IconComp
                  className={`h-4 w-4 shrink-0 ${iconColour}`}
                  {...(item.type === 'folder' ? { fill: 'currentColor', strokeWidth: 1 } : { strokeWidth: 1.5 })}
                />
                <span className="truncate">{item.name}</span>
              </div>
            </td>
            <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap hidden sm:table-cell">
              {format(new Date(item.date), 'dd/MM/yyyy HH:mm')}
            </td>
            <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap hidden md:table-cell">
              {item.type === 'folder' ? 'File folder' : getFileTypeName(item.fileType, item.mimeType)}
            </td>
            <td className="py-1.5 px-2 text-muted-foreground text-right whitespace-nowrap hidden sm:table-cell">
              {item.type === 'file' ? formatFileSize(item.fileSize) : ''}
            </td>
          </tr>
        </ContextMenuTrigger>
        {renderItemContextMenu(item.id, item.type, item.name, item.filePath, item.file)}
      </ContextMenu>
    );
  };

  const renderDetailsView = () => (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b-2 border-border/60">
          <th className="text-left py-1.5 px-2 font-medium text-foreground">Name</th>
          <th className="text-left py-1.5 px-2 font-medium text-foreground whitespace-nowrap hidden sm:table-cell">Date modified</th>
          <th className="text-left py-1.5 px-2 font-medium text-foreground whitespace-nowrap hidden md:table-cell">Type</th>
          <th className="text-right py-1.5 px-2 font-medium text-foreground hidden sm:table-cell">Size</th>
        </tr>
      </thead>
      <tbody>
        {currentFolderId && (
          <tr
            className="border-b border-border/40 cursor-pointer hover:bg-muted/40 text-sm"
            onDoubleClick={onNavigateUp}
            onClick={onNavigateUp}
          >
            <td className="py-1.5 px-2">
              <div className="flex items-center gap-2">
                <ArrowUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">..</span>
              </div>
            </td>
            <td className="py-1.5 px-2 hidden sm:table-cell" />
            <td className="py-1.5 px-2 hidden md:table-cell" />
            <td className="py-1.5 px-2 hidden sm:table-cell" />
          </tr>
        )}
        {groupedItems.map(group => (
          <>
            <tr key={`group-${group.label}`}>
              <td colSpan={4} className="pt-3 pb-1 px-2">
                <div className="flex items-center gap-1.5">
                  <ChevronDown className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">{group.label}</span>
                </div>
              </td>
            </tr>
            {group.items.map(renderDetailsRow)}
          </>
        ))}
      </tbody>
    </table>
  );

  const renderIconsView = () => (
    <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }}>
      {currentFolderId && (
        <div
          className="flex flex-col items-center gap-1 p-2 rounded cursor-pointer transition-colors hover:bg-muted/60"
          onClick={onNavigateUp}
          onDoubleClick={onNavigateUp}
        >
          <ArrowUp className="h-10 w-10 text-muted-foreground shrink-0" strokeWidth={1} />
          <span className="text-xs text-center text-muted-foreground">..</span>
        </div>
      )}
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
  );

  return (
    <>
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
            ) : viewMode === 'details' ? (
              renderDetailsView()
            ) : (
              renderIconsView()
            )}
          </div>
        </ContextMenuTrigger>
        {emptySpaceContextMenu}
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
