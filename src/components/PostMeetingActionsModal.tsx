import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, PlayCircle, Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from "@/utils/toastWrapper";
import { useAuth } from '@/contexts/AuthContext';

interface PostMeetingActionsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  meetingTitle: string;
  meetingDuration: string;
  onStartNewMeeting: () => void;
}

export const PostMeetingActionsModal: React.FC<PostMeetingActionsModalProps> = ({
  isOpen,
  onOpenChange,
  meetingId,
  meetingTitle,
  meetingDuration,
  onStartNewMeeting,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notesStatus, setNotesStatus] = useState<'generating' | 'completed' | 'error'>('generating');
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [meetingData, setMeetingData] = useState<any>(null);
  const [transcriptLength, setTranscriptLength] = useState<number>(0);
  const [emailSent, setEmailSent] = useState(false);
  const emailSentRef = useRef(false); // Prevent duplicate sends

  // Format number in K style (e.g., 4200 -> 4.2K)
  const formatNumberK = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Subscribe to notes generation status
  useEffect(() => {
    if (!meetingId || !isOpen) return;

    const fetchMeetingStatus = async () => {
      // Handle test meeting IDs - simulate completed notes
      if (meetingId.startsWith('test-meeting-id-')) {
        setNotesStatus('completed');
        setMeetingNotes('This is a test meeting. The notes generation feature works by processing your recorded meetings and generating comprehensive summaries automatically.');
        setMeetingData({
          title: meetingTitle,
          startTime: new Date().toISOString(),
          duration: meetingDuration,
          attendees: ['Test User'],
          meetingLocation: 'Test Location',
          overview: 'This is a test meeting. The notes generation feature works by processing your recorded meetings and generating comprehensive summaries automatically.',
          content: 'This is a test meeting. The notes generation feature works by processing your recorded meetings and generating comprehensive summaries automatically.',
        });
        return;
      }

      const { data, error } = await supabase
        .from('meetings')
        .select('notes_generation_status, overview, notes_style_3, title, start_time, duration_minutes, agenda, participants, word_count')
        .eq('id', meetingId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching meeting status:', error);
        setNotesStatus('error');
        return;
      }

      if (!data) {
        console.warn('Meeting not found:', meetingId);
        setNotesStatus('error');
        return;
      }

      if (data) {
        // Set transcript length
        setTranscriptLength(data.word_count || 0);
        
        // Fetch full notes from meeting_summaries table (the AI-generated notes)
        let fullNotes = '';
        if (data.notes_generation_status === 'completed') {
          const { data: summaryData } = await supabase
            .from('meeting_summaries')
            .select('summary')
            .eq('meeting_id', meetingId)
            .maybeSingle();
          
          // Use meeting_summaries.summary as primary, fall back to notes_style_3 then overview
          fullNotes = summaryData?.summary || data.notes_style_3 || data.overview || '';
        } else {
          fullNotes = data.notes_style_3 || data.overview || '';
        }
        
        // Set meeting data for export
        setMeetingData({
          title: data.title,
          startTime: data.start_time,
          duration: data.duration_minutes ? `${data.duration_minutes} minutes` : meetingDuration,
          attendees: data.participants || [],
          meetingLocation: '',
          overview: data.overview || '',
          content: fullNotes,
        });
        
        if (data.notes_generation_status === 'completed') {
          setNotesStatus('completed');
          setMeetingNotes(fullNotes);
        } else if (data.notes_generation_status === 'error' || data.notes_generation_status === 'failed') {
          setNotesStatus('error');
        } else {
          setNotesStatus('generating');
        }
      }
    };

    // Initial fetch
    fetchMeetingStatus();

    // Skip real-time subscription for test meetings
    if (meetingId.startsWith('test-meeting-id-')) {
      return;
    }

    // ENHANCEMENT: Polling fallback every 15 seconds
    // This catches cases where Realtime subscription misses the update
    const pollInterval = setInterval(() => {
      console.log('🔄 Polling for notes status update...');
      fetchMeetingStatus();
    }, 15000);

    // Subscribe to real-time updates (primary, faster method)
    const channel = supabase
      .channel(`meeting-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `id=eq.${meetingId}`,
        },
        (payload) => {
          console.log('📡 Meeting status updated:', payload);
          if (payload.new.notes_generation_status === 'completed') {
            // Re-fetch to get full notes_style_3 content (not just overview from payload)
            fetchMeetingStatus();
            showToast.success('Meeting notes are ready!', { section: 'meeting_manager' });
          } else if (payload.new.notes_generation_status === 'error' || payload.new.notes_generation_status === 'failed') {
            setNotesStatus('error');
            showToast.error('Failed to generate meeting notes', { section: 'meeting_manager' });
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [meetingId, isOpen]);

  // Auto-send email when notes are ready via the server-side dispatcher.
  // The server owns the idempotency lock (notes_email_sent_at), so this cannot
  // race with auto-generate-meeting-notes and produce duplicate emails.
  useEffect(() => {
    if (notesStatus !== 'completed' || !meetingData || !user?.email || emailSentRef.current) {
      return;
    }

    const sendAutoEmail = async () => {
      emailSentRef.current = true;
      setEmailSent(true);

      try {
        console.log('📧 Requesting idempotent meeting notes email dispatch...');
        const { data, error } = await supabase.functions.invoke('deliver-mobile-meeting-email', {
          body: { meetingId }
        });

        if (error) {
          console.error('Auto-email dispatch error:', error);
          emailSentRef.current = false;
          setEmailSent(false);
          return;
        }

        if (data?.sent || data?.skipped) {
          console.log('✅ Auto-email handled:', data);
        } else {
          console.error('Auto-email dispatch returned unexpected response:', data);
          emailSentRef.current = false;
          setEmailSent(false);
        }
      } catch (error) {
        console.error('Error dispatching auto-email:', error);
        emailSentRef.current = false;
        setEmailSent(false);
      }
    };

    sendAutoEmail();
  }, [notesStatus, meetingData, user?.email, meetingNotes, meetingTitle]);

  // Reset email sent state when modal closes or meeting changes
  useEffect(() => {
    if (!isOpen) {
      emailSentRef.current = false;
      setEmailSent(false);
    }
  }, [isOpen, meetingId]);

  const handleViewMeeting = () => {
    if (notesStatus !== 'completed') {
      showToast.info('Meeting notes are still being generated. Please wait a moment.', { section: 'meeting_manager' });
      return;
    }
    
    // Don't navigate for test meetings
    if (meetingId.startsWith('test-meeting-id-')) {
      showToast.info('Test meetings cannot be viewed. Please record a real meeting.', { section: 'meeting_manager' });
      return;
    }
    
    onOpenChange(false);
    // Navigate to home page and trigger SafeModeNotesModal in the History tab (the new better version)
    navigate('/', { 
      state: { 
        openSafeModeModal: true,
        safeModeModalMeetingId: meetingId,
        switchToHistoryTab: true
      } 
    });
  };

  const handleStartNew = () => {
    onOpenChange(false);
    onStartNewMeeting();
  };

  const getStatusBadge = () => {
    switch (notesStatus) {
      case 'generating':
        return (
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating notes...
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="flex items-center gap-1.5 bg-green-600 w-fit">
            <CheckCircle className="h-3 w-3" />
            Ready
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" />
            Error generating notes
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing...
          </Badge>
        );
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-500" />
              </div>
              <DialogTitle className="text-2xl font-semibold">
                Meeting Saved Successfully
              </DialogTitle>
            </div>
            <DialogDescription className="space-y-3 pt-2 px-2">
              <div className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
                <span className="font-medium text-foreground">Title:</span>
                <span className="text-foreground">{meetingData?.title || meetingTitle}</span>
                
                <span className="font-medium text-foreground">Duration:</span>
                <span className="text-foreground">
                  {meetingDuration}
                  {transcriptLength > 0 && (
                    <span className="text-muted-foreground ml-2">
                      • Transcript: {formatNumberK(transcriptLength)} words
                    </span>
                  )}
                </span>
                
                <span className="font-medium text-foreground">Status:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge()}
                  {emailSent && (
                    <Badge variant="default" className="flex items-center gap-1.5 bg-green-600 w-fit hover:bg-green-600">
                      <Mail className="h-3 w-3" />
                      Emailed
                    </Badge>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 px-2">
            {/* View Minutes Button */}
            <Button
              onClick={handleViewMeeting}
              disabled={notesStatus !== 'completed'}
              className="w-full justify-start h-12 text-base"
              size="lg"
            >
              <FileText className="h-5 w-5 mr-3" />
              View Meeting Notes
            </Button>

            {/* Start New Meeting Button */}
            <Button
              onClick={handleStartNew}
              variant="secondary"
              className="w-full justify-center h-12"
              size="lg"
            >
              <PlayCircle className="h-4 w-4 mr-2" />
              Start New Meeting
            </Button>

            {/* Close Button */}
            <Button
              onClick={() => onOpenChange(false)}
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
            >
              Close and Return to Notewell AI
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
