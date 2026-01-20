import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastWrapper';
import { 
  Activity, 
  BarChart3, 
  AlertCircle, 
  Sparkles, 
  Minimize2, 
  RefreshCw,
  CheckCircle2,
  Clock,
  Download,
  ChevronDown,
  Pencil
} from 'lucide-react';
import { ActionItemAssigner, ActionItemAssignment, Attendee } from './ActionItemAssigner';
import { generateActionItemId, cleanActionItemText } from '@/utils/meetingCoachIntegration';
import { 
  CorrectionRule, 
  loadCorrections, 
  addCorrection, 
  removeCorrection, 
  applyCorrectionsToInsight 
} from '@/utils/meetingCoachCorrections';
import { CorrectionDialog } from './CorrectionDialog';

interface CoachInsight {
  realTime: {
    recentSummary: string[];
    suggestedQuestion: string;
  };
  overview: {
    mainTopics: string[];
    decisions: string[];
    actionItems: string[];
    keyPoints: string[];
  };
  wrapUp: {
    unansweredQuestions: string[];
    unresolvedIssues: string[];
    needsClarification: string[];
    suggestedFinalQuestions: string[];
    completenessScore: number;
  };
  timestamp: string;
  id: number;
}

interface MeetingCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRecording: boolean;
  getLiveTranscript: () => string;
  recordingDuration?: number; // Duration in seconds from parent
  meetingContext: {
    title?: string;
    type?: string;
    participants?: string[];
    chair?: string;
  };
}

export function MeetingCoachModal({
  isOpen,
  onClose,
  isRecording,
  getLiveTranscript,
  recordingDuration = 0,
  meetingContext
}: MeetingCoachModalProps) {
  const { user } = useAuth();
  const [currentInsight, setCurrentInsight] = useState<CoachInsight | null>(null);
  const [insightHistory, setInsightHistory] = useState<CoachInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastWordCount, setLastWordCount] = useState(0);
  const [activeTab, setActiveTab] = useState('realtime');
  
  // Assignment state
  const [assignments, setAssignments] = useState<Map<string, ActionItemAssignment>>(new Map());
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
  const [availableAttendees, setAvailableAttendees] = useState<Attendee[]>([]);
  const [removedActions, setRemovedActions] = useState<Set<string>>(new Set());
  const [meetingId, setMeetingId] = useState<string>(() => {
    return sessionStorage.getItem('currentMeetingId') || 'temp';
  });

  // Correction state
  const [corrections, setCorrections] = useState<CorrectionRule[]>([]);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);
  const [selectedTextForCorrection, setSelectedTextForCorrection] = useState('');

  // Apply corrections to current insight
  const correctedInsight = useMemo(() => {
    if (!currentInsight || corrections.length === 0) {
      return currentInsight;
    }
    return applyCorrectionsToInsight(currentInsight, corrections);
  }, [currentInsight, corrections]);

  // Memoized badge counts for action items
  const actionItemCounts = useMemo(() => {
    if (!correctedInsight) {
      return { total: 0, unassigned: 0, assigned: 0 };
    }
    
    let total = 0;
    let unassigned = 0;
    let assigned = 0;
    
    correctedInsight.overview.actionItems.forEach((item, index) => {
      const itemId = generateActionItemId(item, index);
      
      // Skip removed items
      if (removedActions.has(itemId)) {
        return;
      }
      
      total++;
      
      if (assignments.has(itemId)) {
        assigned++;
      } else {
        unassigned++;
      }
    });
    
    return { total, unassigned, assigned };
  }, [correctedInsight, assignments, removedActions]);

  // Get all insight text for correction preview
  const getAllInsightText = (): string => {
    if (!currentInsight) return '';
    
    const parts = [
      ...currentInsight.realTime.recentSummary,
      currentInsight.realTime.suggestedQuestion,
      ...currentInsight.overview.mainTopics,
      ...currentInsight.overview.decisions,
      ...currentInsight.overview.actionItems,
      ...currentInsight.overview.keyPoints,
      ...currentInsight.wrapUp.unansweredQuestions,
      ...currentInsight.wrapUp.unresolvedIssues,
      ...currentInsight.wrapUp.needsClarification,
      ...currentInsight.wrapUp.suggestedFinalQuestions
    ];
    
    return parts.join(' ');
  };

  // Monitor currentMeetingId changes in sessionStorage
  useEffect(() => {
    const checkMeetingId = () => {
      try {
        const currentId = sessionStorage.getItem('currentMeetingId');
        if (currentId && currentId !== meetingId) {
          console.log('Meeting ID updated:', currentId);
          setMeetingId(currentId);
        }
      } catch (error) {
        console.error('Failed to check meeting ID:', error);
      }
    };

    // Check immediately
    checkMeetingId();

    // Check periodically in case it changes
    const interval = setInterval(checkMeetingId, 500);

    return () => clearInterval(interval);
  }, [meetingId]);

  // Load attendees from database
  useEffect(() => {
    const loadAttendees = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('attendees')
          .select('id, name, email, title, organization, role')
          .eq('user_id', user.id)
          .order('name');
        
        if (error) throw error;
        if (data) {
          setAvailableAttendees(data as Attendee[]);
        }
      } catch (error) {
        console.error('Error loading attendees:', error);
      }
    };
    
    loadAttendees();
  }, [user]);

  // Load saved assignments from sessionStorage
  useEffect(() => {
    if (!meetingId || meetingId === 'temp') return;
    
    const storageKey = `meetingCoach-assignments-${meetingId}`;
    const recentKey = `meetingCoach-recentlyUsed-${meetingId}`;
    const removedKey = `meetingCoach-removedActions-${meetingId}`;
    
    try {
      const saved = sessionStorage.getItem(storageKey);
      const savedRecent = sessionStorage.getItem(recentKey);
      const savedRemoved = sessionStorage.getItem(removedKey);
      
      if (saved) {
        const parsed = JSON.parse(saved);
        setAssignments(new Map(Object.entries(parsed)));
      }
      
      if (savedRecent) {
        setRecentlyUsed(JSON.parse(savedRecent));
      }

      if (savedRemoved) {
        setRemovedActions(new Set(JSON.parse(savedRemoved)));
      }
    } catch (error) {
      console.error('Failed to load Meeting Coach data from sessionStorage:', error);
      showToast.error('Failed to load saved assignments');
    }
  }, [meetingId]);

  // Load corrections from sessionStorage
  useEffect(() => {
    if (!meetingId || meetingId === 'temp') {
      setCorrections([]);
      return;
    }
    
    const loaded = loadCorrections(meetingId);
    setCorrections(loaded);
  }, [meetingId]);

  // Save assignments to sessionStorage
  useEffect(() => {
    if (!meetingId || meetingId === 'temp') return;
    
    const storageKey = `meetingCoach-assignments-${meetingId}`;
    const recentKey = `meetingCoach-recentlyUsed-${meetingId}`;
    const removedKey = `meetingCoach-removedActions-${meetingId}`;
    
    try {
      const assignmentsObj = Object.fromEntries(assignments);
      sessionStorage.setItem(storageKey, JSON.stringify(assignmentsObj));
      sessionStorage.setItem(recentKey, JSON.stringify(recentlyUsed));
      sessionStorage.setItem(removedKey, JSON.stringify(Array.from(removedActions)));
    } catch (error) {
      console.error('Failed to save assignments to sessionStorage:', error);
    }
  }, [assignments, recentlyUsed, removedActions, meetingId]);

  const handleAssign = (assignment: ActionItemAssignment) => {
    setAssignments(prev => new Map(prev).set(assignment.id, assignment));
    
    // Add to recently used if not already there
    if (assignment.assignee && !recentlyUsed.includes(assignment.assignee)) {
      setRecentlyUsed(prev => [assignment.assignee!, ...prev].slice(0, 3));
    }
  };

  const handleUpdateDueDate = (actionItemId: string, dueDate: string) => {
    setAssignments(prev => {
      const current = prev.get(actionItemId);
      if (current) {
        const updated = { ...current, dueDate };
        return new Map(prev).set(actionItemId, updated);
      }
      return prev;
    });
  };

  const handleRemoveAssignment = (actionItemId: string) => {
    setAssignments(prev => {
      const next = new Map(prev);
      next.delete(actionItemId);
      return next;
    });
  };

  const handleRemoveAction = (actionItemId: string) => {
    setRemovedActions(prev => new Set(prev).add(actionItemId));
    // Also remove any assignment
    setAssignments(prev => {
      const next = new Map(prev);
      next.delete(actionItemId);
      return next;
    });
  };

  const getLastNSeconds = (fullTranscript: string, seconds: number): string => {
    const estimatedChars = seconds * 16.67; // ~500 chars per 30s
    return fullTranscript.slice(-estimatedChars);
  };

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  const getTranscriptFromChunksOrLive = async (): Promise<string> => {
    // Prefer reconstructed transcript from meeting_transcription_chunks, fallback to live transcript
    const liveTranscript = getLiveTranscript();

    try {
      const meetingId = sessionStorage.getItem('currentMeetingId');
      if (!meetingId) {
        return liveTranscript || '';
      }

      const { data: chunks, error } = await supabase
        .from('meeting_transcription_chunks')
        .select('transcription_text')
        .eq('meeting_id', meetingId)
        .order('chunk_number', { ascending: true });

      if (error || !chunks || chunks.length === 0) {
        if (error) {
          console.warn('MeetingCoach: error loading chunks, falling back to live transcript', error);
        }
        return liveTranscript || '';
      }

      let fullTranscript = '';
      let allSegments: any[] = [];

      // Lazily import segment utilities to avoid bundling cost until needed
      const { mergeByTimestamps, segmentsToPlainText } = await import('@/lib/segmentMerge');

      for (const chunk of chunks) {
        try {
          const parsed = JSON.parse(chunk.transcription_text as any);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
            allSegments = mergeByTimestamps(allSegments, parsed);
          } else {
            fullTranscript = fullTranscript + (fullTranscript ? ' ' : '') + String(chunk.transcription_text || '');
          }
        } catch {
          // Legacy plain text - append directly
          fullTranscript = fullTranscript + (fullTranscript ? ' ' : '') + String(chunk.transcription_text || '');
        }
      }

      if (allSegments.length > 0) {
        fullTranscript = segmentsToPlainText(allSegments);
      }

      const finalText = (fullTranscript || '').trim();
      return finalText || liveTranscript || '';
    } catch (err) {
      console.error('MeetingCoach: failed to rebuild transcript from chunks, falling back to live transcript', err);
      return liveTranscript || '';
    }
  };

  const analyzeTranscript = async (recentChunk: string, fullTranscript: string) => {
    setIsAnalyzing(true);
    
    const meetingDurationMinutes = Math.floor(recordingDuration / 60);
    
    try {
      const { data, error } = await supabase.functions.invoke('meeting-coach-analyze', {
        body: {
          transcript: recentChunk,
          fullTranscript: fullTranscript.slice(-5000), // Last ~3 minutes for context
          previousAnalysis: currentInsight?.wrapUp,
          meetingDuration: meetingDurationMinutes,
          meetingContext
        }
      });
      
      if (error) throw error;
      
      const newInsight: CoachInsight = {
        ...data,
        timestamp: new Date().toISOString(),
        id: Date.now()
      };
      
      setCurrentInsight(newInsight);
      setInsightHistory(prev => [newInsight, ...prev.slice(0, 9)]); // Keep last 10
      setLastAnalysisTime(Date.now());
      setLastWordCount(countWords(fullTranscript));
      
      // Alert if completeness score is low after 15+ minutes
      if (meetingDurationMinutes >= 15 && data.wrapUp.completenessScore < 70) {
        showToast.warning('Meeting has unresolved items - check Wrap-Up section');
      }
      
    } catch (error) {
      console.error('Meeting coach analysis failed:', error);
      showToast.error('Failed to analyse transcript');
    } finally {
      setIsAnalyzing(false);
    }
  };
  const handleManualAnalysis = async () => {
    const transcript = await getTranscriptFromChunksOrLive();
    if (transcript.length < 50) {
      showToast.info('Not enough transcript to analyse yet');
      return;
    }
    
    const recentChunk = getLastNSeconds(transcript, 30);
    await analyzeTranscript(recentChunk, transcript);
  };

  // Auto-analysis every 30 seconds
  useEffect(() => {
    if (!isRecording || !isOpen || isMinimized) return;
    
    const analyzeInterval = setInterval(async () => {
      const transcript = await getTranscriptFromChunksOrLive();
      const wordsSinceLastAnalysis = countWords(transcript) - lastWordCount;
      
      if (wordsSinceLastAnalysis < 30) {
        console.log('Not enough new content, skipping analysis');
        return;
      }
      
      const recentChunk = getLastNSeconds(transcript, 30);
      
      if (recentChunk.length > 50) {
        await analyzeTranscript(recentChunk, transcript);
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(analyzeInterval);
  }, [isRecording, isOpen, isMinimized, lastWordCount]);

  const getTimeSinceLastAnalysis = (): string => {
    if (!lastAnalysisTime) return 'Never';
    const seconds = Math.floor((Date.now() - lastAnalysisTime) / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    return `${Math.floor(seconds / 60)} minutes ago`;
  };

  const getMeetingDuration = (): string => {
    const minutes = Math.floor(recordingDuration / 60);
    const seconds = recordingDuration % 60;
    return `${minutes}m ${seconds}s`;
  };

  const handleSaveCorrection = (correction: CorrectionRule): void => {
    const updated = addCorrection(meetingId, correction);
    setCorrections(updated);
    showToast.success(`Correction saved: ${correction.find} → ${correction.replace}`);
  };

  const handleDeleteCorrection = (correctionId: string): void => {
    const updated = removeCorrection(meetingId, correctionId);
    setCorrections(updated);
    showToast.success('Correction removed');
  };

  const openCorrectionDialog = (text: string): void => {
    setSelectedTextForCorrection(text);
    setShowCorrectionDialog(true);
  };

  const exportCoachNotes = (): void => {
    if (!correctedInsight) return;
    
    const notes = `
# Meeting Coach Summary
Generated: ${new Date().toLocaleString('en-GB')}

## Meeting Completeness: ${correctedInsight.wrapUp.completenessScore}%

## Main Topics Covered
${correctedInsight.overview.mainTopics.map(t => `- ${t}`).join('\n')}

## Decisions Made
${correctedInsight.overview.decisions.map(d => `- ${d}`).join('\n')}

## Action Items
${correctedInsight.overview.actionItems.map((item, index) => {
  const cleanItem = cleanActionItemText(item);
  const itemId = generateActionItemId(item, index);
  
  // Skip removed actions
  if (removedActions.has(itemId)) return null;
  
  const assignment = assignments.get(itemId);
  const assignee = assignment?.assignee || 'TBC';
  const dueDate = assignment?.dueDate || 'TBC';
  
  return `- [${assignee}] [${dueDate}] ${cleanItem}`;
}).filter(Boolean).join('\n')}

## ⚠️ Items Requiring Follow-Up

### Unanswered Questions
${correctedInsight.wrapUp.unansweredQuestions.map(q => `- ${q}`).join('\n')}

### Unresolved Issues
${correctedInsight.wrapUp.unresolvedIssues.map(i => `- ${i}`).join('\n')}

### Needs Clarification
${correctedInsight.wrapUp.needsClarification.map(c => `- ${c}`).join('\n')}

## Suggested Follow-Up Questions
${correctedInsight.wrapUp.suggestedFinalQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')}
    `.trim();

    const blob = new Blob([notes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-coach-notes-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast.success('Coach notes exported');
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="h-14 w-14 rounded-full shadow-lg bg-primary"
          size="icon"
        >
          <Sparkles className="h-6 w-6 animate-pulse" />
          {currentInsight && currentInsight.wrapUp.completenessScore < 70 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full animate-bounce" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Meeting Coach
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last Analysis: {getTimeSinceLastAnalysis()}
            </div>
            <Badge variant="outline" className="text-xs">
              Meeting: {getMeetingDuration()}
            </Badge>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleManualAnalysis}
              disabled={isAnalyzing || !isRecording}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? 'Analysing...' : 'Analyse Now'}
            </Button>
            {currentInsight && (
              <Button
                onClick={exportCoachNotes}
                size="sm"
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {!currentInsight && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-6">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Start recording to get AI-powered meeting insights
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Analysis will begin automatically every 30 seconds
            </p>
          </div>
        )}

        {isAnalyzing && !currentInsight && (
          <div className="flex flex-col items-center justify-center h-full">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Analysing meeting...</p>
          </div>
        )}

        {currentInsight && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="mx-6 mt-4 grid grid-cols-4">
              <TabsTrigger value="realtime" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Real-Time
              </TabsTrigger>
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="actions" className="flex items-center gap-1 flex-wrap">
                <span className="whitespace-nowrap">Action Items</span>
                <div className="flex items-center gap-0.5">
                  {actionItemCounts.unassigned > 0 && (
                    <>
                      <Badge className="h-4 px-1 text-[10px] bg-orange-500 hover:bg-orange-600 text-white">
                        {actionItemCounts.unassigned}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">=</span>
                    </>
                  )}
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {actionItemCounts.total}
                  </Badge>
                </div>
              </TabsTrigger>
              <TabsTrigger value="wrapup" className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Wrap-Up
              </TabsTrigger>
            </TabsList>

            <TabsContent value="realtime" className="flex-1 mt-0">
              <ScrollArea className="h-[calc(85vh-220px)] px-6 py-4">
                <div className="p-4 bg-destructive/10 border-l-4 border-destructive rounded">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Just Discussed:</p>
                      <ul className="text-sm space-y-1">
                        {correctedInsight.realTime.recentSummary.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 group">
                            <span className="flex-1">• {point}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => openCorrectionDialog(point)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-background p-3 rounded border">
                      <p className="text-xs text-muted-foreground mb-1">❓ Ask Right Now:</p>
                      <div className="flex items-start gap-2 group">
                        <p className="text-sm font-medium flex-1">{correctedInsight.realTime.suggestedQuestion}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openCorrectionDialog(correctedInsight.realTime.suggestedQuestion)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="overview" className="flex-1 mt-0">
              <ScrollArea className="h-[calc(85vh-220px)] px-6 py-4">
                <div className="p-4 bg-primary/10 border-l-4 border-primary rounded">
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">🎯 Main Topics ({currentInsight.overview.mainTopics.length})</p>
                      <ul className="space-y-1">
                        {currentInsight.overview.mainTopics.map((topic, i) => (
                          <li key={i}>• {topic}</li>
                        ))}
                      </ul>
                    </div>
                    
                    {currentInsight.overview.decisions.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">✅ Decisions Made ({currentInsight.overview.decisions.length})</p>
                        <ul className="space-y-1">
                          {currentInsight.overview.decisions.map((decision, i) => (
                            <li key={i}>• {decision}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="actions" className="flex-1 mt-0">
              <ScrollArea className="h-[calc(85vh-220px)] px-6 py-4">
                <div className="p-4 bg-primary/10 border-l-4 border-primary rounded">
                  <div className="space-y-3">
                    {correctedInsight.overview.actionItems.length > 0 ? (
                      <ul className="space-y-3">
                        {correctedInsight.overview.actionItems.map((item, i) => {
                          const cleanItem = cleanActionItemText(item);
                          const itemId = generateActionItemId(item, i);
                          
                          // Filter out removed actions
                          if (removedActions.has(itemId)) return null;
                          
                          const assignment = assignments.get(itemId);
                          
                          return (
                            <li key={i} className="flex flex-col gap-1 p-3 bg-background/50 rounded border border-border/50">
                              <div className="flex items-start gap-2 group">
                                <span className="text-sm flex-1">• {cleanItem}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => openCorrectionDialog(cleanItem)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                              <ActionItemAssigner
                                actionItem={cleanItem}
                                actionItemId={itemId}
                                currentAssignment={assignment || null}
                                currentUserName={user?.email?.split('@')[0] || 'Me'}
                                chairName={meetingContext.chair}
                                meetingParticipants={meetingContext.participants || []}
                                availableAttendees={availableAttendees}
                                recentlyUsed={recentlyUsed}
                                onAssign={handleAssign}
                                onRemove={handleRemoveAssignment}
                                onUpdateDueDate={handleUpdateDueDate}
                                onRemoveAction={handleRemoveAction}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No action items identified yet...</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="wrapup" className="flex-1 mt-0">
              <ScrollArea className="h-[calc(85vh-220px)] px-6 py-4">
                <div className="p-4 bg-warning/10 border-l-4 border-warning rounded">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Meeting Completeness:</span>
                      <span className="text-sm font-bold">{correctedInsight.wrapUp.completenessScore}%</span>
                    </div>
                    <Progress value={correctedInsight.wrapUp.completenessScore} className="h-2" />
                  </div>

                  <div className="space-y-3 text-sm">
                    {(() => {
                      const allItems: Array<{ text: string; type: 'question' | 'issue' | 'clarification'; priority: number }> = [
                        ...correctedInsight.wrapUp.unansweredQuestions.map(q => ({ 
                          text: q, 
                          type: 'question' as const, 
                          priority: 1 
                        })),
                        ...correctedInsight.wrapUp.unresolvedIssues.map(i => ({ 
                          text: i, 
                          type: 'issue' as const, 
                          priority: 1 
                        })),
                        ...correctedInsight.wrapUp.needsClarification.map(c => ({ 
                          text: c, 
                          type: 'clarification' as const, 
                          priority: 2 
                        }))
                      ];

                      const topItems = allItems
                        .sort((a, b) => a.priority - b.priority)
                        .slice(0, 5);

                      return topItems.length > 0 ? (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">
                            🎯 Top Priority Items (Showing {topItems.length} of {allItems.length})
                          </p>
                          <ul className="space-y-1">
                            {topItems.map((item, i) => (
                              <li 
                                key={i} 
                                className={`flex items-start gap-2 group ${item.type === 'clarification' ? 'text-warning' : 'text-destructive'}`}
                              >
                                <span className="flex-1">
                                  {item.type === 'question' && '❓ '}
                                  {item.type === 'issue' && '🔧 '}
                                  {item.type === 'clarification' && '💡 '}
                                  {item.text}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => openCorrectionDialog(item.text)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null;
                    })()}

                    {correctedInsight.wrapUp.suggestedFinalQuestions.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">
                          💬 Suggested Closing Questions ({Math.min(5, correctedInsight.wrapUp.suggestedFinalQuestions.length)})
                        </p>
                        <ul className="space-y-1">
                          {correctedInsight.wrapUp.suggestedFinalQuestions.slice(0, 5).map((q, i) => (
                            <li key={i} className="flex items-start gap-2 group">
                              <span className="flex-1">• {q}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => openCorrectionDialog(q)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>

      <CorrectionDialog
        isOpen={showCorrectionDialog}
        onClose={() => setShowCorrectionDialog(false)}
        onSave={handleSaveCorrection}
        prefilledText={selectedTextForCorrection}
        insightText={getAllInsightText()}
      />
    </Dialog>
  );
}
