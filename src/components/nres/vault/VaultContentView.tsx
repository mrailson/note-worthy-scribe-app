import { Folder, FileText, Download, Trash2, Shield, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VaultFolder, VaultFile } from '@/hooks/useNRESVaultData';
import { format } from 'date-fns';

interface VaultContentViewProps {
  folders: VaultFolder[];
  files: VaultFile[];
  onNavigateToFolder: (folderId: string) => void;
  onDelete: (id: string, type: 'folder' | 'file', filePath?: string) => void;
  onManageAccess: (id: string, type: 'folder' | 'file', name: string) => void;
  canDeleteItems: boolean;
  canManageAccessItems: boolean;
  isLoading: boolean;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const VaultContentView = ({
  folders,
  files,
  onNavigateToFolder,
  onDelete,
  onManageAccess,
  canDeleteItems,
  canManageAccessItems,
  isLoading,
}: VaultContentViewProps) => {
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: 'folder' | 'file';
    name: string;
    filePath?: string;
  } | null>(null);

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
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error('Download failed', { description: err.message });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Folder className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">This folder is empty</p>
        <p className="text-xs mt-1">Create a folder or upload files to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2 font-medium">Name</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Size</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Modified</th>
              <th className="w-10 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {folders.map((folder) => (
              <tr
                key={folder.id}
                className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                onClick={() => onNavigateToFolder(folder.id)}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">-</td>
                <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                  {format(new Date(folder.updated_at), 'dd/MM/yyyy HH:mm')}
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canManageAccessItems && (
                        <DropdownMenuItem onClick={() => onManageAccess(folder.id, 'folder', folder.name)}>
                          <Shield className="h-4 w-4 mr-2" />
                          Manage Access
                        </DropdownMenuItem>
                      )}
                      {canDeleteItems && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget({ id: folder.id, type: 'folder', name: folder.name })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}

            {files.map((file) => (
              <tr key={file.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent-foreground shrink-0" />
                    <span className="truncate">{file.original_name || file.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                  {formatFileSize(file.file_size)}
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                  {format(new Date(file.updated_at), 'dd/MM/yyyy HH:mm')}
                </td>
                <td className="px-3 py-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(file)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      {canManageAccessItems && (
                        <DropdownMenuItem onClick={() => onManageAccess(file.id, 'file', file.original_name || file.name)}>
                          <Shield className="h-4 w-4 mr-2" />
                          Manage Access
                        </DropdownMenuItem>
                      )}
                      {canDeleteItems && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget({ id: file.id, type: 'file', name: file.original_name || file.name, filePath: file.file_path })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'folder' ? 'Folder' : 'File'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"?
              {deleteTarget?.type === 'folder' && ' This will also delete all contents within it.'}
              This action cannot be undone.
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
