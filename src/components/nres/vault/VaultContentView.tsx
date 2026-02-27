import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
// eslint-disable-next-line -- TriangleAlert replaces deprecated AlertTriangle
import { Folder, FileText, FileImage, FileSpreadsheet, File, Download, Trash2, Shield, Copy, Scissors, ClipboardPaste, FolderPlus, Upload, RefreshCw, PencilLine, FolderOpen, ChevronDown, ChevronRight, ArrowUp, MoreVertical, Info, TriangleAlert, Mail } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VaultFolder, VaultFile } from '@/hooks/useNRESVaultData';
import { useUpdateFileDescription, useReplaceVaultFile } from '@/hooks/useNRESVaultData';
import { logVaultAction } from '@/hooks/useNRESVaultAudit';
import { useAuth } from '@/contexts/AuthContext';
import { format, isToday, isYesterday, startOfDay } from 'date-fns';

export type VaultViewMode = 'icons' | 'details' | 'tree';

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
  onDelete: (id: string, type: 'folder' | 'file', filePath?: string, name?: string) => void;
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
  const { user } = useAuth();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string; type: 'folder' | 'file'; name: string; filePath?: string;
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [renameTarget, setRenameTarget] = useState<{
    id: string; type: 'folder' | 'file'; currentName: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [descriptionTarget, setDescriptionTarget] = useState<{ id: string; name: string; currentDescription: string } | null>(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // Tree view state (must be before any early returns)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [treeChildren, setTreeChildren] = useState<Record<string, { folders: VaultFolder[]; files: VaultFile[] }>>({});

  useEffect(() => {
    if (viewMode === 'tree') {
      const rootKey = currentFolderId || '__root__';
      setTreeChildren(prev => ({
        ...prev,
        [rootKey]: { folders, files },
      }));
    }
  }, [viewMode, folders, files, currentFolderId]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (!canUpload) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) onUploadFiles(droppedFiles);
  }, [canUpload, onUploadFiles]);

  const handlePasteFiles = useCallback((e: React.ClipboardEvent) => {
    if (!canUpload) return;
    const pastedFiles = Array.from(e.clipboardData.files);
    if (pastedFiles.length > 0) {
      e.preventDefault();
      onUploadFiles(pastedFiles);
    }
  }, [canUpload, onUploadFiles]);
  const [replaceTarget, setReplaceTarget] = useState<{ id: string; filePath: string } | null>(null);
  const updateDescription = useUpdateFileDescription();
  const replaceFile = useReplaceVaultFile();

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
      const { data, error } = await supabase.storage
        .from('shared-drive')
        .download(file.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name || file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (user?.id) logVaultAction(user.id, { action: 'download_file', target_type: 'file', target_id: file.id, target_name: file.name });
    } catch (err: any) {
      toast.error('Download failed', { description: err.message });
    }
  };

  const handleEmailToMe = async (file: VaultFile) => {
    try {
      if (!user?.email) {
        toast.error('Unable to send email', { description: 'No email address found for your account.' });
        return;
      }
      // Download the file as blob
      const { data: blob, error: dlError } = await supabase.storage
        .from('shared-drive')
        .download(file.file_path);
      if (dlError) throw dlError;

      // Convert to base64
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const chunkSize = 8192;
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64 = btoa(binary);

      const fileName = file.original_name || file.name;

      const { error } = await supabase.functions.invoke('send-email-resend', {
        body: {
          to_email: user.email,
          subject: `Document Vault: ${fileName}`,
          html_content: `<p>Hi,</p><p>Please find the attached file <strong>${fileName}</strong> from the NRES Document Vault.</p><p>Kind regards,<br/>Notewell AI</p>`,
          attachments: [{
            filename: fileName,
            content: base64,
            type: file.mime_type || 'application/octet-stream',
          }],
        },
      });

      if (error) throw error;

      if (user.id) logVaultAction(user.id, { action: 'download_file', target_type: 'file', target_id: file.id, target_name: file.name, details: { method: 'emailed_to_self' } });
    } catch (err: any) {
      toast.error('Failed to email file', { description: err.message });
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

  const handleDescriptionSubmit = () => {
    if (descriptionTarget) {
      updateDescription.mutate({ fileId: descriptionTarget.id, description: descriptionValue.trim() });
      setDescriptionTarget(null);
    }
  };

  const renderFileHoverCard = (file: VaultFile, children: React.ReactNode) => {
    const displayName = file.original_name || file.name;
    return (
      <HoverCard openDelay={400} closeDelay={100}>
        <HoverCardTrigger asChild>
          {children}
        </HoverCardTrigger>
        <HoverCardContent className="w-72 p-0" side="right" align="start" sideOffset={8}>
          <div className="p-2.5 bg-muted/50 border-b">
            <h4 className="font-semibold text-sm truncate flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              {displayName}
            </h4>
          </div>
          <div className="p-2.5 space-y-2 text-xs">
            {file.description && (
              <>
                <p className="text-foreground leading-relaxed">{file.description}</p>
                <Separator />
              </>
            )}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span>{getFileTypeName(file.file_type, file.mime_type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size:</span>
                <span>{formatFileSize(file.file_size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uploaded:</span>
                <span>{format(new Date(file.created_at), 'dd/MM/yyyy HH:mm')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Modified:</span>
                <span>{format(new Date(file.updated_at), 'dd/MM/yyyy HH:mm')}</span>
              </div>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length > 0) onUploadFiles(fileList);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReplaceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replaceTarget) {
      replaceFile.mutate({ fileId: replaceTarget.id, oldFilePath: replaceTarget.filePath, newFile: file });
      setReplaceTarget(null);
    }
    if (replaceInputRef.current) replaceInputRef.current.value = '';
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
        <>
          <ContextMenuItem onClick={() => handleDownload(file)}>
            <Download className="h-4 w-4 mr-2" />Download
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleEmailToMe(file)}>
            <Mail className="h-4 w-4 mr-2" />Email to Me
          </ContextMenuItem>
        </>
      ) : null}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => { setRenameTarget({ id, type, currentName: name }); setRenameValue(name); }}>
        <PencilLine className="h-4 w-4 mr-2" />Rename
      </ContextMenuItem>
      {type === 'file' && file && (
        <ContextMenuItem onClick={() => { setDescriptionTarget({ id, name, currentDescription: file.description || '' }); setDescriptionValue(file.description || ''); }}>
          <Info className="h-4 w-4 mr-2" />Edit Description
        </ContextMenuItem>
      )}
      {type === 'file' && filePath && canUpload && (
        <ContextMenuItem onClick={() => { setReplaceTarget({ id, filePath }); replaceInputRef.current?.click(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />Replace with New Version
        </ContextMenuItem>
      )}
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

  const renderItemDropdownMenu = (
    id: string,
    type: 'folder' | 'file',
    name: string,
    filePath?: string,
    file?: VaultFile
  ) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1 rounded hover:bg-muted/80 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {type === 'folder' ? (
          <DropdownMenuItem onClick={() => handleDoubleClickFolder(id)}>
            <FolderOpen className="h-4 w-4 mr-2" />Open
          </DropdownMenuItem>
        ) : file ? (
          <>
            <DropdownMenuItem onClick={() => handleDownload(file)}>
              <Download className="h-4 w-4 mr-2" />Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEmailToMe(file)}>
              <Mail className="h-4 w-4 mr-2" />Email to Me
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setRenameTarget({ id, type, currentName: name }); setRenameValue(name); }}>
          <PencilLine className="h-4 w-4 mr-2" />Rename
        </DropdownMenuItem>
        {type === 'file' && file && (
          <DropdownMenuItem onClick={() => { setDescriptionTarget({ id, name, currentDescription: file.description || '' }); setDescriptionValue(file.description || ''); }}>
            <Info className="h-4 w-4 mr-2" />Edit Description
          </DropdownMenuItem>
        )}
        {type === 'file' && filePath && canUpload && (
          <DropdownMenuItem onClick={() => { setReplaceTarget({ id, filePath }); setTimeout(() => replaceInputRef.current?.click(), 0); }}>
            <RefreshCw className="h-4 w-4 mr-2" />Replace with New Version
          </DropdownMenuItem>
        )}
        {canManageAccessItems && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onManageAccess(id, type, name)}>
              <Shield className="h-4 w-4 mr-2" />Manage Access
            </DropdownMenuItem>
          </>
        )}
        {canDeleteItems && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget({ id, type, name, filePath })}>
              <Trash2 className="h-4 w-4 mr-2" />Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
                {item.type === 'file' && item.file ? (
                  renderFileHoverCard(item.file, <span className="truncate">{item.name}</span>)
                ) : (
                  <span className="truncate">{item.name}</span>
                )}
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
            <td className="py-1 px-1 w-8">
              {renderItemDropdownMenu(item.id, item.type, item.name, item.filePath, item.file)}
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
          <th className="w-8" />
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
            <td className="py-1 px-1" />
          </tr>
        )}
        {groupedItems.map(group => (
          <>
            <tr key={`group-${group.label}`}>
              <td colSpan={5} className="pt-3 pb-1 px-2">
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

  // ── Tree View ──

  const toggleTreeNode = async (folderId: string) => {
    const next = new Set(expandedNodes);
    if (next.has(folderId)) {
      next.delete(folderId);
      setExpandedNodes(next);
      return;
    }
    next.add(folderId);
    setExpandedNodes(next);

    // Load children if not cached
    if (!treeChildren[folderId]) {
      const [{ data: childFolders }, { data: childFiles }] = await Promise.all([
        supabase
          .from('shared_drive_folders')
          .select('id, name, parent_id, created_by, created_at, updated_at, path')
          .eq('scope', 'nres_vault')
          .eq('parent_id', folderId)
          .order('name'),
        supabase
          .from('shared_drive_files')
          .select('id, name, original_name, folder_id, file_path, file_size, file_type, mime_type, created_by, created_at, updated_at, tags, description')
          .eq('scope', 'nres_vault')
          .eq('folder_id', folderId)
          .order('name'),
      ]);
      setTreeChildren(prev => ({
        ...prev,
        [folderId]: {
          folders: (childFolders || []) as VaultFolder[],
          files: (childFiles || []) as VaultFile[],
        },
      }));
    }
  };

  const renderTreeNode = (folder: VaultFolder, depth: number) => {
    const isExpanded = expandedNodes.has(folder.id);
    const children = treeChildren[folder.id];
    const isCut = isCutItem(folder.id);
    const isSelected = selectedItems.has(folder.id);

    return (
      <div key={folder.id}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors text-sm
                ${isSelected ? 'bg-primary/15' : 'hover:bg-muted/40'}
                ${isCut ? 'opacity-40' : ''}`}
              style={{ paddingLeft: `${depth * 20 + 8}px` }}
              onClick={(e) => { e.stopPropagation(); handleSelect(folder.id, e); }}
              onDoubleClick={() => handleDoubleClickFolder(folder.id)}
            >
              <button
                className="p-0.5 rounded hover:bg-muted/60 transition-colors shrink-0"
                onClick={(e) => { e.stopPropagation(); toggleTreeNode(folder.id); }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              <Folder
                className="h-4 w-4 shrink-0 text-amber-500"
                fill="currentColor"
                strokeWidth={1}
              />
              <span className="truncate">{folder.name}</span>
              <div className="ml-auto opacity-0 group-hover:opacity-100">
                {renderItemDropdownMenu(folder.id, 'folder', folder.name)}
              </div>
            </div>
          </ContextMenuTrigger>
          {renderItemContextMenu(folder.id, 'folder', folder.name)}
        </ContextMenu>

        {isExpanded && children && (
          <div>
            {children.folders.map(child => renderTreeNode(child, depth + 1))}
            {children.files.map(file => {
              const IconComp = getFileIcon(file.file_type);
              const iconColour = getFileIconColour(file.file_type);
              const displayName = file.original_name || file.name;
              const isFileSelected = selectedItems.has(file.id);
              const isFileCut = isCutItem(file.id);

              return (
                <ContextMenu key={file.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors text-sm group
                        ${isFileSelected ? 'bg-primary/15' : 'hover:bg-muted/40'}
                        ${isFileCut ? 'opacity-40' : ''}`}
                      style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
                      onClick={(e) => { e.stopPropagation(); handleSelect(file.id, e); }}
                      onDoubleClick={() => handleDownload(file)}
                    >
                      <IconComp className={`h-4 w-4 shrink-0 ${iconColour}`} strokeWidth={1.5} />
                      {renderFileHoverCard(file,
                        <span className="truncate">{displayName}</span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                        {formatFileSize(file.file_size)}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 shrink-0">
                        {renderItemDropdownMenu(file.id, 'file', displayName, file.file_path, file)}
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  {renderItemContextMenu(file.id, 'file', displayName, file.file_path, file)}
                </ContextMenu>
              );
            })}
            {children.folders.length === 0 && children.files.length === 0 && (
              <div
                className="text-xs text-muted-foreground italic py-1"
                style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}
              >
                Empty folder
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTreeView = () => {
    const rootKey = currentFolderId || '__root__';
    const rootChildren = treeChildren[rootKey];
    if (!rootChildren) return null;

    return (
      <div className="space-y-0.5">
        {currentFolderId && (
          <div
            className="flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-muted/40 text-sm text-muted-foreground"
            onClick={onNavigateUp}
          >
            <ArrowUp className="h-4 w-4 shrink-0" />
            <span>..</span>
          </div>
        )}
        {rootChildren.folders.map(folder => renderTreeNode(folder, 0))}
        {rootChildren.files.map(file => {
          const IconComp = getFileIcon(file.file_type);
          const iconColour = getFileIconColour(file.file_type);
          const displayName = file.original_name || file.name;
          const isFileSelected = selectedItems.has(file.id);
          const isFileCut = isCutItem(file.id);

          return (
            <ContextMenu key={file.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors text-sm group
                    ${isFileSelected ? 'bg-primary/15' : 'hover:bg-muted/40'}
                    ${isFileCut ? 'opacity-40' : ''}`}
                  style={{ paddingLeft: '28px' }}
                  onClick={(e) => { e.stopPropagation(); handleSelect(file.id, e); }}
                  onDoubleClick={() => handleDownload(file)}
                >
                  <IconComp className={`h-4 w-4 shrink-0 ${iconColour}`} strokeWidth={1.5} />
                  {renderFileHoverCard(file,
                    <span className="truncate">{displayName}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                    {formatFileSize(file.file_size)}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 shrink-0">
                    {renderItemDropdownMenu(file.id, 'file', displayName, file.file_path, file)}
                  </div>
                </div>
              </ContextMenuTrigger>
              {renderItemContextMenu(file.id, 'file', displayName, file.file_path, file)}
            </ContextMenu>
          );
        })}
      </div>
    );
  };

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
              className={`relative flex flex-col items-center gap-1 p-2 rounded cursor-pointer transition-colors
                ${selectedItems.has(folder.id) ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-muted/60'}
                ${isCutItem(folder.id) ? 'opacity-40' : ''} group`}
              onClick={(e) => { e.stopPropagation(); handleSelect(folder.id, e); }}
              onDoubleClick={() => handleDoubleClickFolder(folder.id)}
            >
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {renderItemDropdownMenu(folder.id, 'folder', folder.name)}
              </div>
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
                className={`relative flex flex-col items-center gap-1 p-2 rounded cursor-pointer transition-colors
                  ${selectedItems.has(file.id) ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-muted/60'}
                  ${isCutItem(file.id) ? 'opacity-40' : ''} group`}
                onClick={(e) => { e.stopPropagation(); handleSelect(file.id, e); }}
                onDoubleClick={() => handleDownload(file)}
              >
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {renderItemDropdownMenu(file.id, 'file', displayName, file.file_path, file)}
                </div>
                <IconComp className={`h-10 w-10 shrink-0 ${iconColour}`} strokeWidth={1} />
                {renderFileHoverCard(file,
                  <span className="text-xs text-center leading-tight truncate w-full">{displayName}</span>
                )}
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
            className="relative min-h-[500px] rounded-lg border bg-background p-3 select-none"
            onClick={(e) => { if (e.target === e.currentTarget) clearSelection(); }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onPaste={handlePasteFiles}
            tabIndex={0}
          >
            {/* Drag-over overlay */}
            {isDragOver && canUpload && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10 pointer-events-none">
                <Upload className="h-10 w-10 text-primary mb-2" />
                <p className="text-sm font-medium text-primary">Drop files here to upload</p>
              </div>
            )}
            {totalItems === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Folder className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">This folder is empty</p>
                <p className="text-xs mt-1">Drag and drop files here, or right-click for more options</p>
              </div>
            ) : viewMode === 'tree' ? (
              renderTreeView()
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
      <input ref={replaceInputRef} type="file" className="hidden" onChange={handleReplaceFileSelect} />

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename {renameTarget?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
          </DialogHeader>
          <div className="px-8 sm:px-10 py-6 space-y-3">
            <Label htmlFor="rename-input">New name</Label>
            <Input
              id="rename-input"
              className="bg-white dark:bg-white/10"
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

      {/* Edit Description dialog */}
      <Dialog open={!!descriptionTarget} onOpenChange={(open) => !open && setDescriptionTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Description</DialogTitle>
          </DialogHeader>
          <div className="px-8 sm:px-10 py-6 space-y-3">
            <Label>File: <span className="font-normal text-muted-foreground">{descriptionTarget?.name}</span></Label>
            <Label htmlFor="description-input">Description</Label>
            <Textarea
              id="description-input"
              className="bg-white dark:bg-white/10"
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              placeholder="Add a description to help identify this file..."
              rows={3}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescriptionTarget(null)}>Cancel</Button>
            <Button onClick={handleDescriptionSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="px-8 sm:px-10 py-6 space-y-3">
            <Label htmlFor="new-folder-name">Folder Name</Label>
            <Input
              id="new-folder-name"
              className="bg-white dark:bg-white/10"
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

      {/* Delete confirmation - cautious */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="h-5 w-5" />
              {deleteTarget?.type === 'folder' ? 'Delete Folder & All Contents' : 'Delete File'}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const isOwner = (() => {
              if (!deleteTarget || !user?.id) return false;
              if (deleteTarget.type === 'folder') {
                return folders.some(f => f.id === deleteTarget.id && f.created_by === user.id);
              }
              return files.some(f => f.id === deleteTarget.id && f.created_by === user.id);
            })();

            return (
              <div className="px-8 sm:px-10 py-4 space-y-4">
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2 text-sm">
                  <p className="font-semibold text-destructive">⚠️ Warning: This action is non-recoverable</p>
                  <p>You are about to permanently delete "<span className="font-medium">{deleteTarget?.name}</span>".</p>
                  {deleteTarget?.type === 'folder' && (
                    <p>This will also permanently delete <strong>all files and sub-folders</strong> contained within it.</p>
                  )}
                  <p className="text-muted-foreground">This action is fully audited and cannot be reversed. Deleted items cannot be restored.</p>
                </div>
                {!isOwner && (
                  <div className="space-y-2">
                    <Label htmlFor="delete-confirm" className="text-sm">
                      To confirm, type <span className="font-mono font-bold text-destructive">DELETE</span> below:
                    </Label>
                    <Input
                      id="delete-confirm"
                      className="bg-white dark:bg-white/10"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      autoFocus
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}>Cancel</Button>
            {(() => {
              const isOwner = (() => {
                if (!deleteTarget || !user?.id) return false;
                if (deleteTarget.type === 'folder') {
                  return folders.some(f => f.id === deleteTarget.id && f.created_by === user.id);
                }
                return files.some(f => f.id === deleteTarget.id && f.created_by === user.id);
              })();

              return (
                <Button
                  variant="destructive"
                  disabled={!isOwner && deleteConfirmText !== 'DELETE'}
                  onClick={() => {
                    if (deleteTarget && (isOwner || deleteConfirmText === 'DELETE')) {
                      onDelete(deleteTarget.id, deleteTarget.type, deleteTarget.filePath, deleteTarget.name);
                      setDeleteTarget(null);
                      setDeleteConfirmText('');
                    }
                  }}
                >
                  Permanently Delete
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
