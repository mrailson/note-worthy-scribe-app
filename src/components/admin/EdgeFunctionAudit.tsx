import React, { useState, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { Slider } from '@/components/ui/slider';
import { Search, Activity, Archive, CheckCircle, XCircle, Loader2, Filter, Download, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Document, Packer, Paragraph, TextRun, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, HeadingLevel, BorderStyle, AlignmentType, ShadingType } from 'docx';
import { saveAs } from 'file-saver';

import type {
  EdgeFunction,
  ReferenceFilterType,
  AuditFilterState,
  InvocationPathType,
  DataSensitivity,
  LifecycleStatus,
} from './audit/EdgeFunctionAuditTypes';
import { DEFAULT_FILTERS } from './audit/EdgeFunctionAuditTypes';
import { ACTIVE_FUNCTIONS, ARCHIVED_FUNCTIONS } from './audit/EdgeFunctionAuditData';
import { recomputeDynamicFields, computeLastInvocationBucket } from './audit/EdgeFunctionAuditUtils';
import { EdgeFunctionExpandedRow } from './audit/EdgeFunctionExpandedRow';

// ── Badge Styling Maps ──────────────────────────────────────────────────

const lifecycleBadgeStyles: Record<LifecycleStatus, string> = {
  'ACTIVE': 'bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-700',
  'DORMANT (retained)': 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
  'DEPRECATED': 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
  'DEPRECATED (still in use)': 'bg-amber-100 text-amber-800 border-amber-400 border-2 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-500',
  'ARCHIVED': 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700',
};

const pathTypeBadgeStyles: Record<InvocationPathType, string> = {
  'UI-triggered': 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  'Edge-to-Edge': 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  'Webhook (external)': 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  'Cron / background': 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  'One-off seed / migration': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  'Unknown': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const sensitivityBadgeStyles: Record<DataSensitivity, string> = {
  'PHI': 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  'Operational': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'Public': 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  'Demo / Test': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  'Unknown': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const getConfidenceColor = (score: number): string => {
  if (score >= 70) return 'text-green-700 dark:text-green-400';
  if (score >= 30) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
};

// ── Component ───────────────────────────────────────────────────────────

export const EdgeFunctionAudit: React.FC = () => {
  const [filters, setFilters] = useState<AuditFilterState>(DEFAULT_FILTERS);
  const [functions, setFunctions] = useState<EdgeFunction[]>(() => [...ACTIVE_FUNCTIONS]);
  const [batchScanning, setBatchScanning] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  // ── Stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = functions;
    const total = all.length;
    const clientReferenced = all.filter(f => f.referencedInClient).length;
    const functionReferenced = all.filter(f => f.referencedInOtherFunctions).length;
    const unreferenced = all.filter(f => !f.referencedInClient && !f.referencedInOtherFunctions).length;
    const deprecated = all.filter(f => f.lifecycleStatus === 'DEPRECATED' || f.lifecycleStatus === 'DEPRECATED (still in use)').length;
    const dormant = all.filter(f => f.lifecycleStatus === 'DORMANT (retained)').length;
    return { total, clientReferenced, functionReferenced, unreferenced, archived: ARCHIVED_FUNCTIONS.length, deprecated, dormant };
  }, [functions]);

  // ── Filtered Functions ──────────────────────────────────────────────
  const filteredFunctions = useMemo(() => {
    return functions.filter(f => {
      // Text search
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        if (!f.name.toLowerCase().includes(q) && !f.purpose.toLowerCase().includes(q) && !f.calledFrom.toLowerCase().includes(q)) return false;
      }
      // Reference filter
      switch (filters.referenceFilter) {
        case 'referenced': if (!f.referencedInClient && !f.referencedInOtherFunctions) return false; break;
        case 'unreferenced': if (f.referencedInClient || f.referencedInOtherFunctions) return false; break;
        case 'no-client-ref': if (f.referencedInClient) return false; break;
        case 'no-function-ref': if (f.referencedInOtherFunctions) return false; break;
      }
      // Lifecycle filter
      if (filters.lifecycleFilter !== 'all' && f.lifecycleStatus !== filters.lifecycleFilter) return false;
      // Path type filter
      if (filters.pathTypeFilter !== 'all' && f.invocationPathType !== filters.pathTypeFilter) return false;
      // Sensitivity filter
      if (filters.sensitivityFilter !== 'all' && f.dataSensitivity !== filters.sensitivityFilter) return false;
      // Confidence threshold
      if (f.archiveConfidenceScore < filters.confidenceThreshold) return false;
      return true;
    });
  }, [functions, filters]);

  const filteredArchived = useMemo(() => {
    if (!filters.searchQuery) return ARCHIVED_FUNCTIONS;
    const q = filters.searchQuery.toLowerCase();
    return ARCHIVED_FUNCTIONS.filter(f => f.name.toLowerCase().includes(q) || f.purpose.toLowerCase().includes(q));
  }, [filters.searchQuery]);

  // ── Log Fetching ────────────────────────────────────────────────────
  const checkLogs = useCallback(async (functionName: string) => {
    setFunctions(prev => prev.map(f =>
      f.name === functionName ? { ...f, logStatus: 'loading' as const } : f
    ));

    try {
      const { data, error } = await supabase.functions.invoke('system-monitoring', {
        body: { action: 'get-function-logs', functionName, limit: 5 }
      });

      if (error) throw error;

      const logDates = data?.logs?.map((log: any) => {
        const d = new Date(log.timestamp);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) +
          ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      }) || [];

      setFunctions(prev => prev.map(f => {
        if (f.name !== functionName) return f;
        const updated = { ...f, lastLogDates: logDates, logStatus: 'loaded' as const };
        return recomputeDynamicFields(updated);
      }));
    } catch (err) {
      console.error(`Error fetching logs for ${functionName}:`, err);
      setFunctions(prev => prev.map(f =>
        f.name === functionName ? { ...f, lastLogDates: [], logStatus: 'error' as const } : f
      ));
      toast.error(`Failed to fetch logs for ${functionName}`);
    }
  }, []);

  const batchScanUnreferenced = async () => {
    const unreferenced = functions.filter(f => !f.referencedInClient && !f.referencedInOtherFunctions && f.logStatus === 'idle');
    if (unreferenced.length === 0) {
      toast.info('No unreferenced functions to scan');
      return;
    }
    setBatchScanning(true);
    const batch = unreferenced.slice(0, 20);
    for (const fn of batch) {
      await checkLogs(fn.name);
    }
    setBatchScanning(false);
    toast.success(`Scanned logs for ${batch.length} unreferenced functions`);
  };

  // ── Row Styling ─────────────────────────────────────────────────────
  const getRowClass = (fn: EdgeFunction) => {
    if (fn.lifecycleStatus === 'DEPRECATED' || fn.lifecycleStatus === 'DEPRECATED (still in use)') {
      return 'bg-amber-50/50 dark:bg-amber-950/10';
    }
    if (fn.lifecycleStatus === 'DORMANT (retained)') {
      return 'bg-slate-50/50 dark:bg-slate-900/20';
    }
    if (!fn.referencedInClient && !fn.referencedInOtherFunctions) {
      if (fn.logStatus === 'loaded' && (!fn.lastLogDates || fn.lastLogDates.length === 0)) {
        return 'bg-red-50 dark:bg-red-950/20';
      }
      return 'bg-amber-50 dark:bg-amber-950/20';
    }
    return '';
  };

  // ── Word Report ─────────────────────────────────────────────────────
  const downloadWordReport = async () => {
    try {
      const now = new Date();
      const reportDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

      const cellBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      };

      const headerShading = { type: ShadingType.SOLID, color: '003087', fill: '003087' };

      const makeHeaderCell = (text: string, width: number) =>
        new DocxTableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: headerShading,
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 16, font: 'Calibri' })] })],
        });

      const makeCell = (text: string, width: number, opts?: { bold?: boolean; color?: string; shading?: any }) =>
        new DocxTableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          shading: opts?.shading,
          children: [new Paragraph({ children: [new TextRun({ text, size: 16, font: 'Calibri', bold: opts?.bold, color: opts?.color })] })],
        });

      // Governance summary counts
      const lifecycleCounts = {
        ACTIVE: functions.filter(f => f.lifecycleStatus === 'ACTIVE').length,
        'DORMANT (retained)': functions.filter(f => f.lifecycleStatus === 'DORMANT (retained)').length,
        DEPRECATED: functions.filter(f => f.lifecycleStatus === 'DEPRECATED' || f.lifecycleStatus === 'DEPRECATED (still in use)').length,
      };
      const sensitivityCounts = {
        PHI: functions.filter(f => f.dataSensitivity === 'PHI').length,
        Operational: functions.filter(f => f.dataSensitivity === 'Operational').length,
        Public: functions.filter(f => f.dataSensitivity === 'Public').length,
        'Demo / Test': functions.filter(f => f.dataSensitivity === 'Demo / Test').length,
        Unknown: functions.filter(f => f.dataSensitivity === 'Unknown').length,
      };
      const highConfidence = functions.filter(f => f.archiveConfidenceScore >= 70).length;

      const buildFunctionRows = (fns: EdgeFunction[]) =>
        fns.map((fn, i) => {
          const rowShading = i % 2 === 0 ? undefined : { type: ShadingType.SOLID, color: 'F5F5F5', fill: 'F5F5F5' };
          return new DocxTableRow({
            children: [
              makeCell(fn.name, 14, { shading: rowShading }),
              makeCell(fn.purpose, 16, { shading: rowShading }),
              makeCell(fn.calledFrom, 12, { shading: rowShading }),
              makeCell(fn.lifecycleStatus, 10, { shading: rowShading }),
              makeCell(fn.invocationPathType, 10, { shading: rowShading }),
              makeCell(fn.dataSensitivity, 8, { shading: rowShading, color: fn.dataSensitivity === 'PHI' ? 'DC2626' : undefined }),
              makeCell(`${fn.archiveConfidenceScore}%`, 6, { shading: rowShading, color: fn.archiveConfidenceScore >= 70 ? '16A34A' : fn.archiveConfidenceScore >= 30 ? 'D97706' : 'DC2626' }),
              makeCell(fn.referencedInClient ? 'Yes' : 'No', 6, { shading: rowShading, color: fn.referencedInClient ? '16A34A' : 'DC2626' }),
              makeCell(fn.archiveRationale, 18, { shading: rowShading }),
            ],
          });
        });

      const headerRow = new DocxTableRow({
        children: [
          makeHeaderCell('Function Name', 14),
          makeHeaderCell('Purpose', 16),
          makeHeaderCell('Called From', 12),
          makeHeaderCell('Lifecycle', 10),
          makeHeaderCell('Path Type', 10),
          makeHeaderCell('Sensitivity', 8),
          makeHeaderCell('Confidence', 6),
          makeHeaderCell('Client Ref', 6),
          makeHeaderCell('Archive Rationale', 18),
        ],
      });

      const archivedHeaderRow = new DocxTableRow({
        children: [
          makeHeaderCell('Function Name', 20),
          makeHeaderCell('Purpose', 30),
          makeHeaderCell('Lifecycle', 15),
          makeHeaderCell('Replacement', 20),
          makeHeaderCell('Rationale', 15),
        ],
      });

      const buildArchivedRows = () =>
        ARCHIVED_FUNCTIONS.map((fn, i) => {
          const rowShading = i % 2 === 0 ? undefined : { type: ShadingType.SOLID, color: 'F5F5F5', fill: 'F5F5F5' };
          return new DocxTableRow({
            children: [
              makeCell(fn.name, 20, { shading: rowShading }),
              makeCell(fn.purpose, 30, { shading: rowShading }),
              makeCell(fn.lifecycleStatus, 15, { shading: rowShading }),
              makeCell(fn.replacementReference || '—', 20, { shading: rowShading }),
              makeCell(fn.archiveRationale.substring(0, 80), 15, { shading: rowShading }),
            ],
          });
        });

      const doc = new Document({
        sections: [{
          properties: {
            page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: 'Edge Function Governance Audit Report', bold: true, size: 32, font: 'Calibri', color: '003087' })],
            }),
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: `Generated: ${reportDate}`, size: 20, font: 'Calibri', color: '666666', italics: true })],
            }),

            // Governance Summary
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
              children: [new TextRun({ text: 'Governance Summary', bold: true, size: 26, font: 'Calibri', color: '003087' })],
            }),
            new Paragraph({ children: [new TextRun({ text: `Total Active Functions: ${stats.total}`, size: 20, font: 'Calibri' })] }),
            new Paragraph({ children: [new TextRun({ text: `Lifecycle — Active: ${lifecycleCounts.ACTIVE}, Dormant: ${lifecycleCounts['DORMANT (retained)']}, Deprecated: ${lifecycleCounts.DEPRECATED}, Archived: ${stats.archived}`, size: 20, font: 'Calibri' })] }),
            new Paragraph({ children: [new TextRun({ text: `Data Sensitivity — PHI: ${sensitivityCounts.PHI}, Operational: ${sensitivityCounts.Operational}, Public: ${sensitivityCounts.Public}, Demo/Test: ${sensitivityCounts['Demo / Test']}, Unknown: ${sensitivityCounts.Unknown}`, size: 20, font: 'Calibri' })] }),
            new Paragraph({
              spacing: { after: 100 },
              children: [new TextRun({ text: `Functions with archive confidence ≥70%: ${highConfidence}`, size: 20, font: 'Calibri', color: highConfidence > 0 ? 'D97706' : '16A34A' })],
            }),

            // All active functions table
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
              children: [new TextRun({ text: `All Active Functions (${functions.length})`, bold: true, size: 26, font: 'Calibri', color: '003087' })],
            }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [headerRow, ...buildFunctionRows(functions)],
            }),

            // Archived functions
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
              children: [new TextRun({ text: `Archived Functions (${ARCHIVED_FUNCTIONS.length})`, bold: true, size: 26, font: 'Calibri', color: '666666' })],
            }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [archivedHeaderRow, ...buildArchivedRows()],
            }),

            // Key
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
              children: [new TextRun({ text: 'Key', bold: true, size: 26, font: 'Calibri', color: '003087' })],
            }),
            new Paragraph({ children: [new TextRun({ text: 'Lifecycle Status: ', bold: true, size: 20, font: 'Calibri' }), new TextRun({ text: 'ACTIVE (in use), DORMANT (no refs but may be external), DEPRECATED (replaced), ARCHIVED (removed from deploy)', size: 20, font: 'Calibri' })] }),
            new Paragraph({ children: [new TextRun({ text: 'Data Sensitivity: ', bold: true, size: 20, font: 'Calibri' }), new TextRun({ text: 'PHI (protected health information), Operational (admin/system), Public (non-clinical), Demo/Test', size: 20, font: 'Calibri' })] }),
            new Paragraph({ children: [new TextRun({ text: 'Archive Confidence: ', bold: true, size: 20, font: 'Calibri' }), new TextRun({ text: '0-100% score indicating safety of archival. ≥70% = suitable, 30-69% = review needed, <30% = not suitable', size: 20, font: 'Calibri' })] }),
            new Paragraph({
              spacing: { before: 200 },
              children: [new TextRun({ text: 'This report is advisory only. No functions have been deleted, disabled, or archived as a result of this audit.', size: 20, font: 'Calibri', italics: true, color: '666666' })],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const filename = `edge-function-governance-audit-${now.toISOString().split('T')[0]}.docx`;
      saveAs(blob, filename);
      toast.success('Governance report downloaded successfully');
    } catch (err) {
      console.error('Error generating report:', err);
      toast.error('Failed to generate report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.clientReferenced}</div>
            <div className="text-xs text-muted-foreground">Client Ref</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.functionReferenced}</div>
            <div className="text-xs text-muted-foreground">Cross-Ref</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.unreferenced}</div>
            <div className="text-xs text-muted-foreground">Unreferenced</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-amber-500">{stats.deprecated}</div>
            <div className="text-xs text-muted-foreground">Deprecated</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-slate-500">{stats.dormant}</div>
            <div className="text-xs text-muted-foreground">Dormant</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.archived}</div>
            <div className="text-xs text-muted-foreground">Archived</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Primary Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, purpose, or calling page..."
            value={filters.searchQuery}
            onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="pl-10"
          />
        </div>
        <Select value={filters.referenceFilter} onValueChange={(v) => setFilters(prev => ({ ...prev, referenceFilter: v as ReferenceFilterType }))}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Functions</SelectItem>
            <SelectItem value="referenced">Referenced</SelectItem>
            <SelectItem value="unreferenced">Unreferenced</SelectItem>
            <SelectItem value="no-client-ref">No Client Ref</SelectItem>
            <SelectItem value="no-function-ref">No Cross-Ref</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={batchScanUnreferenced} disabled={batchScanning} className="whitespace-nowrap">
          {batchScanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
          Batch Scan
        </Button>
        <Button variant="outline" onClick={downloadWordReport} className="whitespace-nowrap">
          <Download className="h-4 w-4 mr-2" />
          Report
        </Button>
      </div>

      {/* Advanced Governance Filters */}
      <Collapsible open={advancedFiltersOpen} onOpenChange={setAdvancedFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Advanced Governance Filters
            {advancedFiltersOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 border rounded-lg bg-muted/30 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Lifecycle Status</label>
              <Select value={filters.lifecycleFilter} onValueChange={(v) => setFilters(prev => ({ ...prev, lifecycleFilter: v as LifecycleStatus | 'all' }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="DORMANT (retained)">Dormant</SelectItem>
                  <SelectItem value="DEPRECATED">Deprecated</SelectItem>
                  <SelectItem value="DEPRECATED (still in use)">Deprecated (in use)</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Path Type</label>
              <Select value={filters.pathTypeFilter} onValueChange={(v) => setFilters(prev => ({ ...prev, pathTypeFilter: v as InvocationPathType | 'all' }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="UI-triggered">UI-triggered</SelectItem>
                  <SelectItem value="Edge-to-Edge">Edge-to-Edge</SelectItem>
                  <SelectItem value="Webhook (external)">Webhook</SelectItem>
                  <SelectItem value="Cron / background">Cron / Background</SelectItem>
                  <SelectItem value="One-off seed / migration">One-off Seed</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Sensitivity</label>
              <Select value={filters.sensitivityFilter} onValueChange={(v) => setFilters(prev => ({ ...prev, sensitivityFilter: v as DataSensitivity | 'all' }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="PHI">PHI</SelectItem>
                  <SelectItem value="Operational">Operational</SelectItem>
                  <SelectItem value="Public">Public</SelectItem>
                  <SelectItem value="Demo / Test">Demo / Test</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Confidence ≥ {filters.confidenceThreshold}%
              </label>
              <div className="pt-2 px-1">
                <Slider
                  value={[filters.confidenceThreshold]}
                  onValueChange={([v]) => setFilters(prev => ({ ...prev, confidenceThreshold: v }))}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active Functions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Functions ({filteredFunctions.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[28px]"></TableHead>
                  <TableHead className="w-[180px]">Function Name</TableHead>
                  <TableHead className="hidden lg:table-cell">Purpose</TableHead>
                  <TableHead className="w-[160px] hidden md:table-cell">Called From</TableHead>
                  <TableHead className="w-[110px]">Lifecycle</TableHead>
                  <TableHead className="w-[110px] hidden lg:table-cell">Path Type</TableHead>
                  <TableHead className="w-[90px]">Sensitivity</TableHead>
                  <TableHead className="w-[60px] text-center">Conf.</TableHead>
                  <TableHead className="w-[50px] text-center">Client</TableHead>
                  <TableHead className="w-[50px] text-center hidden md:table-cell">Cross</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFunctions.map((fn) => (
                  <React.Fragment key={fn.name}>
                    <TableRow
                      className={`${getRowClass(fn)} cursor-pointer hover:bg-muted/60`}
                      onClick={() => setExpandedRow(expandedRow === fn.name ? null : fn.name)}
                    >
                      <TableCell className="px-2 py-2">
                        {expandedRow === fn.name
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </TableCell>
                      <TableCell className="font-mono text-xs py-2">{fn.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2 hidden lg:table-cell max-w-[200px] truncate">{fn.purpose}</TableCell>
                      <TableCell className="py-2 hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px] font-normal whitespace-nowrap">
                          {fn.calledFrom}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${lifecycleBadgeStyles[fn.lifecycleStatus]}`}>
                          {fn.lifecycleStatus === 'DEPRECATED (still in use)' ? 'DEPR. (in use)' : fn.lifecycleStatus}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 hidden lg:table-cell">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${pathTypeBadgeStyles[fn.invocationPathType]}`}>
                          {fn.invocationPathType}
                        </span>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${sensitivityBadgeStyles[fn.dataSensitivity]}`}>
                          {fn.dataSensitivity}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <span className={`text-xs font-semibold ${getConfidenceColor(fn.archiveConfidenceScore)}`}>
                          {fn.archiveConfidenceScore}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        {fn.referencedInClient
                          ? <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" />
                          : <XCircle className="h-3.5 w-3.5 text-red-400 mx-auto" />
                        }
                      </TableCell>
                      <TableCell className="text-center py-2 hidden md:table-cell">
                        {fn.referencedInOtherFunctions
                          ? <CheckCircle className="h-3.5 w-3.5 text-blue-600 mx-auto" />
                          : <span className="text-muted-foreground text-xs">—</span>
                        }
                      </TableCell>
                    </TableRow>
                    {expandedRow === fn.name && (
                      <EdgeFunctionExpandedRow fn={fn} onCheckLogs={checkLogs} />
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Archived Functions */}
      <CollapsibleCard
        title={`Archived Functions (${filteredArchived.length})`}
        icon={<Archive className="h-5 w-5" />}
        defaultOpen={false}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Function Name</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead className="w-[110px]">Lifecycle</TableHead>
              <TableHead className="w-[160px]">Replacement</TableHead>
              <TableHead className="w-[60px] text-center">Conf.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredArchived.map((fn) => (
              <TableRow key={fn.name} className="opacity-70">
                <TableCell className="font-mono text-xs">{fn.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fn.purpose}</TableCell>
                <TableCell>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${lifecycleBadgeStyles[fn.lifecycleStatus]}`}>
                    {fn.lifecycleStatus}
                  </span>
                </TableCell>
                <TableCell>
                  {fn.replacementExists ? (
                    <Badge variant="outline" className="font-mono text-[10px]">{fn.replacementReference}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <span className={`text-xs font-semibold ${getConfidenceColor(fn.archiveConfidenceScore)}`}>
                    {fn.archiveConfidenceScore}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleCard>

      {/* Legend */}
      <div className="p-3 border rounded-lg space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Legend</h4>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Lifecycle Status</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(lifecycleBadgeStyles) as LifecycleStatus[]).map(status => (
              <span key={status} className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${lifecycleBadgeStyles[status]}`}>
                {status}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Invocation Path Type</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(pathTypeBadgeStyles) as InvocationPathType[]).map(type => (
              <span key={type} className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${pathTypeBadgeStyles[type]}`}>
                {type}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Data Sensitivity</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(sensitivityBadgeStyles) as DataSensitivity[]).map(s => (
              <span key={s} className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${sensitivityBadgeStyles[s]}`}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Confidence Score</div>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-green-700 dark:text-green-400 font-medium">≥70% Suitable for archival</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">30-69% Review recommended</span>
            <span className="text-red-600 dark:text-red-400 font-medium">&lt;30% Not suitable</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic pt-1">
          This view is advisory only. No functions have been deleted, disabled, or archived.
        </p>
      </div>
    </div>
  );
};
