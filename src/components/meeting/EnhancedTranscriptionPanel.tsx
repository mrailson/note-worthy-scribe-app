import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Clock, ChevronDown, ChevronUp, FileText, Users, Sparkles, 
  AlertTriangle, Copy, Eye, EyeOff, BarChart3, Trash2, Check, X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { removeFillerWords, countFillerWords, type FillerWordStats } from '@/utils/fillerWordCleaner';
import { detectPII, highlightPII, maskPII, removePII, type PIIMatch } from '@/utils/piiDetector';
import { cleanTranscript } from '@/lib/transcriptCleaner';
import { NHS_DEFAULT_RULES } from '@/lib/nhsDefaultRules';
import { toast } from 'sonner';

interface TranscriptionChunk {
  id: string;
  chunk_number: number;
  transcription_text: string;
  cleaned_text: string | null;
  confidence: number;
  created_at: string;
  word_count: number;
}

interface EnhancedTranscriptionPanelProps {
  meetingId: string;
  transcript: string;
  onTranscriptChange: (newTranscript: string) => void;
  meetingContext?: any;
}

export const EnhancedTranscriptionPanel: React.FC<EnhancedTranscriptionPanelProps> = ({
  meetingId,
  transcript,
  onTranscriptChange,
  meetingContext
}) => {
  const [chunks, setChunks] = useState<TranscriptionChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [showConfidence, setShowConfidence] = useState(false);
  const [showPII, setShowPII] = useState(true);
  const [showContext, setShowContext] = useState(true);
  const [showStats, setShowStats] = useState(false);
  
  // PII State
  const [piiMatches, setPiiMatches] = useState<PIIMatch[]>([]);
  const [selectedPII, setSelectedPII] = useState<Set<number>>(new Set());
  
  // Fetch chunks
  useEffect(() => {
    if (!meetingId) return;
    
    const fetchChunks = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('meeting_transcription_chunks')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('chunk_number', { ascending: true });
        
        if (error) throw error;
        setChunks(data || []);
      } catch (error) {
        console.error('Error fetching chunks:', error);
        toast.error('Failed to load transcription chunks');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchChunks();
  }, [meetingId]);

  // Detect PII whenever transcript changes
  useEffect(() => {
    if (transcript && showPII) {
      const result = detectPII(transcript);
      setPiiMatches(result.matches);
    }
  }, [transcript, showPII]);

  // Calculate statistics
  const stats = useMemo(() => {
    const wordCount = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    const fillerStats = countFillerWords(transcript);
    const avgConfidence = chunks.length > 0 
      ? chunks.reduce((sum, c) => sum + (c.confidence || 0), 0) / chunks.length 
      : 0;
    const lowConfidenceCount = chunks.filter(c => c.confidence < 0.7).length;
    
    return {
      wordCount,
      totalChunks: chunks.length,
      avgConfidence: Math.round(avgConfidence * 100),
      lowConfidenceCount,
      fillerWordCount: fillerStats.totalRemoved,
      piiCount: piiMatches.length
    };
  }, [transcript, chunks, piiMatches]);

  // Parse context from transcript
  const contextData = useMemo(() => {
    if (!meetingContext && !transcript) return null;
    
    const agendaMatch = transcript.match(/📋\s*MEETING\s*AGENDA:?\s*\n([\s\S]*?)(?=\n\n|$)/i);
    const attendeesMatch = transcript.match(/👥\s*ATTENDEES:?\s*\n([\s\S]*?)(?=\n\n|$)/i);
    
    return {
      agenda: agendaMatch ? agendaMatch[1].trim() : null,
      attendees: attendeesMatch ? attendeesMatch[1].trim().split('\n').filter(Boolean) : []
    };
  }, [transcript, meetingContext]);

  // Quick Actions
  const handleRemoveFillerWords = () => {
    const { cleaned, stats } = removeFillerWords(transcript);
    onTranscriptChange(cleaned);
    toast.success(`Removed ${stats.totalRemoved} filler words`);
  };

  const handleCleanMedicalTerms = () => {
    const result = cleanTranscript(transcript, NHS_DEFAULT_RULES);
    onTranscriptChange(result.cleaned);
    toast.success(`Applied ${result.appliedRuleIds.length} NHS term corrections`);
  };

  const handleMaskAllPII = () => {
    let maskedText = transcript;
    // Apply masks in reverse order to preserve indices
    for (let i = piiMatches.length - 1; i >= 0; i--) {
      maskedText = maskPII(maskedText, piiMatches[i]);
    }
    onTranscriptChange(maskedText);
    toast.success(`Masked ${piiMatches.length} PII instances`);
  };

  const handleMaskSelectedPII = () => {
    let maskedText = transcript;
    const selectedMatches = piiMatches.filter((_, i) => selectedPII.has(i));
    
    for (let i = selectedMatches.length - 1; i >= 0; i--) {
      maskedText = maskPII(maskedText, selectedMatches[i]);
    }
    onTranscriptChange(maskedText);
    setSelectedPII(new Set());
    toast.success(`Masked ${selectedMatches.length} selected PII instances`);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.7) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getPIIColor = (type: PIIMatch['type']) => {
    switch (type) {
      case 'nhs_number': return 'bg-red-200 border-red-400';
      case 'name': return 'bg-amber-200 border-amber-400';
      case 'dob': return 'bg-orange-200 border-orange-400';
      case 'phone': return 'bg-yellow-200 border-yellow-400';
      case 'email': return 'bg-blue-200 border-blue-400';
      case 'postcode': return 'bg-purple-200 border-purple-400';
      default: return 'bg-gray-200 border-gray-400';
    }
  };

  // Render highlighted transcript
  const renderHighlightedTranscript = () => {
    if (!showPII || piiMatches.length === 0) {
      return <p className="whitespace-pre-wrap leading-relaxed">{transcript}</p>;
    }

    const segments = highlightPII(transcript, piiMatches);
    
    return (
      <div className="leading-relaxed whitespace-pre-wrap">
        {segments.map((segment, idx) => {
          if (segment.isPII && segment.match) {
            return (
              <mark
                key={idx}
                className={`${getPIIColor(segment.match.type)} border-b-2 px-1 rounded cursor-pointer transition-colors hover:opacity-75`}
                title={`${segment.match.type.toUpperCase()} (${segment.match.confidence})`}
              >
                {segment.text}
              </mark>
            );
          }
          return <span key={idx}>{segment.text}</span>;
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">Loading transcript data...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 p-6">
      {/* Header with Controls */}
      <div className="sticky top-0 z-10 bg-background pb-4 border-b space-y-4">
        {/* Title and Word Count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Enhanced Transcript</h3>
            <Badge variant="outline" className="text-sm">
              {stats.wordCount.toLocaleString('en-GB')} words
            </Badge>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStats(!showStats)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showStats ? 'Hide' : 'Show'} Stats
          </Button>
        </div>

        {/* Toggle Controls */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Switch checked={showTimestamps} onCheckedChange={setShowTimestamps} />
            <span className="text-sm">Timestamps</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <Switch checked={showConfidence} onCheckedChange={setShowConfidence} />
            <span className="text-sm">Confidence</span>
          </div>
          
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <Switch checked={showPII} onCheckedChange={setShowPII} />
            <span className="text-sm">Highlight PII</span>
            {showPII && piiMatches.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {piiMatches.length}
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveFillerWords}
            disabled={!transcript || stats.fillerWordCount === 0}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Remove Filler Words
            {stats.fillerWordCount > 0 && (
              <Badge variant="secondary" className="ml-2">{stats.fillerWordCount}</Badge>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCleanMedicalTerms}
            disabled={!transcript}
          >
            <Sparkles className="h-4 w-4 mr-2 text-nhs-blue" />
            Clean NHS Terms
          </Button>

          {showPII && piiMatches.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMaskAllPII}
                className="text-amber-600 border-amber-300 hover:bg-amber-50"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Mask All PII ({piiMatches.length})
              </Button>
              
              {selectedPII.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMaskSelectedPII}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Mask Selected ({selectedPII.size})
                </Button>
              )}
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(transcript);
              toast.success('Transcript copied');
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
        </div>
      </div>

      {/* Statistics Panel */}
      {showStats && (
        <Card className="p-4 bg-muted/50">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Chunks</p>
              <p className="text-2xl font-semibold">{stats.totalChunks}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Avg Confidence</p>
              <p className="text-2xl font-semibold">{stats.avgConfidence}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Low Confidence</p>
              <p className="text-2xl font-semibold text-amber-600">{stats.lowConfidenceCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Filler Words</p>
              <p className="text-2xl font-semibold">{stats.fillerWordCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">PII Detected</p>
              <p className="text-2xl font-semibold text-red-600">{stats.piiCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Words</p>
              <p className="text-2xl font-semibold">{stats.wordCount.toLocaleString('en-GB')}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Context Section */}
      {contextData && (contextData.agenda || contextData.attendees.length > 0) && (
        <Collapsible open={showContext} onOpenChange={setShowContext}>
          <Card>
            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">Meeting Context</span>
              </div>
              {showContext ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-0 space-y-4">
                {contextData.agenda && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      📋 Agenda
                    </h4>
                    <Card className="p-3 bg-muted/30">
                      <p className="text-sm whitespace-pre-wrap">{contextData.agenda}</p>
                    </Card>
                  </div>
                )}

                {contextData.attendees.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Attendees ({contextData.attendees.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {contextData.attendees.map((attendee, idx) => (
                        <Card key={idx} className="p-2 bg-muted/30">
                          <p className="text-sm">{attendee}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* PII Management Panel */}
      {showPII && piiMatches.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/50">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-semibold text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Detected Personally Identifiable Information
              </h4>
              <p className="text-xs text-amber-700 mt-1">
                Review and manage sensitive data in the transcript
              </p>
            </div>
          </div>
          
          <ScrollArea className="h-48 border rounded-md bg-white p-2">
            <div className="space-y-2">
              {piiMatches.map((match, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    const newSelected = new Set(selectedPII);
                    if (newSelected.has(idx)) {
                      newSelected.delete(idx);
                    } else {
                      newSelected.add(idx);
                    }
                    setSelectedPII(newSelected);
                  }}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    selectedPII.has(idx) ? 'bg-primary border-primary' : 'border-muted-foreground'
                  }`}>
                    {selectedPII.has(idx) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  
                  <Badge variant="outline" className="text-xs">
                    {match.type.replace('_', ' ').toUpperCase()}
                  </Badge>
                  
                  <span className="text-sm font-mono flex-1">{match.value}</span>
                  
                  <Badge variant="secondary" className="text-xs">
                    {match.confidence}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}

      {/* Main Transcript Display */}
      <Card className="flex-1 min-h-0 flex flex-col">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 text-foreground">
            {!transcript ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No transcript available for this meeting.
              </div>
            ) : (
              renderHighlightedTranscript()
            )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
};
