import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText, X, Loader2 } from 'lucide-react';
import { useDocumentPreviewPrefs, type LogoPosition } from '@/hooks/useDocumentPreviewPrefs';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { cn } from '@/lib/utils';
import { showToast } from '@/utils/toastWrapper';
import { useIsMobile } from '@/hooks/use-mobile';

interface DocumentPreviewModalProps {
  content: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Extract a sensible title from content
function extractTitle(content: string, fallback: string = 'AI Generated Document'): string {
  // Try first markdown heading
  const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].replace(/\*\*/g, '').trim();

  // Try first bold text
  const boldMatch = content.match(/\*\*([^*]+)\*\*/);
  if (boldMatch) return boldMatch[1].trim();

  // First non-empty line
  const firstLine = content.split('\n').find(l => l.trim().length > 0);
  if (firstLine && firstLine.trim().length < 80) return firstLine.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();

  return fallback;
}

// Minimal markdown-to-HTML for preview (reuses the same visual approach as PolicyDocumentPreview)
const COLORS = {
  nhsBlue: '#005EB8',
  headingBlue: '#1E3A8A',
  subHeadingBlue: '#2563EB',
  textGrey: '#374151',
  lightGrey: '#6B7280',
  tableBorder: '#D1D5DB',
  tableHeaderBg: '#EFF6FF',
};

function renderPreviewContent(content: string): React.ReactNode[] {
  const cleaned = content
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/^html\s*/i, '')
    .replace(/\s*```[a-z]*\s*$/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();

  const lines = cleaned.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let tableLines: string[] = [];
  let inTable = false;
  let keyIndex = 0;

  const formatInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return <strong key={i}>{p.slice(2, -2)}</strong>;
      }
      return p.replace(/\*([^*]+)\*/g, '$1');
    });
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${keyIndex++}`} className="list-disc list-inside space-y-1 mb-3 ml-4">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed" style={{ color: COLORS.textGrey }}>
              {formatInline(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableLines.length < 2) { tableLines = []; inTable = false; return; }
    const rows = tableLines
      .filter(l => !/^[\s|:-]+$/.test(l.replace(/\|/g, '').trim()) || !l.includes('-'))
      .map(l => l.split('|').map(c => c.trim()).filter(c => c.length > 0));
    const dataRows = rows.filter(r => !r.every(c => /^[-:]+$/.test(c)));
    if (dataRows.length > 0) {
      elements.push(
        <div key={`table-${keyIndex++}`} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {dataRows[0]?.map((cell, i) => (
                  <th key={i} className="border px-3 py-2 text-left font-semibold" style={{ borderColor: COLORS.tableBorder, backgroundColor: COLORS.tableHeaderBg }}>
                    {formatInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.slice(1).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border px-3 py-2" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>
                      {formatInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableLines = [];
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) { flushList(); flushTable(); continue; }

    // Table lines
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      inTable = true;
      tableLines.push(trimmed);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={`h3-${keyIndex++}`} className="text-base font-semibold mt-4 mb-2" style={{ color: COLORS.subHeadingBlue }}>{formatInline(trimmed.slice(4))}</h3>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={`h2-${keyIndex++}`} className="text-lg font-bold mt-5 mb-2" style={{ color: COLORS.subHeadingBlue }}>{formatInline(trimmed.slice(3))}</h2>);
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(<h1 key={`h1-${keyIndex++}`} className="text-xl font-bold mt-6 mb-3" style={{ color: COLORS.headingBlue }}>{formatInline(trimmed.slice(2))}</h1>);
      continue;
    }

    // Bullets
    if (/^[-•*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-•*]\s+/, ''));
      continue;
    }

    // Numbered headings (e.g. "1. PURPOSE")
    const numberedHeading = trimmed.match(/^(\d+)\.\s+([A-Z][A-Z\s]+)$/);
    if (numberedHeading) {
      flushList();
      elements.push(<h2 key={`nh-${keyIndex++}`} className="text-lg font-bold mt-5 mb-2" style={{ color: COLORS.headingBlue }}>{trimmed}</h2>);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${keyIndex++}`} className="text-sm leading-relaxed mb-3" style={{ color: COLORS.textGrey }}>
        {formatInline(trimmed)}
      </p>
    );
  }

  flushList();
  flushTable();
  return elements;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  content,
  title: externalTitle,
  isOpen,
  onClose,
}) => {
  const { prefs, updatePref } = useDocumentPreviewPrefs();
  const { practiceContext } = usePracticeContext();
  const isMobile = useIsMobile();
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const documentTitle = externalTitle || extractTitle(content);
  const logoUrl = practiceContext?.logoUrl;
  const practiceName = practiceContext?.practiceName;
  const practiceAddress = practiceContext?.practiceAddress;

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeNow = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Map 'centre' to 'center' for CSS/docx compatibility
  const cssLogoPosition = prefs.logoPosition === 'centre' ? 'center' : prefs.logoPosition;
  const logoAlignmentClass = {
    left: 'justify-start',
    center: 'justify-center',
    centre: 'justify-center',
    right: 'justify-end',
  }[prefs.logoPosition] || 'justify-start';

  const previewElements = useMemo(() => renderPreviewContent(content), [content]);

  const handleDownloadWord = async () => {
    setIsDownloadingWord(true);
    try {
      const { generateCleanAIResponseDocument } = await import('@/utils/cleanWordExport');
      const docxLogoPosition = prefs.logoPosition === 'centre' ? 'center' : prefs.logoPosition;
      await generateCleanAIResponseDocument(content, documentTitle, {
        logoUrl: prefs.showLogo ? logoUrl : undefined,
        logoPosition: docxLogoPosition as 'left' | 'center' | 'right',
        footerNote: prefs.showFooter && practiceName
          ? `${practiceName}${practiceAddress ? ' • ' + practiceAddress : ''}`
          : 'Generated by Notewell AI',
      });
      showToast.success('Word document downloaded', { section: 'ai4gp' });
    } catch (error) {
      console.error('Word export failed:', error);
      showToast.error('Failed to download Word document', { section: 'ai4gp' });
    } finally {
      setIsDownloadingWord(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const { generatePDF } = await import('@/utils/documentGenerators');
      generatePDF(content, documentTitle);
      showToast.success('PDF downloaded', { section: 'ai4gp' });
    } catch (error) {
      console.error('PDF export failed:', error);
      showToast.error('Failed to download PDF', { section: 'ai4gp' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Top bar */}
        <div className="px-4 sm:px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-sm sm:text-base truncate">{documentTitle}</h2>
              <p className="text-xs text-muted-foreground">
                {practiceName && `${practiceName} • `}{today} at {timeNow}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Controls bar */}
        <div className="px-4 sm:px-6 py-3 border-b bg-muted/20">
          <div className={cn("flex flex-wrap items-center gap-4", isMobile && "gap-3")}>
            {/* Logo toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="doc-show-logo"
                checked={prefs.showLogo}
                onCheckedChange={(v) => updatePref('showLogo', v)}
              />
              <Label htmlFor="doc-show-logo" className="text-xs sm:text-sm cursor-pointer">Logo</Label>
            </div>

            {/* Logo position */}
            {prefs.showLogo && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Position</Label>
                <Select value={prefs.logoPosition} onValueChange={(v) => updatePref('logoPosition', v as LogoPosition)}>
                  <SelectTrigger className="h-7 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="centre">Centre</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Footer toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="doc-show-footer"
                checked={prefs.showFooter}
                onCheckedChange={(v) => updatePref('showFooter', v)}
              />
              <Label htmlFor="doc-show-footer" className="text-xs sm:text-sm cursor-pointer">Footer</Label>
            </div>

            {/* Page numbers toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="doc-show-pages"
                checked={prefs.showPageNumbers}
                onCheckedChange={(v) => updatePref('showPageNumbers', v)}
              />
              <Label htmlFor="doc-show-pages" className="text-xs sm:text-sm cursor-pointer">Page Numbers</Label>
            </div>
          </div>
        </div>

        {/* Live preview area */}
        <ScrollArea className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-900">
          <div className="p-4 sm:p-6">
            <div
              className="bg-white rounded-lg shadow-sm border mx-auto"
              style={{
                fontFamily: 'Calibri, sans-serif',
                padding: isMobile ? '24px' : '40px',
                maxWidth: '210mm',
              }}
            >
              {/* Logo */}
              {prefs.showLogo && logoUrl && (
                <div className={cn('flex mb-6', logoAlignmentClass)}>
                  <img src={logoUrl} alt="Practice Logo" className="max-h-16 object-contain" />
                </div>
              )}

              {/* Document title */}
              <h1
                className="text-center font-bold mb-4"
                style={{ fontSize: '22px', color: COLORS.nhsBlue }}
              >
                {documentTitle}
              </h1>

              {/* Date */}
              <p className="text-center text-xs mb-6" style={{ color: COLORS.lightGrey }}>
                {today} at {timeNow}
              </p>

              {/* Content */}
              <div className="space-y-1">
                {previewElements}
              </div>

              {/* Footer */}
              {(prefs.showFooter || prefs.showPageNumbers) && (
                <div className="mt-8 pt-4 border-t flex items-center justify-between text-xs" style={{ color: COLORS.lightGrey }}>
                  {prefs.showFooter && (
                    <div>
                      {practiceName && <p className="font-medium">{practiceName}</p>}
                      {practiceAddress && <p>{practiceAddress}</p>}
                      <p className="mt-1 italic">Generated by Notewell AI</p>
                    </div>
                  )}
                  {!prefs.showFooter && <div />}
                  {prefs.showPageNumbers && (
                    <div className="text-right">Page 1 of 1</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Bottom actions */}
        <div className="px-4 sm:px-6 py-3 border-t bg-muted/30 flex flex-wrap items-center gap-2">
          <Button onClick={handleDownloadWord} disabled={isDownloadingWord} className="gap-2">
            {isDownloadingWord ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Download as Word
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="gap-2">
            {isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download as PDF
          </Button>
          <Button variant="ghost" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
