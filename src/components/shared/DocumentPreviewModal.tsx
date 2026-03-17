import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, X, Loader2, ImageIcon, Monitor, Settings2, Presentation, BarChart3 } from 'lucide-react';
import { DocumentAIEditPanel } from '@/components/shared/DocumentAIEditPanel';
import { AskAIDocumentSettingsModal } from '@/components/shared/AskAIDocumentSettingsModal';
import { useDocumentPreviewPrefs, type LogoPosition } from '@/hooks/useDocumentPreviewPrefs';
import { useAskAIExportDefaults } from '@/hooks/useAskAIExportDefaults';
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
  onExportPowerPoint?: (content: string, title?: string, slideCount?: number, imageMode?: string, textDensity?: string) => void;
  isPowerPointGenerating?: boolean;
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

const PPTX_TIPS = [
  'Preparing slide structure…',
  'Formatting content for slides…',
  'Applying presentation theme…',
  'Building visual layout…',
  'Adding headings and sections…',
  'Finalising presentation…',
  'Nearly there…',
];

// Known metadata labels for meeting minutes header detection
const METADATA_LABELS = /^(Meeting Title|Date|Time|Location|Venue|Attendees|Present|Apologies|Chair|Chairperson|Minutes By|Secretary|Distribution|Ref|Reference|Meeting Type):\s*/i;

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

  // ── First pass: extract meeting metadata from preamble lines ──
  const metadataRows: { label: string; value: string }[] = [];
  const preambleHeadings: string[] = [];
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Stop scanning preamble when we hit a numbered item or markdown heading
    if (/^\d+\.\s+/.test(trimmed) || /^#{1,4}\s+/.test(trimmed)) {
      bodyStartIndex = i;
      break;
    }

    // Detect "Label: Value" metadata lines
    const metaMatch = trimmed.match(METADATA_LABELS);
    if (metaMatch) {
      const label = metaMatch[1];
      const value = trimmed.slice(metaMatch[0].length).trim();
      metadataRows.push({ label, value });
      bodyStartIndex = i + 1;
      continue;
    }

    // If previous metadata row had an empty value, subsequent non-metadata lines are its continuation
    if (metadataRows.length > 0 && trimmed && !METADATA_LABELS.test(trimmed)) {
      const last = metadataRows[metadataRows.length - 1];
      if (last.value === '' || /^(Dr |Mr |Mrs |Ms |Prof |Sister |Nurse |[A-Z][a-z]+ [A-Z])/.test(trimmed)) {
        last.value = last.value ? `${last.value}, ${trimmed}` : trimmed;
        bodyStartIndex = i + 1;
        continue;
      }
    }

    // Non-metadata preamble lines (practice name, document title, date)
    if (trimmed) {
      preambleHeadings.push(trimmed);
      bodyStartIndex = i + 1;
    }
  }

  // Render preamble headings (practice name, title, date)
  preambleHeadings.forEach((heading, i) => {
    if (i === 0) {
      elements.push(
        <h1 key={`ph-${keyIndex++}`} className="text-xl font-bold mb-1" style={{ color: COLORS.headingBlue }}>
          {formatInline(heading.replace(/^#+\s*/, '').replace(/\*\*/g, ''))}
        </h1>
      );
    } else if (i === 1) {
      elements.push(
        <h2 key={`ph-${keyIndex++}`} className="text-lg font-semibold mb-1" style={{ color: COLORS.subHeadingBlue }}>
          {formatInline(heading.replace(/^#+\s*/, '').replace(/\*\*/g, ''))}
        </h2>
      );
    } else {
      elements.push(
        <p key={`ph-${keyIndex++}`} className="text-sm mb-1" style={{ color: COLORS.lightGrey }}>
          {formatInline(heading)}
        </p>
      );
    }
  });

  // Render metadata table if we found any
  if (metadataRows.length > 0) {
    elements.push(
      <div key={`meta-table-${keyIndex++}`} className="my-4 overflow-x-auto rounded-lg border" style={{ borderColor: COLORS.tableBorder }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th colSpan={2} className="px-4 py-2.5 text-left text-sm font-semibold text-white" style={{ backgroundColor: COLORS.nhsBlue }}>
                Meeting Details
              </th>
            </tr>
          </thead>
          <tbody>
            {metadataRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? '' : ''} style={{ backgroundColor: ri % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                <td className="border-t px-4 py-2.5 font-semibold align-top w-[180px]" style={{ borderColor: COLORS.tableBorder, color: COLORS.headingBlue }}>
                  {row.label}
                </td>
                <td className="border-t px-4 py-2.5" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>
                  {formatInline(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    // Separator after metadata
    elements.push(
      <hr key={`meta-sep-${keyIndex++}`} className="my-4" style={{ borderColor: COLORS.tableBorder }} />
    );
  }

  // ── Second pass: render body lines from bodyStartIndex onwards ──
  for (let i = bodyStartIndex; i < lines.length; i++) {
    const line = lines[i];
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

    // Numbered headings (e.g. "1. PURPOSE" or "1. Welcome, Apologies and Declarations")
    const numberedHeading = trimmed.match(/^(\d+)\.\s+([A-Z].{2,})$/);
    if (numberedHeading) {
      flushList();
      elements.push(
        <div key={`nh-${keyIndex++}`} className="mt-6 mb-3 pl-3 py-2" style={{ borderLeft: `4px solid ${COLORS.nhsBlue}` }}>
          <h2 className="text-base font-bold" style={{ color: COLORS.headingBlue }}>
            {numberedHeading[1]}. {formatInline(numberedHeading[2])}
          </h2>
        </div>
      );
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

/** Fullscreen infographic overlay – fixes click/Esc issues by being a self-contained component with its own event listeners */
const InfographicFullscreen: React.FC<{
  infographicUrl: string;
  onClose: () => void;
  onDownload: () => void;
}> = ({ infographicUrl, onClose, onDownload }) => {
  // Own Esc handler so Dialog doesn't swallow it
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handle, true); // capture phase
    return () => document.removeEventListener('keydown', handle, true);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      {/* Block all Radix Dialog layers underneath */}
      <style>{`
        [data-radix-dialog-overlay],
        [data-radix-dialog-content] {
          pointer-events: none !important;
          visibility: hidden !important;
        }
      `}</style>
      <div
        className="fixed inset-0 bg-black/95 flex items-center justify-center cursor-pointer"
        style={{ zIndex: 2147483647, pointerEvents: 'auto' }}
        onClick={onClose}
        role="dialog"
        aria-label="Infographic fullscreen view"
      >
        {/* Controls */}
        <div
          className="absolute top-4 right-4 flex items-center gap-2"
          style={{ zIndex: 2147483647 }}
        >
          <button
            type="button"
            className="p-2 rounded-full text-white hover:bg-white/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            aria-label="Download infographic"
          >
            <Download className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="p-2 rounded-full text-white hover:bg-white/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close fullscreen"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Image – clicking it also closes (natural flow) */}
        <img
          src={infographicUrl}
          alt="Infographic fullscreen"
          className="max-w-[95vw] max-h-[95vh] object-contain select-none cursor-pointer"
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        />

        {/* Hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm pointer-events-none">
          Click image or backdrop to close • <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">Esc</kbd> to close
        </div>
      </div>
    </>
  );
};
// Inline infographic selector with slide-reveal orientation options
const InfographicSelector: React.FC<{
  isGenerating: boolean;
  onGenerate: (orientation: 'landscape' | 'portrait') => void;
}> = ({ isGenerating, onGenerate }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex items-center gap-0">
      <Button
        variant={expanded ? 'secondary' : 'outline'}
        className="gap-2 rounded-full px-5 relative z-10"
        disabled={isGenerating}
        onClick={() => setExpanded(prev => !prev)}
      >
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
        <span className="flex flex-col items-start leading-tight">
          <span>Infographic</span>
          <span className="text-[10px] text-muted-foreground font-normal -mt-0.5">Generate visual summary</span>
        </span>
      </Button>

      <div
        className={cn(
          'flex items-center gap-1 overflow-hidden transition-all duration-[250ms] ease-out',
          expanded ? 'max-w-[220px] opacity-100 ml-1' : 'max-w-0 opacity-0 ml-0'
        )}
      >
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full text-xs whitespace-nowrap"
          disabled={isGenerating}
          onClick={() => {
            onGenerate('landscape');
            setExpanded(false);
          }}
        >
          <Monitor className="h-3.5 w-3.5" />
          Landscape
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full text-xs whitespace-nowrap"
          disabled={isGenerating}
          onClick={() => {
            onGenerate('portrait');
            setExpanded(false);
          }}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Portrait
        </Button>
      </div>
    </div>
  );
};

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  content,
  title: externalTitle,
  isOpen,
  onClose,
  imageGenerationModel = 'google/gemini-3-pro-image-preview',
  infographicPracticeName,
  infographicSpellingCorrections,
  onContentUpdated,
  onExportPowerPoint,
  isPowerPointGenerating = false,
}) => {
  const { prefs, updatePref } = useDocumentPreviewPrefs();
  const { defaults: exportDefaults } = useAskAIExportDefaults();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { practiceContext } = usePracticeContext();
  const isMobile = useIsMobile();
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showAIEdit, setShowAIEdit] = useState(false);
  const [editableContent, setEditableContent] = useState<string | null>(null);

  const activeContent = editableContent ?? content;
  const documentTitle = externalTitle || extractTitle(activeContent);
  // infographicView state removed — document always visible, infographic opens as lightbox
  const [infographicUrl, setInfographicUrl] = useState<string | null>(null);
  const [infographicProgress, setInfographicProgress] = useState(0);
  const [infographicTipIdx, setInfographicTipIdx] = useState(0);
  const [infographicFullscreen, setInfographicFullscreen] = useState(false);
  const { generateInfographic, isGenerating: isInfographicGenerating, currentPhase, error: infographicError } = useContentInfographic();

  // PowerPoint progress state
  const [pptxProgress, setPptxProgress] = useState(0);
  const [pptxTipIdx, setPptxTipIdx] = useState(0);

  useEffect(() => {
    if (!isPowerPointGenerating) {
      setPptxProgress(0);
      setPptxTipIdx(0);
      return;
    }
    const progressInterval = setInterval(() => {
      setPptxProgress(prev => {
        if (prev >= 92) { clearInterval(progressInterval); return prev; }
        return prev + 3;
      });
    }, 1500);
    const tipInterval = setInterval(() => {
      setPptxTipIdx(prev => (prev + 1) % PPTX_TIPS.length);
    }, 3500);
    return () => { clearInterval(progressInterval); clearInterval(tipInterval); };
  }, [isPowerPointGenerating]);

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
    // infographicView reset removed
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
      await generatePDF(activeContent, documentTitle, {
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
    // Stay on document view — don't switch away
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
      const result = await generateInfographic(activeContent, documentTitle, {
        orientation,
        style: exportDefaults.defaultInfographicStyle,
        imageModel: imageGenerationModel,
        practiceName: infographicPracticeName || practiceName || undefined,
        spellingCorrections: infographicSpellingCorrections,
      });

      clearInterval(progressInterval);
      clearInterval(tipInterval);
      setInfographicProgress(100);

      if (result?.success && result.imageUrl) {
        setInfographicUrl(result.imageUrl);
        // Auto-open fullscreen lightbox when ready
        setInfographicFullscreen(true);
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
    <>
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !infographicFullscreen) handleClose(); }}>
      <DialogContent className={cn(
        "max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0",
        infographicFullscreen && "opacity-0 pointer-events-none"
      )}>
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

        {/* Settings gear — only for document view */}
        {(
          <div className="px-4 sm:px-6 py-2 border-b bg-muted/20 flex items-center">
            <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowSettingsModal(true)}>
              <Settings2 className="h-4 w-4" />
              Document Settings
            </Button>
          </div>
        )}

        {/* Infographic generating indicator — shown as a banner above the document */}
        {isInfographicGenerating && (
          <div className="px-4 sm:px-6 py-3 border-b bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                <ImageIcon className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Creating Infographic...</p>
                <Progress value={infographicProgress} className="h-1.5 mt-1" />
                <p className="text-xs text-muted-foreground mt-1 animate-pulse">
                  {INFOGRAPHIC_TIPS[infographicTipIdx]}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PowerPoint generating indicator — shown as a banner above the document */}
        {isPowerPointGenerating && (
          <div className="px-4 sm:px-6 py-3 border-b bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                <Presentation className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Creating Presentation…</p>
                <Progress value={pptxProgress} className="h-1.5 mt-1" />
                <p className="text-xs text-muted-foreground mt-1 animate-pulse">
                  {PPTX_TIPS[pptxTipIdx]}
                </p>
              </div>
            </div>
          </div>
        )}

        {infographicError && !isInfographicGenerating && (
          <div className="px-4 sm:px-6 py-3 border-b bg-destructive/5">
            <div className="flex items-center gap-3">
              <p className="text-sm text-destructive flex-1">{infographicError}</p>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => handleGenerateInfographic('landscape')}>
                  Retry Landscape
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleGenerateInfographic('portrait')}>
                  Retry Portrait
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Live preview area — always shows document */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-accent/10">
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
        </div>

        {/* AI Edit Panel */}
        {(
          <DocumentAIEditPanel
            content={activeContent}
            title={documentTitle}
            onContentUpdated={handleContentUpdated}
            isOpen={showAIEdit}
            onToggle={() => setShowAIEdit(v => !v)}
          />
        )}

        {/* Bottom actions - Export Studio bar */}
        <div className="px-4 sm:px-6 py-3 border-t bg-muted/30 flex flex-wrap items-center gap-2 min-h-[56px]">
              {/* Word */}
              <Button onClick={handleDownloadWord} disabled={isDownloadingWord} className="gap-2 rounded-full px-5">
                {isDownloadingWord ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                <span className="flex flex-col items-start leading-tight">
                  <span>Word</span>
                  <span className="text-[10px] text-primary-foreground/80 font-normal -mt-0.5">Download as document</span>
                </span>
              </Button>

              {/* Presentation */}
              {onExportPowerPoint && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2 rounded-full px-5">
                      <Presentation className="h-4 w-4" />
                      <span className="flex flex-col items-start leading-tight">
                        <span>Presentation</span>
                        <span className="text-[10px] text-muted-foreground font-normal -mt-0.5">Create as PowerPoint</span>
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-36 p-2" align="start">
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Slide count</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[5, 6, 7, 8, 9, 10, 11, 12].map(count => (
                        <Button
                          key={count}
                          variant="ghost"
                          size="sm"
                          className="text-sm justify-center"
                          onClick={() => onExportPowerPoint(activeContent, documentTitle, count)}
                        >
                          {count}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Infographic with inline orientation reveal */}
              {prefs.showInfographic && (
                <InfographicSelector
                  isGenerating={isInfographicGenerating}
                  onGenerate={handleGenerateInfographic}
                />
              )}

              {/* View infographic button — shown when one has been generated */}
              {infographicUrl && !isInfographicGenerating && (
                <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => setInfographicFullscreen(true)}>
                  <ImageIcon className="h-4 w-4" />
                  View Infographic
                </Button>
              )}

              <Button variant="ghost" onClick={handleClose} className="ml-auto">
                Cancel
              </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Fullscreen infographic lightbox - OUTSIDE Dialog to avoid Radix event interception */}
    {infographicFullscreen && infographicUrl && createPortal(
      <InfographicFullscreen
        infographicUrl={infographicUrl}
        onClose={() => setInfographicFullscreen(false)}
        onDownload={handleDownloadInfographic}
      />,
      document.body
    )}
    </>
  );
};