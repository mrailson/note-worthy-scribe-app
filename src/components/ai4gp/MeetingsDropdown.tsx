import React, { useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Calendar, FileText, Copy, Loader2, Sparkles } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';

interface MeetingsDropdownProps {
  meetings: any[];
  isLoading: boolean;
}

export const MeetingsDropdown: React.FC<MeetingsDropdownProps> = ({
  meetings,
  isLoading,
}) => {
  const navigate = useNavigate();
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
        // Fetch transcript content from database
        const { data: transcriptData, error } = await supabase
          .from('meeting_transcripts')
          .select('content')
          .eq('meeting_id', meeting.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !transcriptData?.content) {
          toast({
            title: "No Transcript Found",
            description: "No transcript content available for this meeting.",
            variant: "destructive",
          });
          return;
        }

        // Generate Word document with actual transcript content
        await generateWordDocument(transcriptData.content, meeting.title || 'Meeting Notes');
        toast({
          title: "Word Document Generated",
          description: "Meeting notes have been downloaded as a Word document.",
        });
      } else if (actionType === 'copy') {
        // Fetch and copy transcript to clipboard
        const { data: transcriptData, error } = await supabase
          .from('meeting_transcripts')
          .select('content')
          .eq('meeting_id', meeting.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !transcriptData?.content) {
          toast({
            title: "No Transcript Found",
            description: "No transcript content available for this meeting.",
            variant: "destructive",
          });
          return;
        }

        await copyToClipboard(transcriptData.content);
        toast({
          title: "Transcript Copied",
          description: "Meeting transcript has been copied to your clipboard.",
        });
      } else if (actionType === 'trigger') {
        // Manually trigger note generation
        console.log('🔧 Manual trigger for meeting:', meeting.id);
        
        // First check if meeting has completed status and transcript
        if (meeting.status !== 'completed') {
          toast({
            title: "Cannot Generate Notes",
            description: "Meeting must be completed to generate notes.",
            variant: "destructive",
          });
          return;
        }

        const { data, error } = await supabase.functions.invoke('auto-generate-meeting-notes', {
          body: { meetingId: meeting.id, forceRegenerate: true }
        });

        if (error) {
          console.error('❌ Failed to trigger notes generation:', error);
          toast({
            title: "Generation Failed",
            description: "Failed to trigger note generation. Please try again.",
            variant: "destructive",
          });
        } else {
          console.log('✅ Notes generation triggered successfully:', data);
          toast({
            title: "Notes Generation Started",
            description: "Meeting notes are being generated. This may take a few minutes.",
          });
        }
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
    navigate('/meetings', { state: { scrollToMeetingId: meeting.id } });
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
          <span className="hidden sm:inline text-xs">My Meetings</span>
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
                    <span>{formatDuration(meeting.duration_minutes)} • {meeting.word_count ? (
                      meeting.word_count >= 1000 
                        ? `${(meeting.word_count / 1000).toFixed(1)}K words`
                        : `${meeting.word_count} words`
                    ) : 'N/A words'}</span>
                    
                     {/* Action Buttons */}
                     <div className="flex gap-1">
                       {/* Manual Trigger Button - Only show for completed meetings */}
                       {meeting.status === 'completed' && (
                         <button
                           onClick={(e) => handleAction('trigger', meeting, e)}
                           disabled={processingActions[`${meeting.id}-trigger`]}
                           className="p-1 hover:bg-accent rounded transition-colors"
                           title="Generate Notes (Manual)"
                         >
                           {processingActions[`${meeting.id}-trigger`] ? (
                             <Loader2 className="w-3 h-3 animate-spin" />
                           ) : (
                             <Sparkles className="w-3 h-3 text-primary" />
                           )}
                         </button>
                       )}
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