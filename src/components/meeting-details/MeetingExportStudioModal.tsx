import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  LayoutGrid,
  Headphones,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  Hash,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
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
import { generateProfessionalWordFromContent, filterContentByVisibility, ParsedMeetingDetailsInput, ParsedActionItemInput } from '@/utils/generateProfessionalMeetingDocx';
import { MeetingInfographicModal } from './MeetingInfographicModal';
import { SlidesStylePicker, type SlidePickerConfig, type SlideGenerationResult } from './SlidesStylePicker';
import { useMeetingPowerPoint } from '@/hooks/useMeetingPowerPoint';
import { useMeetingInfographicHistory } from '@/hooks/useMeetingInfographicHistory';
import { supabase } from '@/integrations/supabase/client';
import { downloadFile } from '@/utils/downloadFile';
import { removeActionItemsSection } from '@/utils/meeting/cleanMeetingContent';
import { Trash2, Eye } from 'lucide-react';

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
  onOpenAudioStudio?: () => void;
}

type ExportTab = 'word' | 'slides' | 'infographic' | 'audio';

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

  // Always remove Action/Completed text sections in this modal preview.
  const withoutActionText = removeActionItemsSection(cleaned);

  // Strip out meeting details lines (Title:, Date:, Time:, Location:) since we show them in the table
  const detailsPatterns = [
    /^\s*[-•*]?\s*\*{0,2}(?:Meeting\s*)?(?:Title|Subject)\*{0,2}\s*[:\-–—].+$/im,
    /^\s*[-•*]?\s*\*{0,2}(?:Meeting\s*)?Date\*{0,2}\s*[:\-–—].+$/im,
    /^\s*[-•*]?\s*\*{0,2}(?:Meeting\s*)?(?:Time|Start\s*Time)\*{0,2}\s*[:\-–—].+$/im,
    /^\s*[-•*]?\s*\*{0,2}(?:Location|Meeting\s*Type|Format)\*{0,2}\s*[:\-–—].+$/im,
    /^\s*#{1,6}\s*Meeting\s+Details\s*$/im,
  ];

  let filtered = withoutActionText;
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
        // Highlight "Resolved" lines in black bold
        const inner = p.slice(2, -2);
        if (/^Resolved/i.test(inner)) {
          return <strong key={i} style={{ color: '#000000' }}>{inner}</strong>;
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
    const subHeadingMatch = trimmed.match(/^(Context|Discussion|Agreed|Resolved|Noted|Implication|Outcome|Decision|Action):\s*(.*)/i);
    if (subHeadingMatch) {
      flushList();
      const label = subHeadingMatch[1];
      const rest = subHeadingMatch[2];
      const isResolved = /^resolved/i.test(label);
      elements.push(
        <p key={`sub-${keyIndex++}`} className="text-sm leading-relaxed mb-2 pl-4" style={{ color: COLORS.textGrey }}>
          <strong style={{ color: isResolved ? '#000000' : COLORS.textGrey }}>{label}:</strong>{' '}
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
  onOpenAudioStudio,
}) => {
  const { prefs, updatePref } = useDocumentPreviewPrefs();
  const { practiceContext } = usePracticeContext();
  const { settings: docSettings, setSettings: setDocSettings } = useUserDocumentSettings();
  const { activeLogo, fetchLogos } = useUserLogos();
  const isMobile = useIsMobile();
  const [isDownloadingWord, setIsDownloadingWord] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedExport, setSelectedExport] = useState<ExportTab>('word');
  const [exportPanelExpanded, setExportPanelExpanded] = useState(false);

  // PPT generation hook
  const { generatePowerPoint } = useMeetingPowerPoint();

  // Infographic state
  const [showInfographicModal, setShowInfographicModal] = useState(false);
  const [infographicOptions, setInfographicOptions] = useState<{ style: string; orientation?: 'portrait' | 'landscape' } | null>(null);
  const [selectedInfographicStyle, setSelectedInfographicStyle] = useState('practice-professional');
  const [selectedInfographicOrientation, setSelectedInfographicOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [includeLogoInInfographic, setIncludeLogoInInfographic] = useState(false);
  const [expandedInfographicThumb, setExpandedInfographicThumb] = useState<string | null>(null);
  const { generateInfographic, isGenerating: isInfographicGenerating, error: infographicError } = useMeetingInfographic();
  const [infographicUrl, setInfographicUrl] = useState<string | null>(null);
  const [infographicProgress, setInfographicProgress] = useState(0);
  const [infographicTipIdx, setInfographicTipIdx] = useState(0);
  const [infographicFullscreen, setInfographicFullscreen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Saved infographics history
  const { infographics: savedInfographics, count: savedCount, saveInfographic, deleteInfographic, refresh: refreshInfographics } = useMeetingInfographicHistory(meetingId);

  // Determine the logo URL to use: prefer user-managed active logo, fall back to practice context
  const logoUrl = activeLogo?.image_url || practiceContext?.logoUrl;
  const practiceName = activeLogo?.name || practiceContext?.practiceName;
  const practiceAddress = practiceContext?.practiceAddress;

  const logoAlignmentClass = {
    left: 'justify-start',
    center: 'justify-center',
    centre: 'justify-center',
    right: 'justify-end',
  }[docSettings.logo_position] || 'justify-start';

  const documentTitle = meetingDetails?.title || meetingTitle || 'Meeting Notes';

  // Filter content based on section toggles for preview, then always remove Action/Completed text blocks.
  // The dedicated Action Items table below is the single source of truth in this modal.
  const filteredNotesContent = useMemo(() => {
    const sectionVisibility = {
      executiveSummary: docSettings.exec_summary_on,
      actionList: docSettings.action_items_on,
      openItems: docSettings.open_items_on,
      attendees: docSettings.attendees_on,
      discussionSummary: docSettings.discussion_summary_on,
      decisionsRegister: docSettings.decisions_register_on,
      nextMeeting: docSettings.next_meeting_on,
      keyPoints: true, // always show key points
    };

    const visibilityFiltered = filterContentByVisibility(notesContent, sectionVisibility);
    return removeActionItemsSection(visibilityFiltered).trim();
  }, [notesContent, docSettings.exec_summary_on, docSettings.action_items_on, docSettings.open_items_on, docSettings.attendees_on, docSettings.discussion_summary_on, docSettings.decisions_register_on, docSettings.next_meeting_on]);

  const previewElements = useMemo(() => renderMeetingContent(filteredNotesContent), [filteredNotesContent]);

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

      // Merge section toggle settings with visibleSections
      const mergedSections = {
        ...visibleSections,
        executiveSummary: docSettings.exec_summary_on,
        actionList: docSettings.action_items_on,
        openItems: docSettings.open_items_on,
        attendees: docSettings.attendees_on,
        discussionSummary: docSettings.discussion_summary_on,
        decisionsRegister: docSettings.decisions_register_on,
        nextMeeting: docSettings.next_meeting_on,
      };

      // Best-effort lookup so the page footer carries the model that
      // produced these notes (mirrors meetings.notes_model_used).
      let notesModelUsed: string | null = null;
      if (meetingId) {
        try {
          const { data: modelRow } = await supabase
            .from('meetings')
            .select('notes_model_used')
            .eq('id', meetingId)
            .maybeSingle();
          notesModelUsed = (modelRow as any)?.notes_model_used ?? null;
        } catch (modelErr) {
          console.warn('⚠️ Could not load notes_model_used for footer:', modelErr);
        }
      }

      await generateProfessionalWordFromContent(
        notesContent,
        documentTitle,
        parsedDetails,
        docSettings.action_items_on ? parsedActionItems : [],
        mergedSections,
        docSettings.logo_on ? logoUrl : undefined,
        docSettings.logo_scale ?? 1.0,
        docSettings.footer_on,
        docSettings.meeting_details_on,
        docSettings.attendees_on,
        docSettings.priority_column_on,
        notesModelUsed,
      );
      toast.success('Word document downloaded');
    } catch (error) {
      console.error('Word export error:', error);
      toast.error('Failed to download Word document');
    } finally {
      setIsDownloadingWord(false);
    }
  }, [notesContent, documentTitle, meetingDetails, meetingType, meetingLocation, attendees, meetingId, visibleSections, docSettings, logoUrl]);


  // Infographic generation
  const handleGenerateInfographic = useCallback(async (style: string, orientation: 'landscape' | 'portrait') => {
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

      const result = await generateInfographic(meetingData, {
        style,
        orientation,
        logoUrl: includeLogoInInfographic ? logoUrl : undefined,
        practiceName: includeLogoInInfographic ? practiceName : undefined,
      });

      clearInterval(progressInterval);
      clearInterval(tipInterval);
      setInfographicProgress(100);

      if (result?.success && result.imageUrl) {
        setInfographicUrl(result.imageUrl);
        setInfographicFullscreen(true);
        // Persist to storage + DB
        await saveInfographic(result.imageUrl, style, orientation);
      }
    } catch {
      clearInterval(progressInterval);
      clearInterval(tipInterval);
      setInfographicProgress(0);
    }
  }, [documentTitle, meetingDetails, attendees, notesContent, actionItems, generateInfographic, includeLogoInInfographic, logoUrl, practiceName, saveInfographic]);

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

  // PPT generation from style picker — returns result for inline progress
  const handleSlidePickerGenerate = useCallback(async (config: SlidePickerConfig): Promise<SlideGenerationResult> => {
    const slideCount = config.slideCount === 'auto' ? 8 : config.slideCount;

    // Fetch active logo if includeLogo is on
    let logoData: { name: string; imageUrl?: string | null } | null = null;
    if (config.includeLogo) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: activeLogo } = await supabase
            .from('user_logos' as any)
            .select('name, image_url')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single();
          if (activeLogo) {
            logoData = {
              name: (activeLogo as any).name,
              imageUrl: (activeLogo as any).image_url,
            };
            console.log('[ExportStudio] Active logo found:', logoData.name, 'hasImage:', !!logoData.imageUrl);
          }
        }
      } catch (err) {
        console.warn('[ExportStudio] Failed to fetch active logo:', err);
      }
    }

    const result = await generatePowerPoint(meetingData, {
      style: config.theme.key,
      content: config.textDensity,
      slideCount,
      imageMode: config.imageMode,
      includeLogo: config.includeLogo,
      logoData,
    });

    return {
      success: result.success,
      downloadUrl: result.downloadUrl,
      error: result.error,
    };
  }, [generatePowerPoint, meetingData]);

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
            <Button variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowSettingsModal(true)}>
              <Settings2 className="h-4 w-4" />
              Document Settings
            </Button>
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
                  <Button size="sm" variant="outline" onClick={() => handleGenerateInfographic(selectedInfographicStyle, 'landscape')}>Retry Landscape</Button>
                  <Button size="sm" variant="outline" onClick={() => handleGenerateInfographic(selectedInfographicStyle, 'portrait')}>Retry Portrait</Button>
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
                {docSettings.logo_on && logoUrl && (
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
                {docSettings.meeting_details_on && (meetingDetails || (docSettings.attendees_on && attendees.length > 0)) && (
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
                        {docSettings.attendees_on && attendees.length > 0 && (
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
                {actionItems.length > 0 && docSettings.action_items_on && (
                  <div className="mt-6 overflow-x-auto rounded-lg border" style={{ borderColor: COLORS.tableBorder }}>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th colSpan={docSettings.priority_column_on ? 5 : 4} className="px-4 py-2.5 text-left text-sm font-semibold text-white" style={{ backgroundColor: COLORS.nhsBlue }}>
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
                          {docSettings.priority_column_on && (
                            <th className="border-t px-3 py-2 text-left font-semibold text-xs w-20" style={{ borderColor: COLORS.tableBorder }}>Priority</th>
                          )}
                          <th className="border-t px-3 py-2 text-left font-semibold text-xs w-20" style={{ borderColor: COLORS.tableBorder }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionItems.map((item, idx) => (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                            <td className="border-t px-3 py-2" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{item.action}</td>
                            <td className="border-t px-3 py-2 text-xs" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{item.owner}</td>
                            <td className="border-t px-3 py-2 text-xs" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{item.deadline || '—'}</td>
                            {docSettings.priority_column_on && (
                              <td className="border-t px-3 py-2 text-xs font-medium" style={{
                                borderColor: COLORS.tableBorder,
                                color: item.priority === 'High' ? COLORS.agreedRed : item.priority === 'Low' ? '#16A34A' : COLORS.textGrey,
                              }}>{item.priority}</td>
                            )}
                            <td className="border-t px-3 py-2 text-xs" style={{ borderColor: COLORS.tableBorder, color: COLORS.textGrey }}>{item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer */}
                {docSettings.footer_on && (
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

          {/* Export Studio - Collapsible */}
          <div className="border-t bg-background">
            {/* Toggle bar with Word shortcut */}
            <button
              type="button"
              className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
              onClick={() => setExportPanelExpanded(prev => !prev)}
            >
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Export Options</span>
              </div>
              <div className="flex items-center gap-2">
                {!exportPanelExpanded && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={(e) => { e.stopPropagation(); handleDownloadWord(); }}
                    disabled={isDownloadingWord}
                  >
                    {isDownloadingWord ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                    Word
                  </Button>
                )}
                {exportPanelExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Expanded content */}
            {exportPanelExpanded && (
              <div className="px-4 sm:px-6 pb-3">
                {/* 4-column tab grid */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {([
                    { key: 'word' as ExportTab, icon: FileText, label: 'Word', subtitle: 'Download', badgeCount: 0 },
                    { key: 'slides' as ExportTab, icon: Presentation, label: 'Slides', subtitle: 'PowerPoint', badgeCount: 0 },
                    { key: 'infographic' as ExportTab, icon: LayoutGrid, label: 'Infographic', subtitle: 'Visual summary', badgeCount: savedCount },
                    { key: 'audio' as ExportTab, icon: Headphones, label: 'Audio Studio', subtitle: 'Discussion', badgeCount: 0 },
                  ]).map(({ key, icon: Icon, label, subtitle, badgeCount }) => {
                    const isActive = selectedExport === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedExport(key)}
                        className={cn(
                          'relative flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center transition-colors cursor-pointer',
                          isActive
                            ? 'bg-[#003087] text-white'
                            : 'bg-white border border-border text-foreground hover:bg-muted/50'
                        )}
                        style={!isActive ? { borderWidth: '0.5px' } : undefined}
                      >
                        {badgeCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                            {badgeCount}
                          </span>
                        )}
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-medium leading-tight">{label}</span>
                        <span className={cn(
                          'text-[10px] leading-tight',
                          isActive ? 'text-white/70' : 'text-muted-foreground'
                        )}>{subtitle}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Action panel */}
                {selectedExport === 'slides' ? (
                  <SlidesStylePicker
                    logoUrl={logoUrl}
                    onGenerate={handleSlidePickerGenerate}
                  />
                ) : (
                <div className="rounded-lg p-[10px_12px]" style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb' }}>
                  {selectedExport === 'word' && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Download as Word document</p>
                        <p className="text-xs text-muted-foreground">Includes selected sections with NHS branding</p>
                      </div>
                      <Button size="sm" className="shrink-0 gap-1.5" onClick={handleDownloadWord} disabled={isDownloadingWord}>
                        {isDownloadingWord ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Download
                      </Button>
                    </div>
                  )}

                  {selectedExport === 'infographic' && (
                    <div className="space-y-2">
                      {/* Saved infographics gallery */}
                      {savedInfographics.length > 0 && (
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">Saved Infographics ({savedCount})</p>
                          <div className="flex gap-2 overflow-x-auto pb-1.5">
                            {savedInfographics.map((item, idx) => {
                              const styleLabel = item.style?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Custom';
                              const dateStr = new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                              return (
                                <div
                                  key={item.id}
                                  className="relative shrink-0 rounded-lg border border-border bg-white overflow-hidden group cursor-pointer"
                                  style={{ width: 100 }}
                                >
                                  <img
                                    src={item.image_url}
                                    alt={`Infographic #${savedInfographics.length - idx}`}
                                    className="w-full h-[68px] object-cover object-top"
                                    onClick={() => { setInfographicUrl(item.image_url); setInfographicFullscreen(true); }}
                                  />
                                  <div className="px-1.5 py-1">
                                    <p className="text-[9px] font-medium text-foreground truncate">#{savedInfographics.length - idx} {styleLabel}</p>
                                    <p className="text-[8px] text-muted-foreground">{dateStr}</p>
                                  </div>
                                  {/* Actions overlay */}
                                  <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      className="p-1 rounded bg-background/80 hover:bg-background text-foreground"
                                      title="View fullscreen"
                                      onClick={(e) => { e.stopPropagation(); setInfographicUrl(item.image_url); setInfographicFullscreen(true); }}
                                    >
                                      <Eye className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      className="p-1 rounded bg-background/80 hover:bg-background text-foreground"
                                      title="Download"
                                      onClick={(e) => { e.stopPropagation(); downloadFile(item.image_url, `infographic_${savedInfographics.length - idx}.png`); }}
                                    >
                                      <Download className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      className="p-1 rounded bg-background/80 hover:bg-destructive/90 hover:text-white text-destructive"
                                      title="Delete"
                                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(item.id); }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                  {/* Delete confirmation */}
                                  {deleteConfirmId === item.id && (
                                    <div className="absolute inset-0 bg-background/95 flex flex-col items-center justify-center gap-1 p-1">
                                      <p className="text-[9px] font-medium text-destructive text-center">Delete this?</p>
                                      <div className="flex gap-1">
                                        <Button size="sm" variant="destructive" className="h-5 text-[9px] px-2" onClick={() => { deleteInfographic(item.id); setDeleteConfirmId(null); }}>
                                          Yes
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-5 text-[9px] px-2" onClick={() => setDeleteConfirmId(null)}>
                                          No
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Row 1: Orientation + Logo sliders + Generate */}
                      <div className="flex items-center gap-3">
                        {/* Orientation slider */}
                        <button
                          type="button"
                          onClick={() => setSelectedInfographicOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')}
                          className="flex items-center gap-1.5 shrink-0"
                        >
                          <span className={cn('text-[10px] font-medium', selectedInfographicOrientation === 'landscape' ? 'text-foreground' : 'text-muted-foreground')}>
                            <Monitor className="h-3 w-3 inline mr-0.5" />Landscape
                          </span>
                          <div className={cn(
                            'relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                            'bg-[#003087]'
                          )}>
                            <span className={cn(
                              'pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition-transform',
                              selectedInfographicOrientation === 'portrait' ? 'translate-x-4' : 'translate-x-0'
                            )} />
                          </div>
                          <span className={cn('text-[10px] font-medium', selectedInfographicOrientation === 'portrait' ? 'text-foreground' : 'text-muted-foreground')}>
                            <ImageIcon className="h-3 w-3 inline mr-0.5" />Portrait
                          </span>
                        </button>

                        {/* Logo toggle */}
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setIncludeLogoInInfographic(prev => !prev)}
                            className="flex items-center gap-1.5 shrink-0"
                          >
                            <img src={logoUrl} alt="" className="h-5 w-auto max-w-[40px] object-contain rounded" />
                            <div className={cn(
                              'relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                              includeLogoInInfographic ? 'bg-[#003087]' : 'bg-muted'
                            )}>
                              <span className={cn(
                                'pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition-transform',
                                includeLogoInInfographic ? 'translate-x-4' : 'translate-x-0'
                              )} />
                            </div>
                          </button>
                        )}

                        <div className="flex-1" />

                        <Button
                          size="sm"
                          className="shrink-0 gap-1.5"
                          disabled={isInfographicGenerating}
                          onClick={() => handleGenerateInfographic(selectedInfographicStyle, selectedInfographicOrientation)}
                        >
                          {isInfographicGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                          Generate
                        </Button>
                      </div>

                      {/* Row 2: Style label + thumbnail gallery */}
                      <div>
                        <p className="text-[11px] text-muted-foreground mb-1.5">Select a style — click to preview</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {[
                            { key: 'practice-professional', label: 'Professional' },
                            { key: 'clinical-governance', label: 'Governance' },
                            { key: 'patient-safety', label: 'Patient Safety' },
                            { key: 'team-engagement', label: 'Staff / Team' },
                            { key: 'qof-targets', label: 'QOF & Targets' },
                            { key: 'board-pack', label: 'Board Pack' },
                            { key: 'icb-submission', label: 'ICB Submission' },
                            { key: 'neighbourhood', label: 'Neighbourhood' },
                          ].map(({ key, label }) => {
                            const thumb = `/images/infographic-thumbnails/${key}.png`;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  if (expandedInfographicThumb === key) {
                                    setExpandedInfographicThumb(null);
                                  } else {
                                    setSelectedInfographicStyle(key);
                                    setExpandedInfographicThumb(key);
                                  }
                                }}
                                className={cn(
                                  'flex flex-col items-center gap-0.5 shrink-0 rounded-md p-1 transition-all border-2',
                                  selectedInfographicStyle === key
                                    ? 'border-primary bg-primary/5'
                                    : 'border-transparent hover:border-muted-foreground/20'
                                )}
                              >
                                <img
                                  src={thumb}
                                  alt={label}
                                  className="rounded w-[68px] h-[48px] object-cover object-top"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                <span className={cn(
                                  'text-[9px] leading-tight text-center max-w-[68px] truncate',
                                  selectedInfographicStyle === key ? 'font-semibold text-primary' : 'text-muted-foreground'
                                )}>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Expanded preview overlay */}
                      {expandedInfographicThumb && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setExpandedInfographicThumb(null)}
                            className="absolute top-1 right-1 z-10 rounded-full bg-background/80 p-0.5 hover:bg-background"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <img
                            src={`/images/infographic-thumbnails/${expandedInfographicThumb}.png`}
                            alt="Style preview"
                            className="rounded-md border border-border w-full max-h-[312px] object-contain cursor-pointer"
                            onClick={() => setExpandedInfographicThumb(null)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {selectedExport === 'audio' && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Open Audio Studio</p>
                        <p className="text-xs text-muted-foreground">Create podcast-style audio discussion from notes</p>
                      </div>
                      <Button size="sm" className="shrink-0 gap-1.5" onClick={onOpenAudioStudio}>
                        <Headphones className="h-3.5 w-3.5" />
                        Open Studio
                      </Button>
                    </div>
                  )}
                </div>
                )}

                {/* View infographic link */}
                {infographicUrl && !isInfographicGenerating && (
                  <Button variant="outline" size="sm" className="gap-2 rounded-full mt-3" onClick={() => setInfographicFullscreen(true)}>
                    <ImageIcon className="h-4 w-4" />
                    View Infographic
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* Fullscreen infographic */}
      {infographicFullscreen && infographicUrl && createPortal(
        <InfographicFullscreen
          infographicUrl={infographicUrl}
          onClose={() => setInfographicFullscreen(false)}
          onDownload={handleDownloadInfographic}
        />,
        document.body
      )}

      {/* Document Settings Modal */}
      <DocumentSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onApply={(s) => { setDocSettings(s); fetchLogos(); }}
      />
    </>
  );
};

