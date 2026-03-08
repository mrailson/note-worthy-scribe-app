import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, X, Loader2, ImageIcon, Monitor, ArrowLeft } from 'lucide-react';
import { DocumentAIEditPanel } from '@/components/shared/DocumentAIEditPanel';
import { useDocumentPreviewPrefs, type LogoPosition } from '@/hooks/useDocumentPreviewPrefs';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useContentInfographic } from '@/hooks/useContentInfographic';
import { cn } from '@/lib/utils';
import { showToast } from '@/utils/toastWrapper';
import { useIsMobile } from '@/hooks/use-mobile';

interface DocumentPreviewModalProps {
  content: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  imageGenerationModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
  infographicPracticeName?: string;
  infographicSpellingCorrections?: { incorrect: string; correct: string }[];
  onContentUpdated?: (newContent: string) => void;
}

// Extract a sensible title from content
function extractTitle(content: string, fallback: string = 'AI Generated Document'): string {
  const headingMatch = content.match(/^#{1,4}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].replace(/\*\*/g, '').trim();

  const boldMatch = content.match(/\*\*([^*]+)\*\*/);
  if (boldMatch) return boldMatch[1].trim();

  const firstLine = content.split('\n').find(l => l.trim().length > 0);
  if (firstLine && firstLine.trim().length < 80) return firstLine.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();

  return fallback;
}

const COLORS = {
  nhsBlue: '#005EB8',
  headingBlue: '#1E3A8A',
  subHeadingBlue: '#2563EB',
  textGrey: '#374151',
  lightGrey: '#6B7280',
  tableBorder: '#D1D5DB',
  tableHeaderBg: '#EFF6FF',
};

const INFOGRAPHIC_TIPS = [
  'Analysing content structure…',
  'Extracting key points…',
  'Designing visual layout…',
  'Applying colour palette…',
  'Rendering infographic…',
  'Adding finishing touches…',
  'Nearly there…',
];

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

    // Horizontal rules — skip entirely
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushList();
      continue;
    }

    // Headings — most specific first
    if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(<h4 key={`h4-${keyIndex++}`} className="text-sm font-semibold mt-3 mb-1" style={{ color: COLORS.subHeadingBlue }}>{formatInline(trimmed.slice(5))}</h4>);
      continue;
    }
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
      <p key={`p-${keyIndex++}`} className="text-sm leading-relaxed mb-4" style={{ color: COLORS.textGrey }}>
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
  imageGenerationModel = 'google/gemini-2.5-flash-image-preview',
  infographicPracticeName,
  infographicSpellingCorrections,
  onContentUpdated,
}) => {
  const { prefs, updatePref } = useDocumentPreviewPrefs();
  const { practiceContext } = usePracticeContext();
  const isMobile = useIsMobile();
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showAIEdit, setShowAIEdit] = useState(false);
  const [editableContent, setEditableContent] = useState<string | null>(null);

  const activeContent = editableContent ?? content;
  const documentTitle = externalTitle || extractTitle(activeContent);
  const [infographicView, setInfographicView] = useState<'document' | 'infographic'>('document');
  const [infographicUrl, setInfographicUrl] = useState<string | null>(null);
  const [infographicProgress, setInfographicProgress] = useState(0);
  const [infographicTipIdx, setInfographicTipIdx] = useState(0);
  const [infographicFullscreen, setInfographicFullscreen] = useState(false);
  const { generateInfographic, isGenerating: isInfographicGenerating, currentPhase, error: infographicError } = useContentInfographic();

  // documentTitle already declared above with activeContent
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

  const logoAlignmentClass = {
    left: 'justify-start',
    center: 'justify-center',
    centre: 'justify-center',
    right: 'justify-end',
  }[prefs.logoPosition] || 'justify-start';

  const previewElements = useMemo(() => renderPreviewContent(activeContent), [activeContent]);

  const handleContentUpdated = useCallback((newContent: string) => {
    setEditableContent(newContent);
    onContentUpdated?.(newContent);
  }, [onContentUpdated]);

  // Reset infographic state when modal closes
  const handleClose = useCallback(() => {
    setInfographicView('document');
    setInfographicUrl(null);
    setInfographicProgress(0);
    setInfographicFullscreen(false);
    setShowAIEdit(false);
    setEditableContent(null);
    onClose();
  }, [onClose]);

  // Escape key closes fullscreen lightbox
  useEffect(() => {
    if (!infographicFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setInfographicFullscreen(false);
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [infographicFullscreen]);

  const handleDownloadWord = async () => {
    setIsDownloadingWord(true);
    try {
      const { generateCleanAIResponseDocument } = await import('@/utils/cleanWordExport');
      const docxLogoPosition = prefs.logoPosition === 'centre' ? 'center' : prefs.logoPosition;
      await generateCleanAIResponseDocument(activeContent, documentTitle, {
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
      const pdfLogoPosition = prefs.logoPosition === 'centre' ? 'center' : prefs.logoPosition;
      await generatePDF(content, documentTitle, {
        logoUrl: prefs.showLogo ? logoUrl : undefined,
        logoPosition: pdfLogoPosition as 'left' | 'center' | 'right',
        footerNote: prefs.showFooter && practiceName
          ? `${practiceName}${practiceAddress ? ' • ' + practiceAddress : ''}`
          : 'Generated by Notewell AI',
      });
      showToast.success('PDF downloaded', { section: 'ai4gp' });
    } catch (error) {
      console.error('PDF export failed:', error);
      showToast.error('Failed to download PDF', { section: 'ai4gp' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleGenerateInfographic = useCallback(async (orientation: 'landscape' | 'portrait') => {
    setInfographicView('infographic');
    setInfographicUrl(null);
    setInfographicProgress(0);
    setInfographicTipIdx(0);

    // Start progress simulation
    const progressInterval = setInterval(() => {
      setInfographicProgress(prev => {
        if (prev >= 92) { clearInterval(progressInterval); return prev; }
        return prev + 4;
      });
    }, 1500);

    const tipInterval = setInterval(() => {
      setInfographicTipIdx(prev => (prev + 1) % INFOGRAPHIC_TIPS.length);
    }, 3000);

    try {
      const result = await generateInfographic(content, documentTitle, {
        orientation,
        imageModel: imageGenerationModel,
        practiceName: infographicPracticeName || practiceName || undefined,
        spellingCorrections: infographicSpellingCorrections,
      });

      clearInterval(progressInterval);
      clearInterval(tipInterval);
      setInfographicProgress(100);

      if (result?.success && result.imageUrl) {
        setInfographicUrl(result.imageUrl);
      }
    } catch {
      clearInterval(progressInterval);
      clearInterval(tipInterval);
      setInfographicProgress(0);
    }
  }, [content, documentTitle, generateInfographic, imageGenerationModel, infographicPracticeName, infographicSpellingCorrections, practiceName]);

  const handleDownloadInfographic = useCallback(() => {
    if (!infographicUrl) return;
    const link = document.createElement('a');
    link.href = infographicUrl;
    link.download = `${documentTitle.replace(/[^a-zA-Z0-9]/g, '_')}_infographic.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Infographic downloaded', { section: 'ai4gp' });
  }, [infographicUrl, documentTitle]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Top bar */}
        <div className="px-4 sm:px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-sm sm:text-base truncate">{documentTitle}</h2>
              <p className="text-xs text-muted-foreground">
                {practiceName && `${practiceName} • `}{today} at {timeNow}
              </p>
            </div>
          </div>
        </div>

        {/* Controls bar — only for document view */}
        {infographicView === 'document' && (
          <div className="px-4 sm:px-6 py-3 border-b bg-muted/20">
            <div className={cn("flex flex-wrap items-center gap-4", isMobile && "gap-3")}>
              <div className="flex items-center gap-2">
                <Switch id="doc-show-logo" checked={prefs.showLogo} onCheckedChange={(v) => updatePref('showLogo', v)} />
                <Label htmlFor="doc-show-logo" className="text-xs sm:text-sm cursor-pointer">Logo</Label>
              </div>
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
              <div className="flex items-center gap-2">
                <Switch id="doc-show-footer" checked={prefs.showFooter} onCheckedChange={(v) => updatePref('showFooter', v)} />
                <Label htmlFor="doc-show-footer" className="text-xs sm:text-sm cursor-pointer">Footer</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="doc-show-pages" checked={prefs.showPageNumbers} onCheckedChange={(v) => updatePref('showPageNumbers', v)} />
                <Label htmlFor="doc-show-pages" className="text-xs sm:text-sm cursor-pointer">Page Numbers</Label>
              </div>
            </div>
          </div>
        )}

        {/* Infographic back bar */}
        {infographicView === 'infographic' && !isInfographicGenerating && (
          <div className="px-4 sm:px-6 py-2 border-b bg-muted/20">
            <Button variant="ghost" size="sm" onClick={() => setInfographicView('document')} className="gap-2 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Document
            </Button>
          </div>
        )}

        {/* Live preview / infographic area — plain div for reliable scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-accent/10">
          {infographicView === 'document' ? (
            <div className="p-4 sm:p-6">
              <div
                className="bg-white dark:bg-card rounded-lg shadow-sm border mx-auto"
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
                <h1 className="text-center font-bold mb-4" style={{ fontSize: '22px', color: COLORS.nhsBlue }}>
                  {documentTitle}
                </h1>

                {/* Date */}
                <p className="text-center text-xs mb-6" style={{ color: COLORS.lightGrey }}>
                  {today} at {timeNow}
                </p>

                {/* Content */}
                <div className="space-y-2">
                  {previewElements}
                </div>

                {/* Footer */}
                {(prefs.showFooter || prefs.showPageNumbers) && (
                  <div className="mt-8 pt-4 border-t flex items-center justify-between text-xs" style={{ color: COLORS.lightGrey }}>
                    {prefs.showFooter ? (
                      <div>
                        {practiceName && <p className="font-medium">{practiceName}</p>}
                        {practiceAddress && <p>{practiceAddress}</p>}
                        <p className="mt-1 italic">Generated by Notewell AI</p>
                      </div>
                    ) : <div />}
                    {prefs.showPageNumbers && (
                      <div className="text-right">Page 1 of 1</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Infographic view */
            <div className="p-4 sm:p-6 flex flex-col items-center justify-center min-h-[300px]">
              {isInfographicGenerating ? (
                <div className="w-full max-w-md text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
                    <ImageIcon className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                  <h3 className="font-semibold text-base">Creating Infographic</h3>
                  <Progress value={infographicProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground animate-pulse">
                    {INFOGRAPHIC_TIPS[infographicTipIdx]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This may take up to 2 minutes
                  </p>
                </div>
              ) : infographicError ? (
                <div className="text-center space-y-3">
                  <p className="text-sm text-destructive">{infographicError}</p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={() => setInfographicView('document')}>
                      Back to Document
                    </Button>
                    <Button size="sm" onClick={() => handleGenerateInfographic('landscape')}>
                      Retry Landscape
                    </Button>
                    <Button size="sm" onClick={() => handleGenerateInfographic('portrait')}>
                      Retry Portrait
                    </Button>
                  </div>
                </div>
              ) : infographicUrl ? (
                <div className="w-full flex flex-col items-center gap-4">
                  <img
                    src={infographicUrl}
                    alt="Generated infographic"
                    className="max-w-full rounded-lg shadow-md border cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ maxHeight: '60vh' }}
                    onClick={() => setInfographicFullscreen(true)}
                    title="Click to view fullscreen"
                  />
                  <Button onClick={handleDownloadInfographic} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download Infographic
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="px-4 sm:px-6 py-3 border-t bg-muted/30 flex flex-wrap items-center gap-2">
          {infographicView === 'document' ? (
            <>
              <Button onClick={handleDownloadWord} disabled={isDownloadingWord} className="gap-2">
                {isDownloadingWord ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Word
              </Button>
              <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="gap-2">
                {isDownloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>

              <div className="h-6 w-px bg-border mx-1" />

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerateInfographic('landscape')}
                disabled={isInfographicGenerating}
                className="gap-2 text-xs"
              >
                <Monitor className="h-4 w-4" />
                Infographic (Landscape)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerateInfographic('portrait')}
                disabled={isInfographicGenerating}
                className="gap-2 text-xs"
              >
                <ImageIcon className="h-4 w-4" />
                Infographic (Portrait)
              </Button>

              <Button variant="ghost" onClick={handleClose} className="ml-auto">
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setInfographicView('document')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Document
              </Button>
              {infographicUrl && (
                <Button onClick={handleDownloadInfographic} className="gap-2 ml-auto">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              )}
              {!infographicUrl && !isInfographicGenerating && (
                <Button variant="ghost" onClick={handleClose} className="ml-auto">
                  Cancel
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>

      {/* Fullscreen infographic lightbox */}
      {infographicFullscreen && infographicUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center cursor-pointer"
          onClick={() => setInfographicFullscreen(false)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadInfographic();
              }}
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setInfographicFullscreen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
          <img
            src={infographicUrl}
            alt="Infographic fullscreen"
            className="max-w-[95vw] max-h-[95vh] object-contain select-none"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
            Click backdrop or <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">Esc</kbd> to close
          </div>
        </div>
      )}
    </Dialog>
  );
};