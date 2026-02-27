import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, FileText, Folder, Download, Eye, Pencil, Trash2, Upload, FolderPlus, Copy, Move, Shield, RefreshCw, FileDown, Sheet } from 'lucide-react';
import { useVaultAuditLogs, VaultAuditRecord } from '@/hooks/useNRESVaultAudit';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

const fetchAllAuditLogs = async (): Promise<VaultAuditRecord[]> => {
  const allLogs: VaultAuditRecord[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('nres_vault_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + batchSize - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      allLogs.push(...(data as VaultAuditRecord[]));
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }
  return allLogs;
};

const getActionLabel = (action: string) => ACTION_CONFIG[action]?.label || action;

const formatLogsForExport = (logs: VaultAuditRecord[]) =>
  logs.map((log) => ({
    'Date & Time': format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
    'User Name': log.user_name || 'Unknown',
    'User Email': log.user_email || '',
    'Action': getActionLabel(log.action),
    'Item Type': log.target_type === 'folder' ? 'Folder' : 'File',
    'Item Name': log.target_name || '',
  }));

const handleExportWord = async () => {
  try {
    toast.info('Preparing Word export…');
    const logs = await fetchAllAuditLogs();
    const rows = formatLogsForExport(logs);
    const { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel } = await import('docx');

    const headers = ['Date & Time', 'User Name', 'User Email', 'Action', 'Item Type', 'Item Name'];

    const headerRow = new TableRow({
      tableHeader: true,
      children: headers.map(
        (h) =>
          new TableCell({
            shading: { fill: '003087' },
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })] })],
          })
      ),
    });

    const dataRows = rows.map(
      (row) =>
        new TableRow({
          children: headers.map(
            (h) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: row[h as keyof typeof row] || '', size: 18, font: 'Calibri' })] })],
              })
          ),
        })
    );

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'NRES Document Vault — Audit Report', bold: true, size: 32, color: '003087', font: 'Calibri' })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
              children: [new TextRun({ text: `Generated: ${format(new Date(), 'dd MMMM yyyy, HH:mm')} · ${rows.length} events`, size: 20, color: '666666', font: 'Calibri' })],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [headerRow, ...dataRows],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
              },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NRES_Vault_Audit_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Word report downloaded');
  } catch (e) {
    console.error('Word export failed:', e);
    toast.error('Failed to generate Word report');
  }
};

const handleExportExcel = async () => {
  try {
    toast.info('Preparing Excel export…');
    const logs = await fetchAllAuditLogs();
    const rows = formatLogsForExport(logs);
    const XLSX = await import('xlsx-js-style');

    const headers = ['Date & Time', 'User Name', 'User Email', 'Action', 'Item Type', 'Item Name'];
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
      fill: { fgColor: { rgb: '003087' } },
      alignment: { horizontal: 'center' as const },
      border: {
        top: { style: 'thin' as const, color: { rgb: 'CCCCCC' } },
        bottom: { style: 'thin' as const, color: { rgb: 'CCCCCC' } },
        left: { style: 'thin' as const, color: { rgb: 'CCCCCC' } },
        right: { style: 'thin' as const, color: { rgb: 'CCCCCC' } },
      },
    };
    const cellStyle = {
      font: { name: 'Calibri', sz: 10 },
      border: {
        top: { style: 'thin' as const, color: { rgb: 'EEEEEE' } },
        bottom: { style: 'thin' as const, color: { rgb: 'EEEEEE' } },
        left: { style: 'thin' as const, color: { rgb: 'EEEEEE' } },
        right: { style: 'thin' as const, color: { rgb: 'EEEEEE' } },
      },
    };

    const wsData = [
      headers.map((h) => ({ v: h, s: headerStyle })),
      ...rows.map((row) => headers.map((h) => ({ v: row[h as keyof typeof row] || '', s: cellStyle }))),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 22 },
      { wch: 30 },
      { wch: 20 },
      { wch: 12 },
      { wch: 35 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
    XLSX.writeFile(wb, `NRES_Vault_Audit_Report_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
    toast.success('Excel report downloaded');
  } catch (e) {
    console.error('Excel export failed:', e);
    toast.error('Failed to generate Excel report');
  }
};

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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleExportWord}>
            <FileDown className="h-3.5 w-3.5" />
            Word
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleExportExcel}>
            <Sheet className="h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
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
