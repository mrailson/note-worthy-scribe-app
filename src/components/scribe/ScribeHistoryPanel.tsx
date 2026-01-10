import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScribeSession, ScribeSettings, ConsultationViewMode, SOAPNote, NoteStyle } from "@/types/scribe";
import { History, Trash2, FileText, Clock, Loader2, ArrowLeft, Copy, ChevronRight, List, Zap, Settings2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { ConsultationViewControls } from "./ConsultationViewControls";
import { NoteStyleToggle } from "./NoteStyleToggle";
import { supabase } from "@/integrations/supabase/client";

interface ScribeHistoryPanelProps {
  sessions: ScribeSession[];
  isLoading: boolean;
  currentSession: ScribeSession | null;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRefresh: () => void;
  onClearCurrentSession: () => void;
  settings: ScribeSettings;
  onUpdateSetting: <K extends keyof ScribeSettings>(key: K, value: ScribeSettings[K]) => void;
}

export const ScribeHistoryPanel = ({
  sessions,
  isLoading,
  currentSession,
  onLoadSession,
  onDeleteSession,
  onRefresh,
  onClearCurrentSession,
  settings,
  onUpdateSetting,
}: ScribeHistoryPanelProps) => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratedNotes, setRegeneratedNotes] = useState<SOAPNote | null>(null);
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
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

  // Filter out "None mentioned", "N/A", "Nil", etc. lines when toggle is off
  const filterNotMentioned = useCallback((text: string): string => {
    if (settings.showNotMentioned) return text;
    
    const notMentionedPatterns = /\b(none\s*mentioned|not\s*mentioned|n\/a|nil|not\s*applicable|no\s*significant|not\s*recorded|not\s*documented)\b/i;
    
    return text
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        // Keep empty lines and lines that don't match the patterns
        if (!trimmed) return true;
        return !notMentionedPatterns.test(trimmed);
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
          toast.success(`Notes regenerated at ${newLevel === 1 ? 'Code' : newLevel === 2 ? 'Brief' : newLevel === 3 ? 'Standard' : newLevel === 4 ? 'Detailed' : 'Full'} detail`);
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
          <Button variant="ghost" size="sm" onClick={handleClearCurrentSession}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to History
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{currentSession.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(currentSession.createdAt), 'EEEE, d MMMM yyyy \'at\' HH:mm')}
                </p>
              </div>
              <Badge variant="secondary">{currentSession.status}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" />
          Session History
        </h2>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-4">
          {sessions.map((session) => (
            <Card 
              key={session.id} 
              className="hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => onLoadSession(session.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base line-clamp-1">
                      {session.title}
                    </CardTitle>
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
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">
                  {format(new Date(session.createdAt), 'dd MMM yyyy, HH:mm')}
                </p>
                {session.transcript && (
                  <p className="text-sm text-foreground/70 line-clamp-2 mb-3">
                    {session.transcript.substring(0, 150)}...
                  </p>
                )}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onLoadSession(session.id);
                    }}
                  >
                    View Session
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
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
