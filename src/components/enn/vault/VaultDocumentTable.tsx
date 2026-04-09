import { Star, FileText, FileSpreadsheet, FileImage, File, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { VaultFile } from '@/hooks/useNRESVaultData';

function getFileIcon(fileType: string | null) {
  switch (fileType?.toLowerCase()) {
    case 'pdf': return <FileText className="h-4 w-4 text-red-500" />;
    case 'doc': case 'docx': return <FileText className="h-4 w-4 text-blue-500" />;
    case 'xls': case 'xlsx': case 'csv': return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    case 'png': case 'jpg': case 'jpeg': case 'gif': return <FileImage className="h-4 w-4 text-purple-500" />;
    default: return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

function getTypeBadge(fileType: string | null) {
  const t = fileType?.toLowerCase();
  if (!t) return null;
  const colours: Record<string, string> = {
    pdf: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    docx: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    doc: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    xlsx: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    xls: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    csv: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${colours[t] || 'bg-muted text-muted-foreground'}`}>
      .{t}
    </span>
  );
}

function getInitials(userId: string) {
  // Simple hash-based initials
  const code = userId.charCodeAt(0) + userId.charCodeAt(1);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[code % 26] + letters[(code + 7) % 26];
}

function getAvatarColour(userId: string) {
  const colours = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500'];
  const idx = (userId.charCodeAt(0) + userId.charCodeAt(userId.length - 1)) % colours.length;
  return colours[idx];
}

function relativeTime(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function handleDownload(filePath: string, fileName: string) {
  const { data } = await supabase.storage.from('shared-drive').download(filePath);
  if (data) {
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

interface Column {
  key: string;
  label: string;
}

interface VaultDocumentTableProps {
  files: VaultFile[];
  columns: Column[];
  favouriteIds: string[];
  onToggleFavourite: (fileId: string, isFav: boolean) => void;
  folderMap?: Record<string, { name: string; path: string }>;
  showGroupHeaders?: boolean;
  groupByKey?: 'updated_at' | 'created_at';
  emptyMessage?: string;
}

function getTimePeriod(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days < 7) return 'This week';
  if (days < 30) return 'This month';
  return 'Earlier';
}

export const VaultDocumentTable = ({
  files,
  columns,
  favouriteIds,
  onToggleFavourite,
  folderMap = {},
  showGroupHeaders = false,
  groupByKey = 'updated_at',
  emptyMessage = 'No documents found',
}: VaultDocumentTableProps) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-10 w-10 mb-2 opacity-40" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  // Group files if needed
  const groups: { label: string; files: VaultFile[] }[] = [];
  if (showGroupHeaders) {
    const groupMap = new Map<string, VaultFile[]>();
    files.forEach((f) => {
      const period = getTimePeriod(f[groupByKey]);
      if (!groupMap.has(period)) groupMap.set(period, []);
      groupMap.get(period)!.push(f);
    });
    groupMap.forEach((gFiles, label) => groups.push({ label, files: gFiles }));
  } else {
    groups.push({ label: '', files });
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            {columns.map((col) => (
              <TableHead key={col.key} className="text-xs font-medium">
                {col.label}
              </TableHead>
            ))}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <>
              {showGroupHeaders && group.label && (
                <TableRow key={`group-${group.label}`} className="bg-muted/20">
                  <TableCell colSpan={columns.length + 1} className="py-1.5 text-xs font-semibold text-muted-foreground">
                    {group.label}
                  </TableCell>
                </TableRow>
              )}
              {group.files.map((file) => {
                const isFav = favouriteIds.includes(file.id);
                return (
                  <TableRow key={file.id} className="hover:bg-muted/30">
                    {columns.map((col) => (
                      <TableCell key={col.key} className="py-2 text-sm">
                        {col.key === 'name' && (
                          <div className="flex items-center gap-2">
                            {getFileIcon(file.file_type)}
                            <div className="min-w-0">
                              <button
                                onClick={() => handleDownload(file.file_path, file.name)}
                                className="text-sm font-medium text-foreground hover:text-primary hover:underline truncate block max-w-[300px]"
                                title={file.name}
                              >
                                {file.name}
                              </button>
                              {file.folder_id && folderMap[file.folder_id] && (
                                <p className="text-[11px] text-muted-foreground truncate max-w-[400px]" title={folderMap[file.folder_id].path}>
                                  {folderMap[file.folder_id].path}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {col.key === 'type' && getTypeBadge(file.file_type)}
                        {col.key === 'edited_by' && (
                          <div className="flex items-center gap-1.5">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getAvatarColour(file.created_by)}`}>
                              {getInitials(file.created_by)}
                            </div>
                          </div>
                        )}
                        {col.key === 'uploaded_by' && (
                          <div className="flex items-center gap-1.5">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getAvatarColour(file.created_by)}`}>
                              {getInitials(file.created_by)}
                            </div>
                          </div>
                        )}
                        {col.key === 'when' && (
                          <span className="text-xs text-muted-foreground">{relativeTime(file.updated_at)}</span>
                        )}
                        {col.key === 'uploaded_date' && (
                          <span className="text-xs text-muted-foreground">{relativeTime(file.created_at)}</span>
                        )}
                        {col.key === 'last_edited' && (
                          <span className="text-xs text-muted-foreground">{relativeTime(file.updated_at)}</span>
                        )}
                        {col.key === 'location' && (
                          <span className="text-xs text-muted-foreground truncate max-w-[250px] block" title={file.folder_id && folderMap[file.folder_id] ? folderMap[file.folder_id].path : 'Root'}>
                            {file.folder_id && folderMap[file.folder_id] ? folderMap[file.folder_id].path : 'Root'}
                          </span>
                        )}
                        {col.key === 'star' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onToggleFavourite(file.id, isFav)}
                          >
                            <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                          </Button>
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="py-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDownload(file.file_path, file.name)}
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
