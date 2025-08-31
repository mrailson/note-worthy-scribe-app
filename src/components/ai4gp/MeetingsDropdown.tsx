import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, FileText, Copy, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useMeetingExport } from '@/hooks/useMeetingExport';
import { useToast } from '@/hooks/use-toast';
import { MeetingData } from '@/types/meetingTypes';

interface MeetingsDropdownProps {
  meetings: any[];
  isLoading: boolean;
  onViewMeeting: (meeting: MeetingData) => void;
}

export const MeetingsDropdown: React.FC<MeetingsDropdownProps> = ({
  meetings,
  isLoading,
  onViewMeeting,
}) => {
  const [processingActions, setProcessingActions] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

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

  const handleAction = async (actionType: string, meeting: any, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const actionKey = `${meeting.id}-${actionType}`;
    setProcessingActions(prev => ({ ...prev, [actionKey]: true }));

    try {
      if (actionType === 'word') {
        // Generate Word document
        const meetingData: MeetingData = {
          id: meeting.id,
          title: meeting.title || 'Untitled Meeting',
          duration: meeting.duration_minutes?.toString() || '0',
          wordCount: meeting.word_count || 0,
          transcript: '', // Will be fetched by the export hook
          speakerCount: 1,
          startTime: meeting.start_time || meeting.created_at,
        };

        await generateWordDocument(meetingData.transcript || '', meeting.title || 'Meeting Notes');
        toast({
          title: "Word Document Generated",
          description: "Meeting notes have been downloaded as a Word document.",
        });
      } else if (actionType === 'copy') {
        // Copy transcript to clipboard
        const meetingData: MeetingData = {
          id: meeting.id,
          title: meeting.title || 'Untitled Meeting',
          duration: meeting.duration_minutes?.toString() || '0',
          wordCount: meeting.word_count || 0,
          transcript: '', // Will be fetched by the export hook
          speakerCount: 1,
          startTime: meeting.start_time || meeting.created_at,
        };

        await copyToClipboard(meetingData.transcript || '');
        toast({
          title: "Transcript Copied",
          description: "Meeting transcript has been copied to your clipboard.",
        });
      }
    } catch (error) {
      console.error(`Error performing ${actionType} action:`, error);
      toast({
        title: "Action Failed",
        description: `Failed to ${actionType} meeting data. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setProcessingActions(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const formatMeetingDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE, d MMM yyyy HH:mm');
    } catch (error) {
      return dateString;
    }
  };

  const formatDuration = (duration: string | number | null) => {
    if (!duration) return '0 min';
    const durationNum = typeof duration === 'string' ? parseInt(duration) : duration;
    return `${durationNum} min`;
  };

  const handleMeetingClick = (meeting: any, event: React.MouseEvent) => {
    event.preventDefault();
    const meetingData: MeetingData = {
      id: meeting.id,
      title: meeting.title || 'Untitled Meeting',
      duration: meeting.duration_minutes?.toString() || '0',
      wordCount: meeting.word_count || 0,
      transcript: '',
      speakerCount: 1,
      startTime: meeting.start_time || meeting.created_at,
    };
    onViewMeeting(meetingData);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 px-2 sm:px-3"
        >
          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
          <span className="hidden sm:inline text-xs">Meetings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-80 sm:w-96 max-h-[60vh] overflow-y-auto"
        align="end"
        sideOffset={5}
      >
        <DropdownMenuLabel>Recent Meetings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {isLoading ? (
          <DropdownMenuItem disabled className="justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading meetings...
          </DropdownMenuItem>
        ) : meetings.length === 0 ? (
          <DropdownMenuItem disabled className="py-4">
            <div className="text-center w-full text-muted-foreground">
              No recent meetings found
            </div>
          </DropdownMenuItem>
        ) : (
          meetings.map((meeting) => (
            <DropdownMenuItem 
              key={meeting.id} 
              className="p-0 focus:bg-accent"
              onSelect={(e) => e.preventDefault()}
            >
              <div className="w-full p-3 space-y-2">
                {/* Meeting Title - clickable */}
                <button
                  onClick={(e) => handleMeetingClick(meeting, e)}
                  className="w-full text-left hover:underline focus:underline outline-none"
                >
                  <div className="font-medium text-sm truncate">
                    {meeting.title || 'Untitled Meeting'}
                  </div>
                </button>
                
                {/* Meeting Details */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>{formatMeetingDate(meeting.start_time || meeting.created_at)}</div>
                  <div className="flex items-center justify-between">
                    <span>{formatDuration(meeting.duration_minutes)} • {meeting.word_count || 0} words</span>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => handleAction('word', meeting, e)}
                        disabled={processingActions[`${meeting.id}-word`]}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        title="Download Word"
                      >
                        {processingActions[`${meeting.id}-word`] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleAction('copy', meeting, e)}
                        disabled={processingActions[`${meeting.id}-copy`]}
                        className="p-1 hover:bg-accent rounded transition-colors"
                        title="Copy Transcript"
                      >
                        {processingActions[`${meeting.id}-copy`] ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};