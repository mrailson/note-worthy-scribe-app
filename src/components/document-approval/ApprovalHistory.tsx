import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Ban,
  ArrowUpDown,
  CalendarIcon,
  Eye,
  Layers,
} from 'lucide-react';
import { ApprovalDocumentWithSignatories } from '@/hooks/useDocumentApproval';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import XlsxPopulate from 'xlsx-js-style';
import { saveAs } from 'file-saver';

const categoryLabels: Record<string, string> = {
  dpia: 'DPIA', dsa: 'DSA', mou: 'MOU', policy: 'Policy',
  contract: 'Contract', privacy_notice: 'Privacy Notice', other: 'Other',
};

type StatusFilter = 'all' | 'completed' | 'revoked' | 'expired';
type SortField = 'title' | 'category' | 'sent' | 'completed' | 'signatories';
type SortDir = 'asc' | 'desc';

interface Props {
  documents: ApprovalDocumentWithSignatories[];
  onSelectDoc: (doc: ApprovalDocumentWithSignatories) => void;
}

export function ApprovalHistory({ documents, onSelectDoc }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortField, setSortField] = useState<SortField>('sent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Only history docs
  const historyDocs = useMemo(() =>
    documents.filter(d => d.status === 'completed' || d.status === 'revoked' || d.status === 'expired'),
    [documents]
  );

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const filtered = useMemo(() => {
    let list = [...historyDocs];

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(d => d.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      list = list.filter(d => d.category === categoryFilter);
    }

    // Date range
    if (dateFrom || dateTo) {
      list = list.filter(d => {
        const sent = parseISO(d.created_at);
        if (dateFrom && dateTo) {
          return isWithinInterval(sent, { start: dateFrom, end: dateTo });
        }
        if (dateFrom) return sent >= dateFrom;
        if (dateTo) return sent <= dateTo;
        return true;
      });
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.title.toLowerCase().includes(q) ||
        (d.category && categoryLabels[d.category]?.toLowerCase().includes(q)) ||
        d.signatories.some(s =>
          s.name.toLowerCase().includes(q) ||
          s.organisation?.toLowerCase().includes(q)
        )
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'category':
          cmp = (a.category || '').localeCompare(b.category || '');
          break;
        case 'sent':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'completed':
          cmp = (a.completed_at ? new Date(a.completed_at).getTime() : 0) -
                (b.completed_at ? new Date(b.completed_at).getTime() : 0);
          break;
        case 'signatories': {
          const aR = a.signatories.length ? a.signatories.filter(s => s.status === 'approved').length / a.signatories.length : 0;
          const bR = b.signatories.length ? b.signatories.filter(s => s.status === 'approved').length / b.signatories.length : 0;
          cmp = aR - bR;
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [historyDocs, statusFilter, categoryFilter, dateFrom, dateTo, search, sortField, sortDir]);

  // Unique categories from history docs
  const categories = useMemo(() => {
    const cats = new Set(historyDocs.map(d => d.category).filter(Boolean));
    return Array.from(cats);
  }, [historyDocs]);

  const buildExportRows = useCallback(() => {
    return filtered.map(doc => {
      const approved = doc.signatories.filter(s => s.status === 'approved').length;
      const total = doc.signatories.length;
      return {
        Title: doc.title,
        Category: categoryLabels[doc.category] || doc.category,
        Status: doc.status.charAt(0).toUpperCase() + doc.status.slice(1),
        Sent: format(new Date(doc.created_at), 'dd MMM yyyy'),
        Completed: doc.completed_at ? format(new Date(doc.completed_at), 'dd MMM yyyy') : '—',
        Signatories: `${approved}/${total}`,
        'Signatory Names': doc.signatories.map(s => s.name).join(', '),
      };
    });
  }, [filtered]);

  const exportCsv = useCallback(() => {
    const rows = buildExportRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String((r as any)[h]).replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `approval-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  }, [buildExportRows]);

  const exportExcel = useCallback(async () => {
    const rows = buildExportRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);

    const wb = XlsxPopulate.utils.book_new();
    const wsData = [headers, ...rows.map(r => headers.map(h => (r as any)[h]))];
    const ws = XlsxPopulate.utils.aoa_to_sheet(wsData);

    // Style header row
    headers.forEach((_, i) => {
      const cell = XlsxPopulate.utils.encode_cell({ c: i, r: 0 });
      if (ws[cell]) {
        ws[cell].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '0EA5E9' } },
          alignment: { horizontal: 'center' },
        };
      }
    });

    // Column widths
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 14) }));

    XlsxPopulate.utils.book_append_sheet(wb, ws, 'Approval History');
    const buf = XlsxPopulate.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `approval-history-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }, [buildExportRows]);

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground/50'}`} />
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Title, signatory, organisation…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Status */}
          <div className="w-[140px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="w-[160px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1 min-w-[120px] justify-start">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, 'dd MMM yyyy') : 'Any'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} />
                {dateFrom && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setDateFrom(undefined)}>
                      Clear
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1 min-w-[120px] justify-start">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, 'dd MMM yyyy') : 'Any'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                {dateTo && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setDateTo(undefined)}>
                      Clear
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Card>

      {/* Export + count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'document' : 'documents'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={exportExcel} disabled={filtered.length === 0}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader field="title">Title</SortHeader>
              <SortHeader field="category">Category</SortHeader>
              <TableHead>Status</TableHead>
              <SortHeader field="sent">Sent</SortHeader>
              <SortHeader field="completed">Completed</SortHeader>
              <SortHeader field="signatories">Signatories</SortHeader>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No documents match your filters
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(doc => {
                const approved = doc.signatories.filter(s => s.status === 'approved').length;
                const total = doc.signatories.length;
                const allApproved = approved === total && total > 0;

                return (
                  <TableRow
                    key={doc.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onSelectDoc(doc)}
                  >
                    <TableCell className="font-medium max-w-[240px] truncate">
                      <div className="flex items-center gap-1.5">
                        {doc.batch_id && (
                          <Layers className="h-3 w-3 text-primary flex-shrink-0" title="Part of a batch" />
                        )}
                        {doc.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {categoryLabels[doc.category] || doc.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {doc.status === 'completed' ? (
                        <Badge className="bg-[hsl(var(--approval-completed-bg))] text-[hsl(var(--approval-approved))] border border-[hsl(var(--approval-completed-border))] text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </Badge>
                      ) : doc.status === 'revoked' ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Ban className="h-3 w-3" /> Revoked
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <XCircle className="h-3 w-3" /> Expired
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(doc.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-sm">
                      {doc.completed_at ? format(new Date(doc.completed_at), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${allApproved ? 'text-[hsl(var(--approval-approved))]' : 'text-muted-foreground'}`}>
                        {approved}/{total}
                        {allApproved && ' ✅'}
                        {!allApproved && total > 0 && ' ❌'}
                      </span>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={() => onSelectDoc(doc)}>
                          <Eye className="h-3 w-3" /> View
                        </Button>
                        {doc.status === 'completed' && (
                          <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                            <Download className="h-3 w-3" /> Cert
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
