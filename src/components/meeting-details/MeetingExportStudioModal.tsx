import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import {
  Download,
  FileText,
  X,
  Loader2,
  ImageIcon,
  Monitor,
  Settings2,
  Presentation,
  BarChart3,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Hash,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useDocumentPreviewPrefs, type LogoPosition } from '@/hooks/useDocumentPreviewPrefs';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useUserDocumentSettings, type UserDocumentSettings } from '@/hooks/useUserDocumentSettings';
import { useUserLogos } from '@/hooks/useUserLogos';
import { DocumentSettingsModal } from './DocumentSettingsModal';
import { useContentInfographic } from '@/hooks/useContentInfographic';
import { useMeetingInfographic } from '@/hooks/useMeetingInfographic';
import { cn } from '@/lib/utils';
import { showToast } from '@/utils/toastWrapper';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { generateProfessionalWordFromContent, ParsedMeetingDetailsInput, ParsedActionItemInput } from '@/utils/generateProfessionalMeetingDocx';
import { MeetingPowerPointModal } from './MeetingPowerPointModal';
import { MeetingInfographicModal } from './MeetingInfographicModal';
import { supabase } from '@/integrations/supabase/client';

interface MeetingDetails {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
}

interface ActionItem {
  action: string;
  owner: string;
  deadline: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Completed';
  isCompleted: boolean;
}

interface Attendee {
  name: string;
  role?: string;
  organization?: string;
}

interface MeetingExportStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  meetingTitle: string;
  notesContent: string;
  meetingDetails: MeetingDetails | null;
  attendees: Attendee[];
  actionItems: ActionItem[];
  meetingType?: 'teams' | 'f2f' | 'hybrid';
  meetingLocation?: string | null;
  visibleSections?: Record<string, boolean>;
}

const COLORS = {
  nhsBlue: '#005EB8',
  headingBlue: '#1E3A8A',
  subHeadingBlue: '#2563EB',
  textGrey: '#374151',
  lightGrey: '#6B7280',
  tableBorder: '#D1D5DB',
  tableHeaderBg: '#EFF6FF',
  agreedRed: '#DC2626',
};

const INFOGRAPHIC_TIPS = [
  'Analysing meeting content…',
  'Extracting key decisions…',
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

/** Render meeting notes content as rich preview elements */
function renderMeetingContent(content: string): React.ReactNode[] {
  const cleaned = content
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/<[^>]*>/g, '')
    .trim();

  // Strip out meeting details lines (Title:, Date:, Time:, Location:) since we show them in the table
  const detailsPatterns = [
    /^\s*[-•*]?\s*\*{0,2}(?:Meeting\s*)?(?:Title|Subject)\*{0,2}\s*[:\-–—].+$/im,
    /^\s*[-•*]?\s*\*{0,2}(?:Meeting\s*)?Date\*{0,2}\s*[:\-–—].+$/im,
    /^\s*[-•*]?\s*\*{0,2}(?:Meeting\s*)?(?:Time|Start\s*Time)\*{0,2}\s*[:\-–—].+$/im,
    /^\s*[-•*]?\s*\*{0,2}(?:Location|Meeting\s*Type|Format)\*{0,2}\s*[:\-–—].+$/im,
    /^\s*#{1,6}\s*Meeting\s+Details\s*$/im,
  ];

  let filtered = cleaned;
  for (const pattern of detailsPatterns) {
    filtered = filtered.replace(pattern, '');
  }
  // Clean up excessive blank lines
  filtered = filtered.replace(/\n{3,}/g, '\n\n').trim();

  const lines = filtered.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let keyIndex = 0;

  const formatInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        // Highlight "Agreed" lines in red bold
        const inner = p.slice(2, -2);
        if (/^Agreed/i.test(inner)) {
          return <strong key={i} style={{ color: COLORS.agreedRed }}>{inner}</strong>;
        }
        return <strong key={i}>{inner}</strong>;
      }
      // Strip any remaining markdown bold/italic markers
      return p.replace(/\*{1,2}/g, '');
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { flushList(); continue; }

    // Horizontal rules
    if (/^[-*_]{3,}$/.test(trimmed) || /^[═]{3,}$/.test(trimmed)) {
      flushList();
      continue;
    }

    // Headings
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

    // Numbered headings
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

    // Bullets
    if (/^[-•*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-•*]\s+/, ''));
      continue;
    }

    // Sub-heading labels (Context:, Discussion:, Agreed:, Implication:)
    const subHeadingMatch = trimmed.match(/^(Context|Discussion|Agreed|Implication|Outcome|Decision|Action):\s*(.*)/i);
    if (subHeadingMatch) {
      flushList();
      const label = subHeadingMatch[1];
      const rest = subHeadingMatch[2];
      const isAgreed = /^agreed/i.test(label);
      elements.push(
        <p key={`sub-${keyIndex++}`} className="text-sm leading-relaxed mb-2 pl-4" style={{ color: COLORS.textGrey }}>
          <strong style={{ color: isAgreed ? COLORS.agreedRed : COLORS.subHeadingBlue }}>{label}:</strong>{' '}
          {formatInline(rest)}
        </p>
      );
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
  return elements;
}

// Inline infographic selector with orientation reveal
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
          onClick={() => { onGenerate('landscape'); setExpanded(false); }}
        >
          <Monitor className="h-3.5 w-3.5" />
          Landscape
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full text-xs whitespace-nowrap"
          disabled={isGenerating}
          onClick={() => { onGenerate('portrait'); setExpanded(false); }}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Portrait
        </Button>
      </div>
    </div>
  );
};

// Fullscreen infographic overlay
const InfographicFullscreen: React.FC<{
  infographicUrl: string;
  onClose: () => void;
  onDownload: () => void;
}> = ({ infographicUrl, onClose, onDownload }) => {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', handle, true);
    return () => document.removeEventListener('keydown', handle, true);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <>
      <style>{`[data-radix-dialog-overlay],[data-radix-dialog-content]{pointer-events:none!important;visibility:hidden!important;}`}</style>
      <div
        className="fixed inset-0 bg-black/95 flex items-center justify-center cursor-pointer"
        style={{ zIndex: 2147483647, pointerEvents: 'auto' }}
        onClick={onClose}
        role="dialog"
        aria-label="Infographic fullscreen view"
      >
        <div className="absolute top-4 right-4 flex items-center gap-2" style={{ zIndex: 2147483647 }}>
          <button type="button" className="p-2 rounded-full text-white hover:bg-white/20 transition-colors" onClick={(e) => { e.stopPropagation(); onDownload(); }} aria-label="Download">
            <Download className="h-5 w-5" />
          </button>
          <button type="button" className="p-2 rounded-full text-white hover:bg-white/20 transition-colors" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close">
            <X className="h-6 w-6" />
          </button>
        </div>
        <img src={infographicUrl} alt="Infographic" className="max-w-[95vw] max-h-[95vh] object-contain select-none cursor-pointer" draggable={false} onClick={(e) => { e.stopPropagation(); onClose(); }} />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm pointer-events-none">
          Click to close • <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">Esc</kbd>
        </div>
      </div>
    </>
  );
};

export const MeetingExportStudioModal: React.FC<MeetingExportStudioModalProps> = ({
  isOpen,
  onClose,
  meetingId,
  meetingTitle,
  notesContent,
  meetingDetails,
  attendees,
  actionItems,
  meetingType = 'teams',
  meetingLocation,
  visibleSections,
}) => {
  const { prefs, updatePref } = useDocumentPreviewPrefs();
  const { practiceContext } = usePracticeContext();
  const { settings: docSettings, setSettings: setDocSettings } = useUserDocumentSettings();
  const { activeLogo } = useUserLogos();
  const isMobile = useIsMobile();
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // PPT state
  const [showPptModal, setShowPptModal] = useState(false);
  const [pptOptions, setPptOptions] = useState<{ style: string; content: string; slideCount: number } | null>(null);
  const [pptxProgress, setPptxProgress] = useState(0);
  const [pptxTipIdx, setPptxTipIdx] = useState(0);
  const [isPptGenerating, setIsPptGenerating] = useState(false);

  // Infographic state
  const [showInfographicModal, setShowInfographicModal] = useState(false);
  const [infographicOptions, setInfographicOptions] = useState<{ style: string; orientation?: 'portrait' | 'landscape' } | null>(null);
  const { generateInfographic, isGenerating: isInfographicGenerating, error: infographicError } = useMeetingInfographic();
  const [infographicUrl, setInfographicUrl] = useState<string | null>(null);
  const [infographicProgress, setInfographicProgress] = useState(0);
  const [infographicTipIdx, setInfographicTipIdx] = useState(0);
  const [infographicFullscreen, setInfographicFullscreen] = useState(false);

  // Determine the logo URL to use: prefer user-managed active logo, fall back to practice context
  const logoUrl = activeLogo?.image_url || practiceContext?.logoUrl;
  const practiceName = practiceContext?.practiceName;
  const practiceAddress = practiceContext?.practiceAddress;

  const logoAlignmentClass = {
    left: 'justify-start',
    center: 'justify-center',
    centre: 'justify-center',
    right: 'justify-end',
  }[docSettings.logo_position] || 'justify-start';

  const documentTitle = meetingDetails?.title || meetingTitle || 'Meeting Notes';

  const previewElements = useMemo(() => renderMeetingContent(notesContent), [notesContent]);

  // Word download
  const handleDownloadWord = useCallback(async () => {
    setIsDownloadingWord(true);
    try {
      const parsedDetails: ParsedMeetingDetailsInput = {
        title: meetingDetails?.title,
        date: meetingDetails?.date,
        time: meetingDetails?.time,
        location: meetingDetails?.location,
        venue: meetingType === 'teams' ? undefined : (meetingLocation || undefined),
        attendees: attendees.length > 0 ? attendees.map(a => a.name).join(', ') : undefined,
      };

      // Fetch fresh action items
      const { data: dbActionItems } = await supabase
        .from('meeting_action_items')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('sort_order', { ascending: true });

      const parsedActionItems: ParsedActionItemInput[] = (dbActionItems || []).map(item => ({
        action: item.action_text,
        owner: item.assignee_name || 'TBC',
        deadline: item.due_date || '',
        priority: (item.priority as 'High' | 'Medium' | 'Low') || 'Medium',
        status: (item.status as 'Open' | 'In Progress' | 'Completed') || 'Open',
        isCompleted: item.status === 'Completed',
      }));

      await generateProfessionalWordFromContent(
        notesContent,
        documentTitle,
        parsedDetails,
        parsedActionItems,
        visibleSections,
        prefs.showLogo ? logoUrl : undefined
      );
      toast.success('Word document downloaded');
    } catch (error) {
      console.error('Word export error:', error);
      toast.error('Failed to download Word document');
    } finally {
      setIsDownloadingWord(false);
    }
  }, [notesContent, documentTitle, meetingDetails, meetingType, meetingLocation, attendees, meetingId, visibleSections]);

  // PPT slide count selection
  const handlePptGenerate = useCallback((slideCount: number) => {
    setPptOptions({ style: 'professional', content: 'standard', slideCount });
    setShowPptModal(true);
  }, []);

  // Infographic generation
  const handleGenerateInfographic = useCallback(async (orientation: 'landscape' | 'portrait') => {
    setInfographicUrl(null);
    setInfographicProgress(0);
    setInfographicTipIdx(0);

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
      const meetingData = {
        meetingTitle: documentTitle,
        meetingDate: meetingDetails?.date,
        meetingTime: meetingDetails?.time,
        location: meetingDetails?.location,
        attendees: attendees.map(a => a.name),
        notesContent,
        actionItems: actionItems.map(item => ({
          description: item.action,
          owner: item.owner,
          deadline: item.deadline,
          status: item.status,
          priority: item.priority,
        })),
      };

      const result = await generateInfographic(meetingData, { style: 'practice-professional', orientation });

      clearInterval(progressInterval);
      clearInterval(tipInterval);
      setInfographicProgress(100);

      if (result?.success && result.imageUrl) {
        setInfographicUrl(result.imageUrl);
        setInfographicFullscreen(true);
      }
    } catch {
      clearInterval(progressInterval);
      clearInterval(tipInterval);
      setInfographicProgress(0);
    }
  }, [documentTitle, meetingDetails, attendees, notesContent, actionItems, generateInfographic]);

  const handleDownloadInfographic = useCallback(() => {
    if (!infographicUrl) return;
    const link = document.createElement('a');
    link.href = infographicUrl;
    link.download = `${documentTitle.replace(/[^a-zA-Z0-9]/g, '_')}_infographic.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Infographic downloaded');
  }, [infographicUrl, documentTitle]);

  const handleClose = useCallback(() => {
    setInfographicUrl(null);
    setInfographicProgress(0);
    setInfographicFullscreen(false);
    onClose();
  }, [onClose]);

  // Escape key for infographic fullscreen
  useEffect(() => {
    if (!infographicFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setInfographicFullscreen(false); }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [infographicFullscreen]);

  const meetingData = useMemo(() => ({
    meetingTitle: documentTitle,
    meetingDate: meetingDetails?.date,
    meetingTime: meetingDetails?.time,
    location: meetingDetails?.location,
    attendees: attendees.map(a => a.name),
    notesContent: notesContent || '',
    actionItems: actionItems.map(item => ({
      description: item.action,
      owner: item.owner,
      deadline: item.deadline,
      status: item.status,
      priority: item.priority,
    })),
  }), [documentTitle, meetingDetails, attendees, notesContent, actionItems]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !infographicFullscreen) handleClose(); }}>
        <DialogContent className={cn(
          'max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0',
          infographicFullscreen && 'opacity-0 pointer-events-none'
        )}>
          {/* Header */}
          <div className="px-4 sm:px-6 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-sm sm:text-base truncate">{documentTitle}</h2>
                <p className="text-xs text-muted-foreground">
                  {practiceName && `${practiceName} • `}
                  {meetingDetails?.date || 'Meeting Notes'}
                  {meetingDetails?.time && ` at ${meetingDetails.time}`}
                </p>
              </div>
            </div>
          </div>

          {/* Document Settings */}
          <div className="px-4 sm:px-6 py-2 border-b bg-muted/20 flex items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground hover:text-foreground">
                  <Settings2 className="h-4 w-4" />
                  Document Settings
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 space-y-3 bg-popover">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Display</p>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="exp-show-logo" className="text-sm cursor-pointer">Logo</Label>
                    <Switch id="exp-show-logo" checked={prefs.showLogo} onCheckedChange={(v) => updatePref('showLogo', v)} />
                  </div>
                  {prefs.showLogo && (
                    <div className="flex items-center justify-between pl-4">
                      <Label className="text-xs text-muted-foreground">Position</Label>
                      <Select value={prefs.logoPosition} onValueChange={(v) => updatePref('logoPosition', v as LogoPosition)}>
                        <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-background">
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="centre">Centre</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="exp-show-footer" className="text-sm cursor-pointer">Footer</Label>
                    <Switch id="exp-show-footer" checked={prefs.showFooter} onCheckedChange={(v) => updatePref('showFooter', v)} />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Infographic generating banner */}
          {isInfographicGenerating && (
            <div className="px-4 sm:px-6 py-3 border-b bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                  <ImageIcon className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Creating Infographic…</p>
                  <Progress value={infographicProgress} className="h-1.5 mt-1" />
                  <p className="text-xs text-muted-foreground mt-1 animate-pulse">{INFOGRAPHIC_TIPS[infographicTipIdx]}</p>
                </div>
              </div>
            </div>
          )}

          {infographicError && !isInfographicGenerating && (
            <div className="px-4 sm:px-6 py-3 border-b bg-destructive/5">
              <div className="flex items-center gap-3">
                <p className="text-sm text-destructive flex-1">{infographicError}</p>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => handleGenerateInfographic('landscape')}>Retry Landscape</Button>
                  <Button size="sm" variant="outline" onClick={() => handleGenerateInfographic('portrait')}>Retry Portrait</Button>
                </div>
              </div>
            </div>
          )}

          {/* Preview area */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-accent/10">
            <div className="p-4 sm:p-6">
              <div
                className="bg-white dark:bg-card rounded-lg shadow-sm border mx-auto"
                style={{ fontFamily: 'Calibri, sans-serif', padding: isMobile ? '24px' : '40px', maxWidth: '210mm' }}
              >
                {/* Logo */}
                {prefs.showLogo && logoUrl && (
                  <div className={cn('flex mb-6', logoAlignmentClass)}>
                    <img src={logoUrl} alt="Practice Logo" className="max-h-16 object-contain" />
                  </div>
                )}

                {/* Title */}
                <h1 className="text-center font-bold mb-4" style={{ fontSize: '22px', color: COLORS.nhsBlue }}>
                  {documentTitle}
                </h1>

                {/* Date/Time subtitle */}
                {(meetingDetails?.date || meetingDetails?.time) && (
                  <p className="text-center text-xs mb-6" style={{ color: COLORS.lightGrey }}>
                    {meetingDetails.date}{meetingDetails.time && ` at ${meetingDetails.time}`}
                  </p>
                )}

                {/* Meeting Details Table */}
                {(meetingDetails || attendees.length > 0) && (
                  <div className="my-4 overflow-x-auto rounded-lg border" style={{ borderColor: COLORS.tableBorder }}>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th colSpan={2} className="px-4 py-2.5 text-left text-sm font-semibold text-white" style={{ backgroundColor: COLORS.nhsBlue }}>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Meeting Details
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {meetingDetails?.title && (
                          <tr>
                            <td className="border-t px-4 py-2.5 font-semibold align-top w-[180px]" style={{ borderColor: COLORS.tableBorder, color: COLORS.headingBlue }}>
                              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Title</div>
                            </td>
                            <td className="border-t px-4 py-2.5" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{meetingDetails.title}</td>
                          </tr>
                        )}
                        {meetingDetails?.date && (
                          <tr style={{ backgroundColor: '#F9FAFB' }}>
                            <td className="border-t px-4 py-2.5 font-semibold align-top w-[180px]" style={{ borderColor: COLORS.tableBorder, color: COLORS.headingBlue }}>
                              <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground" /> Date</div>
                            </td>
                            <td className="border-t px-4 py-2.5" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{meetingDetails.date}</td>
                          </tr>
                        )}
                        {meetingDetails?.time && (
                          <tr>
                            <td className="border-t px-4 py-2.5 font-semibold align-top w-[180px]" style={{ borderColor: COLORS.tableBorder, color: COLORS.headingBlue }}>
                              <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> Time</div>
                            </td>
                            <td className="border-t px-4 py-2.5" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{meetingDetails.time}</td>
                          </tr>
                        )}
                        {(meetingDetails?.location || meetingLocation) && (
                          <tr style={{ backgroundColor: '#F9FAFB' }}>
                            <td className="border-t px-4 py-2.5 font-semibold align-top w-[180px]" style={{ borderColor: COLORS.tableBorder, color: COLORS.headingBlue }}>
                              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> Location</div>
                            </td>
                            <td className="border-t px-4 py-2.5" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{meetingLocation || meetingDetails?.location}</td>
                          </tr>
                        )}
                        {attendees.length > 0 && (
                          <tr>
                            <td className="border-t px-4 py-2.5 font-semibold align-top w-[180px]" style={{ borderColor: COLORS.tableBorder, color: COLORS.headingBlue }}>
                              <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> Attendees</div>
                            </td>
                            <td className="border-t px-4 py-2.5" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>
                              <div className="flex flex-wrap gap-1">
                                {attendees.map((a, idx) => (
                                  <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: COLORS.tableHeaderBg, color: COLORS.headingBlue }}>
                                    {a.name}
                                    {a.organization && <span className="ml-1 opacity-60">({a.organization})</span>}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Notes content */}
                <div className="space-y-2">
                  {previewElements}
                </div>

                {/* Action Items Table */}
                {actionItems.length > 0 && (
                  <div className="mt-6 overflow-x-auto rounded-lg border" style={{ borderColor: COLORS.tableBorder }}>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th colSpan={5} className="px-4 py-2.5 text-left text-sm font-semibold text-white" style={{ backgroundColor: COLORS.nhsBlue }}>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              Action Items ({actionItems.length})
                            </div>
                          </th>
                        </tr>
                        <tr style={{ backgroundColor: COLORS.tableHeaderBg }}>
                          <th className="border-t px-3 py-2 text-left font-semibold text-xs" style={{ borderColor: COLORS.tableBorder }}>Action</th>
                          <th className="border-t px-3 py-2 text-left font-semibold text-xs w-24" style={{ borderColor: COLORS.tableBorder }}>Owner</th>
                          <th className="border-t px-3 py-2 text-left font-semibold text-xs w-24" style={{ borderColor: COLORS.tableBorder }}>Deadline</th>
                          <th className="border-t px-3 py-2 text-left font-semibold text-xs w-20" style={{ borderColor: COLORS.tableBorder }}>Priority</th>
                          <th className="border-t px-3 py-2 text-left font-semibold text-xs w-20" style={{ borderColor: COLORS.tableBorder }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionItems.map((item, idx) => (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                            <td className="border-t px-3 py-2" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{item.action}</td>
                            <td className="border-t px-3 py-2 text-xs" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{item.owner}</td>
                            <td className="border-t px-3 py-2 text-xs" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{item.deadline || '—'}</td>
                            <td className="border-t px-3 py-2 text-xs font-medium" style={{
                              borderColor: COLORS.tableBorder,
                              color: item.priority === 'High' ? COLORS.agreedRed : item.priority === 'Low' ? '#16A34A' : COLORS.textGrey,
                            }}>{item.priority}</td>
                            <td className="border-t px-3 py-2 text-xs" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer */}
                {prefs.showFooter && (
                  <div className="mt-8 pt-4 border-t flex items-center justify-between text-xs" style={{ color: COLORS.lightGrey }}>
                    <div>
                      {practiceName && <p className="font-medium">{practiceName}</p>}
                      {practiceAddress && <p>{practiceAddress}</p>}
                      <p className="mt-1 italic">Generated by Notewell AI</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom export bar */}
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
                  {[5, 6, 8, 10, 12, 15].map(count => (
                    <Button key={count} variant="ghost" size="sm" className="text-sm justify-center" onClick={() => handlePptGenerate(count)}>
                      {count}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Infographic */}
            <InfographicSelector
              isGenerating={isInfographicGenerating}
              onGenerate={handleGenerateInfographic}
            />

            {/* View infographic */}
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

      {/* PowerPoint Modal */}
      <MeetingPowerPointModal
        isOpen={showPptModal}
        onClose={() => { setShowPptModal(false); setPptOptions(null); }}
        meetingData={meetingData}
        options={pptOptions || undefined}
      />

      {/* Fullscreen infographic */}
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
