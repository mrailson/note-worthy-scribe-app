import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScribeSession, ScribeSettings, ConsultationViewMode, SOAPNote, NoteStyle, CONSULTATION_CATEGORY_LABELS, ConsultationCategory } from "@/types/scribe";
import { History, Trash2, FileText, Clock, Loader2, ArrowLeft, Copy, ChevronRight, List, Zap, Settings2, User, Lightbulb, Stethoscope, Heart, HandHeart, CheckSquare, XSquare, ChevronLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { ConsultationViewControls } from "./ConsultationViewControls";
import { NoteStyleToggle } from "./NoteStyleToggle";
import { PatientLetterView } from "./PatientLetterView";
import { SessionHistorySearch, DateFilter, CategoryFilter } from "./SessionHistorySearch";
import { supabase } from "@/integrations/supabase/client";

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

  // Calculate word count from actual notes content
  const calculatedWordCount = currentSoapNote 
    ? [currentSoapNote.S, currentSoapNote.O, currentSoapNote.A, currentSoapNote.P]
        .join(' ')
        .split(/\s+/)
        .filter(word => word.length > 0).length
    : currentSession?.wordCount || 0;

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
    const notMentionedPatterns = /\b(none\s*mentioned|not\s*mentioned|none\s*discussed|none\s*given|none\s*made|none\s*required|n\/a|nil|not\s*applicable|no\s*significant|not\s*recorded|not\s*documented)\b/i;
    
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
                        aria-label="Structured (SOAP)"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Structured (SOAP)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleViewModeChange('narrative')}
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          settings.consultationViewMode === 'narrative' 
                            ? "text-primary bg-primary/10" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="Narrative"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Narrative</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleViewModeChange('summary')}
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          settings.consultationViewMode === 'summary' 
                            ? "text-primary bg-primary/10" 
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                        aria-label="Quick Summary"
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Quick Summary</TooltipContent>
                  </Tooltip>
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
                  <div className="w-px h-4 bg-border mx-1" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setDisplaySettingsOpen(true)}
                        className="p-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                        aria-label="Display Settings"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Display Settings</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="consultation" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="consultation">F2F Consultation</TabsTrigger>
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

                    {/* Narrative View Mode */}
                    {settings.consultationViewMode === 'narrative' && (
                      <Card className={cn(
                        "border-2 bg-gradient-to-br to-transparent",
                        settings.noteStyle === 'shorthand' 
                          ? "from-amber-500/10 border-amber-500/30" 
                          : "from-background"
                      )}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                {settings.noteStyle === 'shorthand' ? 'GP Shorthand' : 'Clinical Note'}
                              </CardTitle>
                              {settings.noteStyle === 'shorthand' && (
                                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                  Concise
                                </Badge>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(getNarrativeText(), 'Clinical note')}>
                              <Copy className="h-3 w-3 mr-1" /> Copy All
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <pre className={cn(
                            "whitespace-pre-wrap font-sans leading-relaxed",
                            settings.noteStyle === 'shorthand' 
                              ? "text-base font-medium tracking-tight" 
                              : "text-sm"
                          )}>
                            {getNarrativeText()}
                          </pre>
                        </CardContent>
                      </Card>
                    )}

                    {/* Summary View Mode */}
                    {settings.consultationViewMode === 'summary' && (
                      <Card className={cn(
                        "border-2 bg-gradient-to-br to-transparent",
                        settings.noteStyle === 'shorthand' 
                          ? "from-amber-500/10 border-amber-500/30" 
                          : "from-primary/5"
                      )}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base">
                                {settings.noteStyle === 'shorthand' ? 'GP Shorthand' : 'Quick Summary'}
                              </CardTitle>
                              {settings.noteStyle === 'shorthand' && (
                                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                  &lt;100 words
                                </Badge>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(getSummaryText(), 'Summary')}>
                              <Copy className="h-3 w-3 mr-1" /> Copy
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <pre className={cn(
                            "whitespace-pre-wrap font-sans leading-relaxed",
                            settings.noteStyle === 'shorthand' 
                              ? "text-base font-medium tracking-tight" 
                              : "text-sm"
                          )}>
                            {getSummaryText()}
                          </pre>
                        </CardContent>
                      </Card>
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
              
              <TabsContent value="transcript" className="mt-4">
                {currentSession.transcript ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Recorded on {format(new Date(currentSession.createdAt), "EEEE, d MMMM yyyy 'at' HH:mm")}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyToClipboard(currentSession.transcript, 'Transcript')}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <ScrollArea className="h-[400px] rounded-xl border bg-gradient-to-b from-amber-50/50 to-white dark:from-slate-900/50 dark:to-slate-950 shadow-inner">
                      <TranscriptDisplay transcript={currentSession.transcript} />
                    </ScrollArea>
                  </div>
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
          <div className={`space-y-3`}>
            {paginatedSessions.map((session) => {
              const CategoryIcon = categoryIcons[session.consultationCategory || 'general'];
              const isSelected = selectedIds.has(session.id);
              return (
                <Card 
                  key={session.id} 
                  className={cn(
                    "hover:bg-muted/50 transition-colors cursor-pointer touch-manipulation",
                    isSelectMode && isSelected && "ring-2 ring-primary bg-primary/5"
                  )}
                  onClick={() => {
                    if (isSelectMode) {
                      toggleSelection(session.id);
                    } else {
                      onLoadSession(session.id);
                    }
                  }}
                >
                  <CardHeader className={`pb-2 ${isMobile ? 'px-3 py-3' : ''}`}>
                    <div className="flex items-start justify-between">
                      {isSelectMode && (
                        <div className="mr-3 mt-0.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelection(session.id)}
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-base line-clamp-1">
                            {session.title}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.duration ? `${Math.floor(session.duration)}m` : '0m'}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {session.wordCount || 0} words
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={session.status === 'completed' ? 'secondary' : 'outline'}>
                          {session.status}
                        </Badge>
                        {!isSelectMode && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={`pt-0 ${isMobile ? 'px-3 pb-3' : ''}`}>
                    <p className="text-sm text-muted-foreground mb-2">
                      {format(new Date(session.createdAt), 'dd MMM yyyy, HH:mm')}
                    </p>
                    
                    {/* Quick Summary - Key clinical one-liner */}
                    {session.quickSummary && (
                      <div className={`flex items-start gap-2 p-2 rounded-md bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/30 mb-3 ${isMobile ? 'p-2' : ''}`}>
                        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <p className={`text-amber-800 dark:text-amber-200 line-clamp-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                          {session.quickSummary}
                        </p>
                      </div>
                    )}
                    
                    {/* Fallback to transcript preview if no quick summary */}
                    {!session.quickSummary && session.transcript && (
                      <p className={`text-foreground/70 line-clamp-2 mb-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                        {session.transcript.substring(0, isMobile ? 100 : 150)}...
                      </p>
                    )}
                    
                    {!isSelectMode && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="outline" 
                          size={isMobile ? "default" : "sm"}
                          className="flex-1 touch-manipulation"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadSession(session.id);
                          }}
                        >
                          {isMobile ? "View" : "View Session"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this session and all its data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => onDeleteSession(session.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </CardContent>
                </Card>
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
