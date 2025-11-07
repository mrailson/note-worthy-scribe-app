import React, { useState, useEffect } from 'react';
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
import { FileText, Download, Mail, PlayCircle, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useMeetingExport } from '@/hooks/useMeetingExport';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PostMeetingActionsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  meetingTitle: string;
  meetingDuration: string;
  onStartNewMeeting: () => void;
  onEmailNotes?: (meetingId: string, meetingTitle: string, notes: string) => void;
}

export const PostMeetingActionsModal: React.FC<PostMeetingActionsModalProps> = ({
  isOpen,
  onOpenChange,
  meetingId,
  meetingTitle,
  meetingDuration,
  onStartNewMeeting,
  onEmailNotes,
}) => {
  const navigate = useNavigate();
  const [notesStatus, setNotesStatus] = useState<'generating' | 'completed' | 'error'>('generating');
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [meetingData, setMeetingData] = useState<any>(null);
  
  const { generateWordDocument, isExporting } = useMeetingExport(
    meetingData,
    {
      title: meetingTitle,
      description: '',
      meetingType: 'meeting',
      meetingStyle: '',
      attendees: '',
      agenda: '',
      transcriberService: 'whisper' as 'whisper' | 'deepgram',
      transcriberThresholds: { whisper: 0.5, deepgram: 0.5 }
    }
  );

  // Subscribe to notes generation status
  useEffect(() => {
    if (!meetingId || !isOpen) return;

    const fetchMeetingStatus = async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('notes_generation_status, overview, title, start_time, duration_minutes, agenda, participants')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Error fetching meeting status:', error);
        setNotesStatus('error');
        return;
      }

      if (data) {
        // Set meeting data for export
        setMeetingData({
          title: data.title,
          date: data.start_time ? new Date(data.start_time).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
          duration: data.duration_minutes ? `${data.duration_minutes} minutes` : meetingDuration,
          attendees: (data.participants || []).join(', '),
          overview: data.overview || '',
          content: data.overview || '',
        });
        
        if (data.notes_generation_status === 'completed') {
          setNotesStatus('completed');
          setMeetingNotes(data.overview || '');
        } else if (data.notes_generation_status === 'error' || data.notes_generation_status === 'failed') {
          setNotesStatus('error');
        } else {
          setNotesStatus('generating');
        }
      }
    };

    // Initial fetch
    fetchMeetingStatus();

    // Subscribe to real-time updates
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
            setNotesStatus('completed');
            setMeetingNotes(payload.new.overview || '');
            
            // Update meeting data for export
            setMeetingData({
              title: payload.new.title,
              date: payload.new.start_time ? new Date(payload.new.start_time).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'),
              duration: payload.new.duration_minutes ? `${payload.new.duration_minutes} minutes` : meetingDuration,
              attendees: (payload.new.participants || []).join(', '),
              overview: payload.new.overview || '',
              content: payload.new.overview || '',
            });
            
            toast.success('Meeting notes are ready!');
          } else if (payload.new.notes_generation_status === 'error' || payload.new.notes_generation_status === 'failed') {
            setNotesStatus('error');
            toast.error('Failed to generate meeting notes');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetingId, isOpen]);

  const handleViewMeeting = () => {
    if (notesStatus !== 'completed') {
      toast.info('Meeting notes are still being generated. Please wait a moment.');
      return;
    }
    onOpenChange(false);
    navigate(`/meeting-summary?id=${meetingId}`);
  };

  const handleDownload = async () => {
    if (!meetingData) {
      toast.error('Meeting data not loaded yet');
      return;
    }
    
    try {
      const content = meetingData.overview || meetingData.content || '';
      await generateWordDocument(content, meetingTitle);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download meeting notes');
    }
  };

  const handleEmail = () => {
    if (onEmailNotes) {
      onEmailNotes(meetingId, meetingTitle, meetingNotes);
    } else {
      toast.info('Email feature not configured');
    }
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
          <Badge variant="default" className="flex items-center gap-1.5 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Notes ready!
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" />
            Error generating notes
          </Badge>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            🎉 Meeting Saved Successfully!
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <div className="text-sm">
              <span className="font-medium text-foreground">Title:</span> {meetingTitle}
            </div>
            <div className="text-sm">
              <span className="font-medium text-foreground">Duration:</span> {meetingDuration}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Status:</span>
              {getStatusBadge()}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          {/* View Minutes Button */}
          <Button
            onClick={handleViewMeeting}
            disabled={notesStatus !== 'completed'}
            className="w-full justify-start h-12"
            size="lg"
          >
            <FileText className="h-4 w-4 mr-2" />
            View Generated Minutes
          </Button>

          {/* Download and Email Row */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleDownload}
              disabled={isExporting}
              variant="outline"
              className="justify-start h-12"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download
            </Button>

            {onEmailNotes && (
              <Button
                onClick={handleEmail}
                variant="outline"
                className="justify-start h-12"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            )}
          </div>

          {/* Start New Meeting Button */}
          <Button
            onClick={handleStartNew}
            variant="secondary"
            className="w-full justify-start h-12"
            size="lg"
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            Start New Meeting
          </Button>

          {/* No Thanks Button */}
          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            className="w-full text-muted-foreground"
          >
            No thanks
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
