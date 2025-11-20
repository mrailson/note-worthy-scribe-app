import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
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
  Download
} from 'lucide-react';

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
  meetingContext: {
    title?: string;
    type?: string;
    participants?: string[];
  };
}

export function MeetingCoachModal({
  isOpen,
  onClose,
  isRecording,
  getLiveTranscript,
  meetingContext
}: MeetingCoachModalProps) {
  const [currentInsight, setCurrentInsight] = useState<CoachInsight | null>(null);
  const [insightHistory, setInsightHistory] = useState<CoachInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number | null>(null);
  const [meetingStartTime] = useState(Date.now());
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastWordCount, setLastWordCount] = useState(0);

  const getLastNSeconds = (fullTranscript: string, seconds: number): string => {
    const estimatedChars = seconds * 16.67; // ~500 chars per 30s
    return fullTranscript.slice(-estimatedChars);
  };

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  const analyzeTranscript = async (recentChunk: string, fullTranscript: string) => {
    setIsAnalyzing(true);
    
    const meetingDurationMinutes = Math.floor((Date.now() - meetingStartTime) / 60000);
    
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
    const transcript = getLiveTranscript();
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
      const transcript = getLiveTranscript();
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
    const minutes = Math.floor((Date.now() - meetingStartTime) / 60000);
    const seconds = Math.floor(((Date.now() - meetingStartTime) % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const exportCoachNotes = (): void => {
    if (!currentInsight) return;
    
    const notes = `
# Meeting Coach Summary
Generated: ${new Date().toLocaleString('en-GB')}

## Meeting Completeness: ${currentInsight.wrapUp.completenessScore}%

## Main Topics Covered
${currentInsight.overview.mainTopics.map(t => `- ${t}`).join('\n')}

## Decisions Made
${currentInsight.overview.decisions.map(d => `- ${d}`).join('\n')}

## Action Items
${currentInsight.overview.actionItems.map(a => `- ${a}`).join('\n')}

## ⚠️ Items Requiring Follow-Up

### Unanswered Questions
${currentInsight.wrapUp.unansweredQuestions.map(q => `- ${q}`).join('\n')}

### Unresolved Issues
${currentInsight.wrapUp.unresolvedIssues.map(i => `- ${i}`).join('\n')}

### Needs Clarification
${currentInsight.wrapUp.needsClarification.map(c => `- ${c}`).join('\n')}

## Suggested Follow-Up Questions
${currentInsight.wrapUp.suggestedFinalQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')}
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

        <ScrollArea className="flex-1 px-6 py-4">
          {!currentInsight && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
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
            <div className="space-y-6">
              {/* Section 1: Real-Time */}
              <div className="p-4 bg-destructive/10 border-l-4 border-destructive rounded">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  REAL-TIME (Last 30s)
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Just Discussed:</p>
                    <ul className="text-sm space-y-1">
                      {currentInsight.realTime.recentSummary.map((point, i) => (
                        <li key={i}>• {point}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-background p-3 rounded border">
                    <p className="text-xs text-muted-foreground mb-1">❓ Ask Right Now:</p>
                    <p className="text-sm font-medium">{currentInsight.realTime.suggestedQuestion}</p>
                  </div>
                </div>
              </div>

              {/* Section 2: Meeting Overview */}
              <div className="p-4 bg-primary/10 border-l-4 border-primary rounded">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  MEETING OVERVIEW (So Far)
                </h3>
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
                  
                  {currentInsight.overview.actionItems.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">📋 Action Items ({currentInsight.overview.actionItems.length})</p>
                      <ul className="space-y-1">
                        {currentInsight.overview.actionItems.map((item, i) => (
                          <li key={i}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Wrap-Up Assistant */}
              <div className="p-4 bg-warning/10 border-l-4 border-warning rounded">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  WRAP-UP ASSISTANT
                </h3>
                
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Meeting Completeness:</span>
                    <span className="text-sm font-bold">{currentInsight.wrapUp.completenessScore}%</span>
                  </div>
                  <Progress value={currentInsight.wrapUp.completenessScore} className="h-2" />
                </div>

                <div className="space-y-3 text-sm">
                  {currentInsight.wrapUp.unansweredQuestions.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        ❓ Unanswered Questions ({currentInsight.wrapUp.unansweredQuestions.length})
                      </p>
                      <ul className="space-y-1">
                        {currentInsight.wrapUp.unansweredQuestions.map((q, i) => (
                          <li key={i} className="text-destructive">• {q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentInsight.wrapUp.unresolvedIssues.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        🔧 Issues Needing Resolution ({currentInsight.wrapUp.unresolvedIssues.length})
                      </p>
                      <ul className="space-y-1">
                        {currentInsight.wrapUp.unresolvedIssues.map((issue, i) => (
                          <li key={i} className="text-destructive">• {issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentInsight.wrapUp.needsClarification.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        💡 Needs Clarification ({currentInsight.wrapUp.needsClarification.length})
                      </p>
                      <ul className="space-y-1">
                        {currentInsight.wrapUp.needsClarification.map((item, i) => (
                          <li key={i} className="text-warning">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentInsight.wrapUp.suggestedFinalQuestions.length > 0 && (
                    <div className="bg-background p-3 rounded border mt-3">
                      <p className="text-xs text-muted-foreground mb-2">💡 Suggested Final Questions:</p>
                      <ol className="space-y-1.5 list-decimal list-inside">
                        {currentInsight.wrapUp.suggestedFinalQuestions.map((q, i) => (
                          <li key={i} className="font-medium">{q}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {currentInsight.wrapUp.completenessScore >= 90 && (
                    <div className="bg-success/10 p-3 rounded border border-success">
                      <p className="text-success font-medium flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Meeting appears complete! All topics addressed.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
