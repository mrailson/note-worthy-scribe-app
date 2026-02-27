import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, FileText, Folder, Download, Eye, Pencil, Trash2, Upload, FolderPlus, Copy, Move, Shield, RefreshCw } from 'lucide-react';
import { useVaultAuditLogs } from '@/hooks/useNRESVaultAudit';
import { format } from 'date-fns';

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  create_folder: { label: 'Created Folder', icon: FolderPlus, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  upload_file: { label: 'Uploaded File', icon: Upload, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  delete_folder: { label: 'Deleted Folder', icon: Trash2, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  delete_file: { label: 'Deleted File', icon: Trash2, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  rename_folder: { label: 'Renamed Folder', icon: Pencil, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  rename_file: { label: 'Renamed File', icon: Pencil, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  move_folder: { label: 'Moved Folder', icon: Move, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  move_file: { label: 'Moved File', icon: Move, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  copy_file: { label: 'Copied File', icon: Copy, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  replace_file: { label: 'Replaced File', icon: RefreshCw, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  view_file: { label: 'Viewed File', icon: Eye, color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300' },
  download_file: { label: 'Downloaded File', icon: Download, color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300' },
  edit_description: { label: 'Edited Description', icon: Pencil, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  manage_access: { label: 'Managed Access', icon: Shield, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  add_permission: { label: 'Added Permission', icon: Shield, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  remove_permission: { label: 'Removed Permission', icon: Shield, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  navigate_folder: { label: 'Opened Folder', icon: Folder, color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300' },
};

const PAGE_SIZE = 50;

export const VaultAuditLogTab = () => {
  const [page, setPage] = useState(0);
  const { data, isLoading } = useVaultAuditLogs(page, PAGE_SIZE);

  const logs = data?.logs || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount} audit event{totalCount !== 1 ? 's' : ''} recorded
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Loading audit log…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No audit events recorded yet.</p>
      ) : (
        <div className="max-h-[400px] overflow-y-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Date &amp; Time</th>
                <th className="text-left px-3 py-2 font-medium">User</th>
                <th className="text-left px-3 py-2 font-medium">Action</th>
                <th className="text-left px-3 py-2 font-medium">Item</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => {
                const config = ACTION_CONFIG[log.action] || {
                  label: log.action,
                  icon: FileText,
                  color: 'bg-muted text-muted-foreground',
                };
                const Icon = config.icon;
                const TargetIcon = log.target_type === 'folder' ? Folder : FileText;

                return (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate text-xs">{log.user_name || 'Unknown'}</p>
                        {log.user_email && (
                          <p className="text-xs text-muted-foreground truncate">{log.user_email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className={`text-xs gap-1 ${config.color}`}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {log.target_name && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TargetIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-xs max-w-[150px]">{log.target_name}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
