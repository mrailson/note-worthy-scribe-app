import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScribeSession, ScribeSettings, ConsultationViewMode, SOAPNote, NoteStyle, CONSULTATION_CATEGORY_LABELS, ConsultationCategory } from "@/types/scribe";
import { History, Trash2, FileText, Clock, Loader2, ArrowLeft, Copy, ChevronRight, List, Monitor, Settings2, User, Lightbulb, Stethoscope, Heart, HandHeart, CheckSquare, XSquare, ChevronLeft, Send, Sparkles, Pencil, ClipboardList } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { TranscriptComparisonView } from "./TranscriptComparisonView";
import { ConsultationViewControls } from "./ConsultationViewControls";
import { NoteStyleToggle } from "./NoteStyleToggle";
import { PatientLetterView } from "./PatientLetterView";
import { SessionHistorySearch, DateFilter, CategoryFilter } from "./SessionHistorySearch";
import { ReferralWorkspace } from "./ReferralWorkspace";
import { ConsultationAskAI } from "./ConsultationAskAI";
import { NarrativeClinicalNoteView } from "./NarrativeClinicalNoteView";
import { EmisNoteView } from "./EmisNoteView";
import { getNarrativeClinicalText, transformToNarrativeClinical } from "@/utils/narrativeClinicalFormatter";
import { supabase } from "@/integrations/supabase/client";
import { maskPatientName, maskDateOfBirth, maskPatientData } from "@/utils/patientDataMasking";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QuickPatientEntryForm } from "./QuickPatientEntryForm";
import { SessionHistoryRow } from "./SessionHistoryRow";

interface ScribeHistoryPanelProps {
  sessions: ScribeSession[];
  filteredSessions: ScribeSession[];
  isLoading: boolean;
  currentSession: ScribeSession | null;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRefresh: () => void;
  onClearCurrentSession: () => void;
  settings: ScribeSettings;
  onUpdateSetting: <K extends keyof ScribeSettings>(key: K, value: ScribeSettings[K]) => void;
  // Search and filter props
  searchTerm: string;
  onSearchChange: (value: string) => void;
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  categoryFilter: CategoryFilter;
  onCategoryFilterChange: (filter: CategoryFilter) => void;
  userId?: string;
}

// Category icon mapping
const categoryIcons: Record<ConsultationCategory, typeof Stethoscope> = {
  general: Stethoscope,
  agewell: Heart,
  social_prescriber: HandHeart,
};

export const ScribeHistoryPanel = ({
  sessions,
  filteredSessions,
  isLoading,
  currentSession,
  onLoadSession,
  onDeleteSession,
  onRefresh,
  onClearCurrentSession,
  settings,
  onUpdateSetting,
  searchTerm,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  userId,
}: ScribeHistoryPanelProps) => {
  const isMobile = useIsMobile();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratedNotes, setRegeneratedNotes] = useState<SOAPNote | null>(null);
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);
  
  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Patient details toggle state
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  
  // Calculate paginated sessions
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSessions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSessions, currentPage]);
  
  const totalPages = Math.ceil(filteredSessions.length / ITEMS_PER_PAGE);
  
  // Reset to page 1 when filters change
  const handleSearchChange = useCallback((value: string) => {
    setCurrentPage(1);
    onSearchChange(value);
  }, [onSearchChange]);
  
  const handleDateFilterChange = useCallback((filter: DateFilter) => {
    setCurrentPage(1);
    onDateFilterChange(filter);
  }, [onDateFilterChange]);
  
  const handleCategoryFilterChange = useCallback((filter: CategoryFilter) => {
    setCurrentPage(1);
    onCategoryFilterChange(filter);
  }, [onCategoryFilterChange]);

  const copyToClipboard = (text: string, _label: string) => {
    navigator.clipboard.writeText(text);
  };

  const currentSoapNote = regeneratedNotes || currentSession?.soapNote;

  // Calculate word count from transcript (more accurate representation of consultation length)
  const transcriptWordCount = currentSession?.transcript
    ? currentSession.transcript.split(/\s+/).filter(word => word.length > 0).length
    : 0;
  
  // Use transcript word count if available, otherwise fall back to stored word count
  const calculatedWordCount = transcriptWordCount || currentSession?.wordCount || 0;

  const handleViewModeChange = useCallback((mode: ConsultationViewMode) => {
    onUpdateSetting('consultationViewMode', mode);
  }, [onUpdateSetting]);

  const handleNoteStyleChange = useCallback((style: NoteStyle) => {
    onUpdateSetting('noteStyle', style);
    // Also update detail level for consistency
    onUpdateSetting('consultationDetailLevel', style === 'shorthand' ? 1 : 3);
  }, [onUpdateSetting]);

  const handleShowNotMentionedChange = useCallback((show: boolean) => {
    onUpdateSetting('showNotMentioned', show);
  }, [onUpdateSetting]);

  // Filter out "None mentioned", "None discussed", blank values, etc. when toggle is off
  const filterNotMentioned = useCallback((text: string): string => {
    if (settings.showNotMentioned) return text;
    
    // Pattern for "None mentioned", "None discussed", "None given", "None made", etc.
    const notMentionedPatterns = /\b(none\s*mentioned|not\s*mentioned|none\s*discussed|not\s*discussed|none\s*given|none\s*made|none\s*required|n\/a|nil|not\s*applicable|no\s*significant|not\s*recorded|not\s*documented)\b/i;
    
    // Pattern for lines with only a label and no content (e.g., "- Allergies:" or "Allergies:")
    const blankValuePattern = /^[-•]?\s*[\w\s\/]+:\s*$/;
    
    return text
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        // Keep empty lines (for spacing between sections)
        if (!trimmed) return true;
        // Remove lines matching "none mentioned" patterns
        if (notMentionedPatterns.test(trimmed)) return false;
        // Remove lines that are just labels with no value
        if (blankValuePattern.test(trimmed)) return false;
        return true;
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n'); // Clean up multiple empty lines
  }, [settings.showNotMentioned]);

  const handleDetailLevelChange = useCallback(async (newLevel: number) => {
    onUpdateSetting('consultationDetailLevel', newLevel);
    
    // Regenerate notes if we have a transcript
    if (currentSession?.transcript) {
      setIsRegenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke('generate-scribe-notes', {
          body: { 
            transcript: currentSession.transcript,
            detailLevel: newLevel,
            consultationType: currentSession.consultationType || 'f2f'
          }
        });
        
        if (error) throw error;
        
        if (data && data.S && data.O && data.A && data.P) {
          setRegeneratedNotes({
            S: data.S,
            O: data.O,
            A: data.A,
            P: data.P
          });
        }
      } catch (error) {
        console.error('Failed to regenerate notes:', error);
        toast.error('Failed to regenerate notes');
      } finally {
        setIsRegenerating(false);
      }
    }
  }, [currentSession, onUpdateSetting]);

  // Clear regenerated notes when session changes
  const handleClearCurrentSession = useCallback(() => {
    setRegeneratedNotes(null);
    onClearCurrentSession();
  }, [onClearCurrentSession]);

  // Multi-select handlers
  const toggleSelectMode = useCallback(() => {
    setIsSelectMode(prev => !prev);
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((sessionId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredSessions.map(s => s.id)));
  }, [filteredSessions]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map(id => onDeleteSession(id));
      await Promise.all(deletePromises);
      setSelectedIds(new Set());
      setIsSelectMode(false);
      toast.success(`Deleted ${selectedIds.size} session(s)`);
    } catch (error) {
      console.error('Error deleting sessions:', error);
      toast.error('Failed to delete some sessions');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, onDeleteSession]);

  const handleDeleteAll = useCallback(async () => {
    if (deleteAllConfirmText.toLowerCase() !== 'delete all') return;
    
    setIsDeleting(true);
    try {
      const deletePromises = filteredSessions.map(s => onDeleteSession(s.id));
      await Promise.all(deletePromises);
      setDeleteAllConfirmText('');
      setIsSelectMode(false);
      toast.success(`Deleted ${filteredSessions.length} session(s)`);
    } catch (error) {
      console.error('Error deleting sessions:', error);
      toast.error('Failed to delete some sessions');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteAllConfirmText, filteredSessions, onDeleteSession]);

  const getNarrativeText = useCallback(() => {
    if (!currentSoapNote) return '';
    const { S, O, A, P } = currentSoapNote;
    const isShorthand = settings.noteStyle === 'shorthand';
    
    // Apply filter to each section first
    const filteredS = filterNotMentioned(S);
    const filteredO = filterNotMentioned(O);
    const filteredA = filterNotMentioned(A);
    const filteredP = filterNotMentioned(P);
    
    if (isShorthand) {
      // GP Shorthand narrative - concise clinical note
      const extractKey = (text: string, maxWords: number = 15) => {
        const cleaned = text.replace(/[-•]/g, '').trim();
        const words = cleaned.split(/\s+/).slice(0, maxWords);
        return words.join(' ') || '-';
      };
      
      const hpc = filteredS.match(/HPC[:\s]*([^•\n-]+)/i)?.[1]?.trim() || extractKey(filteredS, 20);
      const oeFinding = filteredO.match(/O\/E[:\s]*([^•\n-]+)/i)?.[1]?.trim() || extractKey(filteredO, 12);
      const dx = filteredA.match(/\d+\.\s*([^•\n]+)/)?.[1]?.trim() || extractKey(filteredA, 10);
      const rx = filteredP.match(/(?:Rx|Treatment)[:\s]*([^•\n-]+)/i)?.[1]?.trim() || '';
      const fu = filteredP.match(/(?:F\/U|Follow)[:\s-]*([^•\n]+)/i)?.[1]?.trim() || '';
      const safety = filteredP.match(/(?:Safety|S\/N)[:\s-]*([^•\n]+)/i)?.[1]?.trim() || '';
      
      return `Hx: ${extractKey(hpc, 20)}
O/E: ${extractKey(oeFinding, 12)}
Dx: ${extractKey(dx, 10)}${rx ? `\nRx: ${extractKey(rx, 12)}` : ''}${fu ? `\nF/U: ${extractKey(fu, 8)}` : ''}${safety ? `\nS/N: ${extractKey(safety, 10)}` : ''}`.trim();
    }
    
    return `${filteredS}\n\n${filteredO}\n\n${filteredA}\n\n${filteredP}`;
  }, [currentSoapNote, settings.noteStyle, filterNotMentioned]);

  const getSummaryText = useCallback(() => {
    if (!currentSoapNote) return '';
    const { S, O, A, P } = currentSoapNote;
    const isShorthand = settings.noteStyle === 'shorthand';
    
    // Apply filter to each section first
    const filteredS = filterNotMentioned(S);
    const filteredO = filterNotMentioned(O);
    const filteredA = filterNotMentioned(A);
    const filteredP = filterNotMentioned(P);
    
    if (isShorthand) {
      // GP Shorthand format - ultra-concise, <100 words
      const extractKey = (text: string, maxWords: number = 8) => {
        const cleaned = text.replace(/[-•]/g, '').trim();
        const words = cleaned.split(/\s+/).slice(0, maxWords);
        return words.join(' ') || '-';
      };
      
      // Parse sections for key info
      const hpc = filteredS.match(/HPC[:\s]*([^•\n-]+)/i)?.[1]?.trim() || extractKey(filteredS);
      const oeFinding = filteredO.match(/O\/E[:\s]*([^•\n-]+)/i)?.[1]?.trim() || extractKey(filteredO);
      const dx = filteredA.match(/\d+\.\s*([^•\n]+)/)?.[1]?.trim() || extractKey(filteredA);
      const rx = filteredP.match(/(?:Rx|Treatment)[:\s]*([^•\n-]+)/i)?.[1]?.trim() || '';
      const fu = filteredP.match(/(?:F\/U|Follow)[:\s-]*([^•\n]+)/i)?.[1]?.trim() || '';
      
      return `Hx: ${extractKey(hpc, 12)}
O/E: ${extractKey(oeFinding, 8)}
Dx: ${extractKey(dx, 6)}
${rx ? `Rx: ${extractKey(rx, 8)}` : ''}
${fu ? `F/U: ${extractKey(fu, 6)}` : ''}`.trim().replace(/\n{2,}/g, '\n');
    }
    
    // Standard format - more detailed
    const getFirstPart = (text: string) => {
      const firstSentence = text.split(/[.!?]/)[0];
      return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence;
    };
    return `• Hx: ${getFirstPart(filteredS)}\n• Ex: ${getFirstPart(filteredO)}\n• Dx: ${getFirstPart(filteredA)}\n• Rx: ${getFirstPart(filteredP)}`;
  }, [currentSoapNote, settings.noteStyle, filterNotMentioned]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Loading session history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show session detail view
  if (currentSession) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size={isMobile ? "default" : "sm"} 
            onClick={handleClearCurrentSession}
            className={isMobile ? "w-full justify-start" : ""}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to History
          </Button>
        </div>

        <Card>
          <CardHeader className={isMobile ? "px-3 py-4" : ""}>
            <div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-start justify-between'}`}>
              <div>
                <CardTitle className={isMobile ? "text-base" : "text-lg"}>{currentSession.title}</CardTitle>
                {/* Patient Context Banner - Full Display in Detail View */}
                {currentSession.patientName ? (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium text-primary">{currentSession.patientName}</span>
                    {currentSession.patientNhsNumber && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          NHS: {currentSession.patientNhsNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}
                        </span>
                      </>
                    )}
                    {currentSession.patientDob && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          DOB: {currentSession.patientDob}
                        </span>
                      </>
                    )}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="ml-auto h-6 px-2">
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="end">
                        <QuickPatientEntryForm
                          sessionId={currentSession.id}
                          existingName={currentSession.patientName}
                          existingNhsNumber={currentSession.patientNhsNumber || ""}
                          existingDob={currentSession.patientDob || ""}
                          onSave={() => onRefresh()}
                          onCancel={() => {}}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="mt-2 h-7 text-xs">
                        <User className="h-3.5 w-3.5 mr-1.5" />
                        Add Patient Identifier
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="start">
                      <QuickPatientEntryForm
                        sessionId={currentSession.id}
                        onSave={() => onRefresh()}
                        onCancel={() => {}}
                      />
                    </PopoverContent>
                  </Popover>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(currentSession.createdAt), isMobile ? 'd MMM yyyy, HH:mm' : 'EEEE, d MMMM yyyy \'at\' HH:mm')}
                </p>
              </div>
              <Badge variant="secondary" className={isMobile ? "w-fit" : ""}>{currentSession.status}</Badge>
            </div>
            <div className={`flex items-center gap-3 text-sm text-muted-foreground mt-2 flex-wrap ${isMobile ? 'gap-2' : 'gap-4'}`}>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {currentSession.duration ? `${Math.floor(currentSession.duration)} min` : '0 min'}
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {calculatedWordCount} words
                </span>
                <span className="text-muted-foreground/40">|</span>
                <NoteStyleToggle
                  style={settings.noteStyle || 'standard'}
                  onStyleChange={handleNoteStyleChange}
                />
                <span className="text-muted-foreground/40">|</span>
                <div className="flex items-center gap-0.5">
                  {/* Narrative Clinical (TPP SystmOne) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleViewModeChange('narrativeClinical')}
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          settings.consultationViewMode === 'narrativeClinical' 
                            ? "text-primary bg-primary/10" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="Narrative Clinical (TPP SystmOne)"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Narrative Clinical (TPP SystmOne)</TooltipContent>
                  </Tooltip>
                  {/* EMIS View */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleViewModeChange('emis')}
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          settings.consultationViewMode === 'emis' 
                            ? "text-primary bg-primary/10" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="EMIS View"
                      >
                        <Monitor className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">EMIS View</TooltipContent>
                  </Tooltip>
                  
                  {/* Spacer */}
                  <span className="w-2" />
                  
                  {/* Structured View (SOAP) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleViewModeChange('soap')}
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          settings.consultationViewMode === 'soap' 
                            ? "text-primary bg-primary/10" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="Structured View (SOAP)"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Structured View (SOAP)</TooltipContent>
                  </Tooltip>
                  
                  {/* Spacer */}
                  <span className="w-2" />
                  
                  {/* Patient Letter */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleViewModeChange('patient')}
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          settings.consultationViewMode === 'patient' 
                            ? "text-primary bg-primary/10" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="Patient Letter"
                      >
                        <User className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Patient Letter</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="consultation" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="consultation">F2F Consultation</TabsTrigger>
                <TabsTrigger value="ask-ai" className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Ask AI
                </TabsTrigger>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
              </TabsList>
              
              <TabsContent value="consultation" className="mt-4 space-y-6">
                {/* Display Settings Modal */}
                <ConsultationViewControls
                  open={displaySettingsOpen}
                  onOpenChange={setDisplaySettingsOpen}
                  viewMode={settings.consultationViewMode}
                  detailLevel={settings.consultationDetailLevel}
                  showNotMentioned={settings.showNotMentioned}
                  isRegenerating={isRegenerating}
                  onViewModeChange={handleViewModeChange}
                  onDetailLevelChange={handleDetailLevelChange}
                  onShowNotMentionedChange={handleShowNotMentionedChange}
                />

                {/* SOAP Notes */}
                {currentSoapNote ? (
                  <div className="space-y-3">
                    {/* SOAP View Mode */}
                    {settings.consultationViewMode === 'soap' && (
                      <Accordion type="multiple" defaultValue={['S', 'O', 'A', 'P']} className="space-y-2">
                        <AccordionItem value="S" className="border rounded-lg px-4">
                          <div className="flex items-center justify-between">
                            <AccordionTrigger className="hover:no-underline py-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold flex items-center justify-center">S</span>
                                <span className="font-medium">Subjective (History)</span>
                              </div>
                            </AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyToClipboard(currentSoapNote.S, 'Subjective')}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          </div>
                          <AccordionContent className="pt-0 pb-3">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{filterNotMentioned(currentSoapNote.S)}</p>
                          </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="O" className="border rounded-lg px-4">
                          <div className="flex items-center justify-between">
                            <AccordionTrigger className="hover:no-underline py-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold flex items-center justify-center">O</span>
                                <span className="font-medium">Objective (Examination)</span>
                              </div>
                            </AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyToClipboard(currentSoapNote.O, 'Objective')}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          </div>
                          <AccordionContent className="pt-0 pb-3">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{filterNotMentioned(currentSoapNote.O)}</p>
                          </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="A" className="border rounded-lg px-4">
                          <div className="flex items-center justify-between">
                            <AccordionTrigger className="hover:no-underline py-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center justify-center">A</span>
                                <span className="font-medium">Assessment</span>
                              </div>
                            </AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyToClipboard(currentSoapNote.A, 'Assessment')}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          </div>
                          <AccordionContent className="pt-0 pb-3">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{filterNotMentioned(currentSoapNote.A)}</p>
                          </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="P" className="border rounded-lg px-4">
                          <div className="flex items-center justify-between">
                            <AccordionTrigger className="hover:no-underline py-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold flex items-center justify-center">P</span>
                                <span className="font-medium">Plan</span>
                              </div>
                            </AccordionTrigger>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyToClipboard(currentSoapNote.P, 'Plan')}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          </div>
                          <AccordionContent className="pt-0 pb-3">
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{filterNotMentioned(currentSoapNote.P)}</p>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}

                    {/* Narrative Clinical View Mode (H/E/A/I/P) */}
                    {settings.consultationViewMode === 'narrativeClinical' && (
                      <NarrativeClinicalNoteView
                        soapNote={currentSoapNote}
                        heidiNote={currentSession.heidiNote}
                        showNotMentioned={settings.showNotMentioned}
                        onShowNotMentionedChange={handleShowNotMentionedChange}
                      />
                    )}


                    {/* EMIS View Mode */}
                    {settings.consultationViewMode === 'emis' && (
                      <EmisNoteView
                        soapNote={currentSoapNote}
                        heidiNote={currentSession.heidiNote}
                        consultationType={currentSession.consultationType}
                        showNotMentioned={settings.showNotMentioned}
                        onShowNotMentionedChange={handleShowNotMentionedChange}
                      />
                    )}

                    {/* Patient Letter View Mode */}
                    {settings.consultationViewMode === 'patient' && (
                      <PatientLetterView
                        transcript={currentSession.transcript}
                        consultationType={currentSession.consultationType}
                        soapNote={currentSoapNote || undefined}
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No consultation notes available</p>
                )}
              </TabsContent>
              
              
              <TabsContent value="ask-ai" className="mt-4">
                <ConsultationAskAI 
                  session={currentSession} 
                  soapNote={currentSoapNote}
                  patientContext={currentSession.patientName ? {
                    name: currentSession.patientName,
                    nhsNumber: currentSession.patientNhsNumber || undefined,
                    dateOfBirth: currentSession.patientDob || undefined,
                  } : undefined}
                />
              </TabsContent>
              
              <TabsContent value="transcript" className="mt-4">
                {currentSession.transcript ? (
                  <TranscriptComparisonView 
                    batchTranscript={currentSession.transcript}
                    realtimeTranscript={currentSession.realtimeTranscript}
                    createdAt={currentSession.createdAt}
                    consultationType={currentSession.consultationType}
                    patientName={currentSession.patientName}
                    patientNhsNumber={currentSession.patientNhsNumber}
                    copyToClipboard={copyToClipboard}
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8">No transcript available</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <History className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No sessions yet</p>
            <p className="text-sm">Start recording to create your first session</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between flex-wrap gap-2 ${isMobile ? 'flex-col items-start' : ''}`}>
        <h2 className={`font-semibold flex items-center gap-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
          <History className={isMobile ? "h-4 w-4" : "h-5 w-5"} />
          {isMobile ? "History" : "Session History"}
          {isSelectMode && selectedIds.size > 0 && (
            <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
          )}
        </h2>
        <div className={`flex items-center gap-2 ${isMobile ? 'w-full flex-wrap' : ''}`}>
          {!isSelectMode ? (
            <>
              <Button variant="outline" size="sm" onClick={toggleSelectMode} className={isMobile ? "flex-1" : ""}>
                <CheckSquare className="h-4 w-4 mr-1.5" />
                {isMobile ? "Select" : "Select"}
              </Button>
              <Button variant="outline" size="sm" onClick={onRefresh} className={isMobile ? "flex-1" : ""}>
                Refresh
              </Button>
            </>
          ) : (
            <div className={`flex items-center gap-2 ${isMobile ? 'w-full flex-wrap' : ''}`}>
              <Button variant="ghost" size="sm" onClick={selectAll} className={isMobile ? "text-xs px-2" : ""}>
                {isMobile ? "All" : "Select All"}
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll} className={isMobile ? "text-xs px-2" : ""}>
                Clear
              </Button>
              
              {/* Delete Selected */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={selectedIds.size === 0 || isDeleting}
                    className={`text-destructive border-destructive/50 hover:bg-destructive/10 ${isMobile ? 'flex-1' : ''}`}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    {isMobile ? `Del (${selectedIds.size})` : `Delete Selected (${selectedIds.size})`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selectedIds.size} Session(s)?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedIds.size} selected session(s)? 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteSelected}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete Selected'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete All */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    disabled={filteredSessions.length === 0 || isDeleting}
                    className={isMobile ? "flex-1" : ""}
                  >
                    {isMobile ? "All" : "Delete All"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All {filteredSessions.length} Sessions?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        This will permanently delete <strong>all {filteredSessions.length} sessions</strong> currently shown. 
                        This action cannot be undone.
                      </p>
                      <p className="text-sm">
                        To confirm, type <strong className="text-destructive">delete all</strong> below:
                      </p>
                      <Input
                        value={deleteAllConfirmText}
                        onChange={(e) => setDeleteAllConfirmText(e.target.value)}
                        placeholder="Type 'delete all' to confirm"
                        className="mt-2"
                      />
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteAllConfirmText('')}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleteAllConfirmText.toLowerCase() !== 'delete all' || isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        'Delete All Sessions'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button variant="ghost" size="sm" onClick={toggleSelectMode} className={isMobile ? "flex-1" : ""}>
                <XSquare className="h-4 w-4 mr-1.5" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <SessionHistorySearch
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        dateFilter={dateFilter}
        onDateFilterChange={handleDateFilterChange}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={handleCategoryFilterChange}
        resultCount={filteredSessions.length}
        totalCount={sessions.length}
        showPatientDetails={showPatientDetails}
        onShowPatientDetailsChange={setShowPatientDetails}
      />

      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <History className="h-8 w-8 mb-2 opacity-50" />
              <p className="font-medium">No consultations found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {paginatedSessions.map((session) => {
              const isSelected = selectedIds.has(session.id);
              return (
                <SessionHistoryRow
                  key={session.id}
                  session={session}
                  isSelectMode={isSelectMode}
                  isSelected={isSelected}
                  onToggleSelect={() => toggleSelection(session.id)}
                  onView={() => onLoadSession(session.id)}
                  onDelete={() => onDeleteSession(session.id)}
                  onRefresh={onRefresh}
                  isMobile={isMobile}
                  showPatientDetails={showPatientDetails}
                />
              );
            })}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredSessions.length)} of {filteredSessions.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {!isMobile && <span className="ml-1">Previous</span>}
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  {!isMobile && <span className="mr-1">Next</span>}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
