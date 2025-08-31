import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Eye, FileText, Copy, Download, Clock, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useMeetingExport } from '@/hooks/useMeetingExport';
import { MeetingData } from '@/types/meetingTypes';

interface RecentMeetingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onViewMeeting: (meeting: MeetingData) => void;
}

export const RecentMeetingsModal: React.FC<RecentMeetingsModalProps> = ({
  isOpen,
  onOpenChange,
  onViewMeeting,
}) => {
  const [processingActions, setProcessingActions] = useState<Record<string, boolean>>({});

  // Fetch recent meetings
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['recent-meetings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, start_time, created_at, duration_minutes, word_count')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching recent meetings:', error);
        throw error;
      }

      return data || [];
    },
    enabled: isOpen,
  });

  // Mock meeting data for export functions
  const mockMeetingSettings = {
    title: '',
    description: '',
    meetingType: '',
    meetingStyle: '',
    attendees: '',
    agenda: '',
    transcriberService: 'whisper' as const,
    transcriberThresholds: { whisper: 0.5, deepgram: 0.7 }
  };

  const { generateWordDocument, copyToClipboard } = useMeetingExport(null, mockMeetingSettings);

  const handleAction = async (actionType: string, meeting: any) => {
    const actionKey = `${meeting.id}-${actionType}`;
    setProcessingActions(prev => ({ ...prev, [actionKey]: true }));

    try {
      switch (actionType) {
        case 'view':
          const meetingData: MeetingData = {
            id: meeting.id,
            title: meeting.title,
            duration: meeting.duration_minutes?.toString() || '0',
            wordCount: meeting.word_count || 0,
            transcript: '',
            speakerCount: 1,
            startTime: meeting.start_time || meeting.created_at
          };
          onViewMeeting(meetingData);
          onOpenChange(false);
          break;
        
        case 'word':
          const content = 'Meeting notes will be available when generated.';
          await generateWordDocument(content, meeting.title || 'Meeting Notes');
          break;
        
        case 'copy':
          // For now, copy meeting details since we don't have transcript in this query
          const textToCopy = `Meeting: ${meeting.title || 'Untitled Meeting'}
Date: ${formatMeetingDate(meeting.start_time || meeting.created_at)}
Duration: ${formatDuration(meeting.duration_minutes)}
Words: ${meeting.word_count || 0}`;
          copyToClipboard(textToCopy);
          break;
      }
    } catch (error) {
      console.error('Action error:', error);
      toast.error('Failed to perform action');
    } finally {
      setProcessingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const formatMeetingDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE, d MMM yyyy HH:mm');
    } catch {
      return 'Invalid date';
    }
  };

  const formatDuration = (duration: string | number | null) => {
    if (!duration) return '0 min';
    const minutes = typeof duration === 'string' ? parseInt(duration, 10) : duration;
    if (isNaN(minutes)) return '0 min';
    return `${minutes} min`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-none h-[100dvh] md:max-w-4xl md:w-[95vw] md:h-[90vh] md:max-h-[800px] flex flex-col p-0 m-0 md:m-auto inset-0 md:inset-auto translate-x-0 translate-y-0 md:translate-x-[-50%] md:translate-y-[-50%] rounded-none md:rounded-lg">
        <DialogHeader className="p-4 md:p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <DialogTitle className="text-lg font-semibold">Recent Meetings</DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Recent Meetings</h3>
              <p className="text-muted-foreground mb-4">
                No meetings found. Start recording to see your meetings here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="border rounded-lg p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <p className="text-sm text-muted-foreground font-mono">
                          {formatMeetingDate(meeting.start_time || meeting.created_at)}
                        </p>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <p className="font-medium text-foreground truncate">
                          {meeting.title || 'Untitled Meeting'}
                        </p>
                        <span className="hidden sm:inline text-muted-foreground">|</span>
                        <p className="text-sm text-muted-foreground">
                          {formatDuration(meeting.duration_minutes)}
                        </p>
                      </div>
                      
                      {meeting.word_count && (
                        <p className="text-xs text-muted-foreground">
                          {meeting.word_count.toLocaleString()} words
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction('view', meeting)}
                        disabled={processingActions[`${meeting.id}-view`]}
                        className="h-8 px-2 sm:px-3"
                      >
                        <Eye className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">View</span>
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction('word', meeting)}
                        disabled={processingActions[`${meeting.id}-word`]}
                        className="h-8 px-2 sm:px-3"
                      >
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">Word</span>
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction('copy', meeting)}
                        disabled={processingActions[`${meeting.id}-copy`]}
                        className="h-8 px-2 sm:px-3"
                      >
                        <Copy className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                        <span className="hidden sm:inline text-xs">Copy</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};