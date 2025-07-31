import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, RefreshCw, FileText, Clock } from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  created_at: string;
  duration_minutes: number;
}

interface TranscriptCleanerProps {
  meetings: Meeting[];
  onTranscriptCleaned: () => void;
}

const TranscriptCleaner: React.FC<TranscriptCleanerProps> = ({ meetings, onTranscriptCleaned }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cleanedTranscripts, setCleanedTranscripts] = useState<Record<string, string>>({});
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);

  const cleanMeetingTranscript = async (meetingId: string, meetingTitle: string) => {
    setIsProcessing(true);
    setSelectedMeeting(meetingId);

    try {
      // Get the original transcript
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .select('content')
        .eq('meeting_id', meetingId)
        .single();

      if (transcriptError || !transcriptData?.content) {
        throw new Error('No transcript found for this meeting');
      }

      // Remove speaker labels and join with spaces
      const rawTranscript = transcriptData.content
        .split('\n')
        .map(line => line.replace(/^Speaker \d+:\s*/, '').trim())
        .filter(line => line.length > 0)
        .join(' ');

      // Clean the transcript using AI
      const { data: cleanData, error: cleanError } = await supabase.functions.invoke('clean-transcript', {
        body: {
          rawTranscript: rawTranscript,
          meetingTitle: meetingTitle
        }
      });

      if (cleanError || !cleanData?.cleanedTranscript) {
        throw new Error('Failed to clean transcript');
      }

      // Store the cleaned transcript in state
      setCleanedTranscripts(prev => ({
        ...prev,
        [meetingId]: cleanData.cleanedTranscript
      }));

      toast.success(`Transcript cleaned for "${meetingTitle}"`);
      onTranscriptCleaned();

    } catch (error) {
      console.error('Error cleaning transcript:', error);
      toast.error(`Failed to clean transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setSelectedMeeting(null);
    }
  };

  const cleanAllTranscripts = async () => {
    setIsProcessing(true);
    
    try {
      for (const meeting of meetings) {
        await cleanMeetingTranscript(meeting.id, meeting.title);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      toast.success('All transcripts have been cleaned!');
    } catch (error) {
      toast.error('Error cleaning some transcripts');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Clean Existing Transcripts
        </CardTitle>
        <CardDescription>
          Apply AI-powered cleaning to existing meeting transcripts to remove speaker labels, 
          filler words, and improve formatting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={cleanAllTranscripts}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Clean All Transcripts
          </Button>
        </div>

        <Separator />

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Individual Meetings</h4>
          {meetings.map((meeting) => (
            <div key={meeting.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{meeting.title}</span>
                  {cleanedTranscripts[meeting.id] && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Cleaned
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {meeting.duration_minutes} mins
                  </span>
                  <span>{new Date(meeting.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cleanMeetingTranscript(meeting.id, meeting.title)}
                  disabled={isProcessing}
                >
                  {isProcessing && selectedMeeting === meeting.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    'Clean'
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {Object.keys(cleanedTranscripts).length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Cleaned Transcript Preview</h4>
              {Object.entries(cleanedTranscripts).map(([meetingId, cleanedText]) => {
                const meeting = meetings.find(m => m.id === meetingId);
                return (
                  <Card key={meetingId} className="border-green-200 bg-green-50/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-800">
                        {meeting?.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ScrollArea className="h-32 w-full rounded border bg-background p-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {cleanedText}
                        </p>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TranscriptCleaner;