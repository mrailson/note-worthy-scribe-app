import React, { useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Calendar, FileText, Copy, Loader2, Play, Edit, CheckCircle } from 'lucide-react';
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
import { EditMeetingModal } from './EditMeetingModal';
import { recoverStuckMeeting } from '@/utils/meetingRecovery';
import { useRecording } from '@/contexts/RecordingContext';
import { useAuth } from '@/contexts/AuthContext';
import { extractAttendees } from '@/utils/extractAttendees';

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
  const [editingMeeting, setEditingMeeting] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { toast } = useToast();
  const { setRecordingState } = useRecording();
  const { user } = useAuth();

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

  const { copyToClipboard } = useMeetingExport(null, mockMeetingSettings);

  // Use the shared generateMeetingNotesDocx utility for Word export

  const handleAction = async (actionType: string, meeting: any, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const actionKey = `${meeting.id}-${actionType}`;
    setProcessingActions(prev => ({ ...prev, [actionKey]: true }));

    try {
      if (actionType === 'complete') {
        const success = await recoverStuckMeeting(meeting.id);
        if (success) {
          window.location.reload();
        }
      } else if (actionType === 'word') {
        toast({ title: 'Generating Word document...', description: 'Please wait while we format your document.' });
        
        let notesContent = '';

        const { data: summaryData } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meeting.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (summaryData?.summary) {
          notesContent = summaryData.summary;
        } else {
          const { data: autoNotesData } = await supabase
            .from('meeting_auto_notes')
            .select('generated_notes')
            .eq('meeting_id', meeting.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (autoNotesData?.generated_notes) {
            notesContent = autoNotesData.generated_notes;
          }
        }

        if (!notesContent) {
          toast({
            title: "No Meeting Notes Found",
            description: "No generated meeting notes or summaries available for this meeting.",
            variant: "destructive",
          });
          return;
        }

        // Use the shared generateMeetingNotesDocx utility (same as MeetingHistoryList)
        const { generateMeetingNotesDocx } = await import('@/utils/generateMeetingNotesDocx');
        
        const safeTitle = (meeting.title || 'Meeting Notes').replace(/\*\*/g, '').replace(/\*/g, '').trim();
        const filename = `${safeTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.docx`;
        
        // Extract attendees from content
        const computedAttendees = extractAttendees(notesContent);
        
        // Get logged-in user's name
        const loggedUserName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
        
        await generateMeetingNotesDocx({
          metadata: {
            title: safeTitle,
            date: meeting.start_time ? format(new Date(meeting.start_time), 'd MMMM yyyy') : new Date().toLocaleDateString('en-GB'),
            duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : undefined,
            attendees: computedAttendees,
            loggedUserName: loggedUserName,
          },
          content: notesContent,
          filename,
        });
        
        toast({
          title: "Word Document Generated",
          description: "Meeting notes have been downloaded as a Word document.",
        });
      } else if (actionType === 'copy') {
        let transcriptContent = '';
        
        // Try the comprehensive RPC function first
        try {
          const { data: rpcRows, error: rpcError } = await supabase.rpc('get_meeting_full_transcript', { 
            p_meeting_id: meeting.id 
          });
          
          if (!rpcError && Array.isArray(rpcRows) && rpcRows.length > 0) {
            transcriptContent = rpcRows[0]?.transcript || '';
          }
        } catch (e) {
          console.warn('RPC get_meeting_full_transcript failed, falling back to table fetch');
        }

        // If no transcript from RPC, try meeting_transcription_chunks
        if (!transcriptContent) {
          try {
            const { data: chunksData, error: chunksError } = await supabase
              .from('meeting_transcription_chunks')
              .select('transcription_text, chunk_number')
              .eq('meeting_id', meeting.id)
              .order('chunk_number', { ascending: true });
            
            if (!chunksError && chunksData && chunksData.length > 0) {
              transcriptContent = chunksData.map(chunk => chunk.transcription_text).join(' ');
            }
          } catch (e) {
            console.warn('meeting_transcription_chunks not available');
          }
        }

        // Fallback to meeting_transcripts table
        if (!transcriptContent) {
          const { data: transcriptData, error } = await supabase
            .from('meeting_transcripts')
            .select('content')
            .eq('meeting_id', meeting.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!error && transcriptData?.content) {
            transcriptContent = transcriptData.content;
          }
        }

        if (!transcriptContent) {
          toast({
            title: "No Transcript Found",
            description: "No transcript content available for this meeting.",
            variant: "destructive",
          });
          return;
        }

        // Normalise transcript to clean plain text for copying
        const { normaliseTranscript } = await import('@/lib/transcriptNormaliser');
        const normalised = normaliseTranscript(transcriptContent);
        
        await copyToClipboard(normalised.plain);
        toast({
          title: "Transcript Copied",
          description: "Meeting transcript has been copied to your clipboard.",
        });
      } else if (actionType === 'trigger') {
        console.log('🔧 Manual trigger for meeting:', meeting.id);
        
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

  const handleEditMeeting = (meeting: any, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    setTimeout(() => {
      setEditingMeeting(meeting);
      setEditModalOpen(true);
    }, 100);
    
    setDropdownOpen(false);
  };

  const handleMeetingUpdated = () => {
    window.location.reload();
  };

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
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
        
        <DropdownMenuItem 
          className="cursor-pointer"
          onClick={() => navigate('/')}
        >
          <Play className="w-4 h-4 mr-2" />
          Start New Meeting
        </DropdownMenuItem>
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
            <div key={meeting.id} className="border-b border-border last:border-b-0">
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEditMeeting(meeting, e);
                    }}
                    className="p-1 hover:bg-accent rounded transition-colors flex-shrink-0"
                    title="Edit meeting details"
                  >
                    <Edit className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </button>
                  <button
                    onClick={(e) => handleMeetingClick(meeting, e)}
                    className="flex-1 text-left hover:underline focus:underline outline-none min-w-0"
                  >
                    <div className="font-medium text-sm truncate">
                      {meeting.title || 'Untitled Meeting'}
                    </div>
                  </button>
                </div>
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>{formatMeetingDate(meeting.start_time || meeting.created_at)}</div>
                  <div className="flex items-center justify-between">
                    {meeting.status === 'completed' ? (
                      meeting.word_count && meeting.word_count > 0 ? (
                        <span>{formatDuration(meeting.duration_minutes)} • {meeting.word_count >= 1000 
                          ? `${(meeting.word_count / 1000).toFixed(1)}K words`
                          : `${meeting.word_count} words`}</span>
                      ) : (
                        <span className="text-muted-foreground">{formatDuration(meeting.duration_minutes)} • Completed</span>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔴 Clicked red dot for meeting:', meeting);
                            console.log('🔴 Meeting status:', meeting.status);
                            handleAction('complete', meeting, e);
                            setRecordingState(false);
                          }}
                          disabled={processingActions[`${meeting.id}-complete`]}
                          className="w-3 h-3 bg-red-500 rounded-full animate-pulse hover:bg-red-600 transition-colors cursor-pointer"
                          title="Click to stop recording and mark as complete"
                        />
                        <span className="text-amber-600 text-xs">Recording</span>
                      </div>
                    )}
                    
                    {meeting.status === 'completed' && (
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
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </DropdownMenuContent>
      
      {editingMeeting && (
        <EditMeetingModal
          meeting={editingMeeting}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onMeetingUpdated={handleMeetingUpdated}
        />
      )}
    </DropdownMenu>
  );
};
