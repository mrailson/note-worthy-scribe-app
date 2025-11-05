import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Database, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface ConsolidationResult {
  meetingId: string;
  status: 'success' | 'error';
  chunksProcessed?: number;
  cleanedChunks?: number;
  pendingChunks?: number;
  totalWords?: number;
  transcriptLength?: number;
  error?: string;
}

interface MeetingWithChunks {
  id: string;
  title: string;
  start_time: string;
  user_id: string;
  word_count: number;
  chunk_count: number;
  chunk_words: number;
  user_email?: string;
}

export const BatchConsolidateButton: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);
  const [meetings, setMeetings] = useState<MeetingWithChunks[]>([]);
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<{
    totalMeetings: number;
    successCount: number;
    errorCount: number;
    results: ConsolidationResult[];
  } | null>(null);

  // Load meetings with chunks
  useEffect(() => {
    loadMeetingsWithChunks();
  }, []);

  const loadMeetingsWithChunks = async () => {
    setIsLoadingMeetings(true);
    try {
      // Get all meetings that have chunks
      const { data: chunksData, error: chunksError } = await supabase
        .from('meeting_transcription_chunks')
        .select('meeting_id, word_count');

      if (chunksError) throw chunksError;

      // Group by meeting_id and calculate totals
      const meetingChunkStats = chunksData?.reduce((acc, chunk) => {
        if (!acc[chunk.meeting_id]) {
          acc[chunk.meeting_id] = { count: 0, words: 0 };
        }
        acc[chunk.meeting_id].count += 1;
        acc[chunk.meeting_id].words += chunk.word_count || 0;
        return acc;
      }, {} as Record<string, { count: number; words: number }>) || {};

      const meetingIds = Object.keys(meetingChunkStats);

      if (meetingIds.length === 0) {
        setMeetings([]);
        return;
      }

      // Get meeting details
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('id, title, start_time, user_id, word_count')
        .in('id', meetingIds)
        .order('start_time', { ascending: false });

      if (meetingsError) throw meetingsError;

      // Get user emails
      const userIds = [...new Set(meetingsData?.map(m => m.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      const emailMap = profilesData?.reduce((acc, p) => {
        acc[p.id] = p.email;
        return acc;
      }, {} as Record<string, string>) || {};

      const meetingsWithChunks: MeetingWithChunks[] = (meetingsData || []).map(m => ({
        ...m,
        chunk_count: meetingChunkStats[m.id]?.count || 0,
        chunk_words: meetingChunkStats[m.id]?.words || 0,
        user_email: emailMap[m.user_id] || 'Unknown'
      }));

      setMeetings(meetingsWithChunks);
    } catch (error) {
      console.error('Error loading meetings:', error);
      toast.error('Failed to load meetings');
    } finally {
      setIsLoadingMeetings(false);
    }
  };

  const handleToggleMeeting = (meetingId: string) => {
    setSelectedMeetings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(meetingId)) {
        newSet.delete(meetingId);
      } else {
        newSet.add(meetingId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedMeetings.size === meetings.length) {
      setSelectedMeetings(new Set());
    } else {
      setSelectedMeetings(new Set(meetings.map(m => m.id)));
    }
  };

  const handleConsolidateSelected = async () => {
    if (selectedMeetings.size === 0) {
      toast.error('Please select at least one meeting');
      return;
    }

    if (!confirm(`Consolidate chunks for ${selectedMeetings.size} selected meeting(s)?`)) {
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      const consolidationResults: ConsolidationResult[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (const meetingId of selectedMeetings) {
        try {
          const { data, error } = await supabase.functions.invoke('consolidate-meeting-chunks', {
            body: { meetingId }
          });

          if (error) {
            throw error;
          }

          if (data?.success) {
            consolidationResults.push({
              meetingId,
              status: 'success',
              chunksProcessed: data.chunksProcessed,
              cleanedChunks: data.cleanedChunks,
              pendingChunks: data.pendingChunks,
              totalWords: data.totalWords,
              transcriptLength: data.transcriptLength
            });
            successCount++;
          } else {
            throw new Error('Consolidation failed');
          }
        } catch (error) {
          consolidationResults.push({
            meetingId,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          errorCount++;
        }
      }

      setResults({
        totalMeetings: selectedMeetings.size,
        successCount,
        errorCount,
        results: consolidationResults
      });

      if (successCount > 0) {
        toast.success(`Consolidated ${successCount} meeting(s) successfully!`);
        await loadMeetingsWithChunks(); // Refresh the list
      }
    } catch (error) {
      console.error('Error during consolidation:', error);
      toast.error('Failed to consolidate meetings');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchConsolidate = async () => {
    if (!confirm('This will consolidate chunks for ALL meetings in the system. This may take several minutes. Continue?')) {
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('batch-consolidate-meetings');

      if (error) {
        console.error('Batch consolidation error:', error);
        toast.error('Failed to consolidate meetings');
        return;
      }

      if (data?.success) {
        setResults(data);
        toast.success(`Consolidated ${data.successCount} meetings successfully!`);
        await loadMeetingsWithChunks();
      } else {
        toast.error('Batch consolidation failed');
      }
    } catch (error) {
      console.error('Error during batch consolidation:', error);
      toast.error('Failed to consolidate meetings');
    } finally {
      setIsProcessing(false);
    }
  };

  const getMeetingTitle = (meeting: MeetingWithChunks) => {
    if (meeting.title && meeting.title !== 'Untitled Meeting') {
      return meeting.title;
    }
    const date = new Date(meeting.start_time);
    return `Meeting - ${date.toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };

  const getDataLossPercentage = (meeting: MeetingWithChunks) => {
    if (meeting.chunk_words === 0) return 0;
    const lostWords = meeting.chunk_words - (meeting.word_count || 0);
    return Math.round((lostWords / meeting.chunk_words) * 100);
  };

  return (
    <div className="space-y-4">
      {/* Meeting Selection */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Select Meetings to Consolidate</h3>
              <p className="text-sm text-muted-foreground">
                Choose specific meetings to test consolidation
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadMeetingsWithChunks}
              disabled={isLoadingMeetings}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingMeetings ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {isLoadingMeetings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No meetings with chunks found
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={selectedMeetings.size === meetings.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm font-medium">
                  Select All ({meetings.length} meetings)
                </span>
              </div>

              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {meetings.map(meeting => {
                    const lossPercentage = getDataLossPercentage(meeting);
                    return (
                      <div
                        key={meeting.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleToggleMeeting(meeting.id)}
                      >
                        <Checkbox
                          checked={selectedMeetings.has(meeting.id)}
                          onCheckedChange={() => handleToggleMeeting(meeting.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm">{getMeetingTitle(meeting)}</h4>
                            {lossPercentage > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {lossPercentage}% lost
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p>User: {meeting.user_email}</p>
                            <p>Chunks: {meeting.chunk_count} ({meeting.chunk_words.toLocaleString()} words)</p>
                            <p>Current transcript: {meeting.word_count?.toLocaleString() || 0} words</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button
                  onClick={handleConsolidateSelected}
                  disabled={isProcessing || selectedMeetings.size === 0}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Consolidate Selected ({selectedMeetings.size})
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Batch Consolidate All */}
      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-amber-900">Batch Consolidate All Meetings</h3>
            <p className="text-sm text-amber-800">
              This will process ALL meetings with transcription chunks. Use "Select Meetings" above to test first.
            </p>
          </div>

          <Button
            onClick={handleBatchConsolidate}
            disabled={isProcessing}
            variant="outline"
            className="w-full border-amber-300 hover:bg-amber-100"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Consolidate All Meetings
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Results */}
      {results && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Results</h3>
              <div className="flex gap-2">
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {results.successCount} Success
                </Badge>
                {results.errorCount > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {results.errorCount} Errors
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Meetings</p>
                <p className="text-2xl font-semibold">{results.totalMeetings}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Succeeded</p>
                <p className="text-2xl font-semibold text-green-600">{results.successCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Failed</p>
                <p className="text-2xl font-semibold text-red-600">{results.errorCount}</p>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Detailed Results
              </h4>
              <ScrollArea className="h-64 rounded-md border">
                <div className="p-4 space-y-2">
                  {results.results.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        result.status === 'success'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-mono text-xs">{result.meetingId}</p>
                          {result.status === 'success' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {result.chunksProcessed} chunks ({result.cleanedChunks} cleaned, {result.pendingChunks} pending) → {result.totalWords?.toLocaleString()} words
                            </p>
                          )}
                          {result.status === 'error' && (
                            <p className="text-xs text-red-600 mt-1">{result.error}</p>
                          )}
                        </div>
                        <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                          {result.status === 'success' ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
