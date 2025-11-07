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
  const [notesStatus, setNotesStatus] = useState<'generating' | 'completed' | 'error'>('generating');
  const [meetingNotes, setMeetingNotes] = useState<string>('');
  const [meetingData, setMeetingData] = useState<any>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [transcriptLength, setTranscriptLength] = useState<number>(0);
  const [emailSentTo, setEmailSentTo] = useState<string>('');
  
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

  // Format number in K style (e.g., 4200 -> 4.2K)
  const formatNumberK = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Reset email sent state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setEmailSentTo('');
    }
  }, [isOpen]);

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
        .select('notes_generation_status, overview, title, start_time, duration_minutes, agenda, participants, word_count')
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
        
        // Set meeting data for export
        setMeetingData({
          title: data.title,
          startTime: data.start_time,
          duration: data.duration_minutes ? `${data.duration_minutes} minutes` : meetingDuration,
          attendees: data.participants || [],
          meetingLocation: '',
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

    // Skip real-time subscription for test meetings
    if (meetingId.startsWith('test-meeting-id-')) {
      return;
    }

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
              startTime: payload.new.start_time,
              duration: payload.new.duration_minutes ? `${payload.new.duration_minutes} minutes` : meetingDuration,
              attendees: payload.new.participants || [],
              meetingLocation: '',
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
    
    // Don't navigate for test meetings
    if (meetingId.startsWith('test-meeting-id-')) {
      toast.info('Test meetings cannot be viewed. Please record a real meeting.');
      return;
    }
    
    onOpenChange(false);
    // Navigate to meeting summary with view parameter to show Claude notes (Standard format)
    navigate(`/meeting-summary?id=${meetingId}&view=standard`);
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

  const handleEmail = async () => {
    if (notesStatus !== 'completed') {
      toast.info('Meeting notes are still being generated. Please wait a moment.');
      return;
    }
    
    if (!meetingData || !meetingNotes) {
      toast.error('Meeting data not available');
      return;
    }
    
    setIsSendingEmail(true);
    
    try {
      // Get user profile for email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('User email not found');
        return;
      }
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('user_id', user.id)
        .single();
      
      const userEmail = profileData?.email || user.email;
      const userName = profileData?.full_name || 'User';
      
      // Generate Word document blob using docx library directly
      const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
      const { saveAs } = await import('file-saver');
      
      const meetingTime = meetingData?.startTime 
        ? new Date(meetingData.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : undefined;
      
      const meetingDate = meetingData.startTime 
        ? new Date(meetingData.startTime).toLocaleDateString('en-GB')
        : new Date().toLocaleDateString('en-GB');
      
      // Create document sections
      const children: any[] = [];
      
      // Title
      children.push(
        new Paragraph({
          children: [new TextRun({
            text: meetingTitle,
            bold: true,
            size: 32,
          })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
        })
      );
      
      // Meeting details
      if (meetingDate || meetingTime) {
        children.push(
          new Paragraph({
            children: [new TextRun({
              text: `Date: ${meetingDate}${meetingTime ? ` at ${meetingTime}` : ''}`,
              size: 22,
            })],
            spacing: { after: 120 },
          })
        );
      }
      
      if (meetingData.duration) {
        children.push(
          new Paragraph({
            children: [new TextRun({
              text: `Duration: ${meetingData.duration}`,
              size: 22,
            })],
            spacing: { after: 120 },
          })
        );
      }
      
      if (meetingData.attendees && meetingData.attendees.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({
              text: `Attendees: ${meetingData.attendees.join(', ')}`,
              size: 22,
            })],
            spacing: { after: 240 },
          })
        );
      }
      
      // Meeting notes content
      const notesParagraphs = meetingNotes.split('\n').filter(line => line.trim());
      notesParagraphs.forEach(line => {
        children.push(
          new Paragraph({
            children: [new TextRun({
              text: line.replace(/\*\*/g, ''),
              size: 22,
            })],
            spacing: { after: 120 },
          })
        );
      });
      
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children,
        }],
      });
      
      const blob = await Packer.toBlob(doc);
      
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const wordBase64 = await base64Promise;
      
      // Format meeting date for email
      const niceDate = meetingData.startTime 
        ? new Date(meetingData.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      
      // Send email via edge function
      const { error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: {
          to_email: userEmail,
          subject: `Meeting Minutes - ${meetingTitle} - ${niceDate}`,
          message: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
            <div style="margin-bottom: 20px;">
              <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 14px; line-height: 1.5;">
                Dear ${userName},<br><br>
                Please find attached the meeting notes for "${meetingTitle}".<br><br>
                Kind regards,<br>
                ${userName}
              </p>
            </div>
            <hr style="border: none; border-top: 3px solid #0066cc; margin: 20px 0;" />
            <div style="margin-top: 20px;">
              <p style="margin: 8px 0; line-height: 1.5; font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px;">
                ${meetingNotes.replace(/\n/g, '<br>')}
              </p>
            </div>
          </div>`,
          template_type: 'meeting_minutes',
          from_name: 'GP Tools - Meeting Minutes',
          reply_to: 'noreply@gp-tools.nhs.uk',
          word_attachment: {
            content: wordBase64,
            filename: `${meetingTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`,
          },
        },
      });
      
      if (error) {
        throw error;
      }
      
      // Store the email address and show success
      setEmailSentTo(userEmail);
      toast.success(`Email sent to ${userEmail}!`);
    } catch (error) {
      console.error('Email error:', error);
      toast.error('Failed to send email');
    } finally {
      setIsSendingEmail(false);
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
                <span className="text-foreground">{meetingTitle}</span>
                
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
                <div>{getStatusBadge()}</div>
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

            {/* Download and Email Row */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleDownload}
                disabled={isExporting || notesStatus !== 'completed'}
                variant="outline"
                className="justify-start h-12"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                <span className="text-sm">Download Notes (Word Docx)</span>
              </Button>

              <Button
                onClick={handleEmail}
                disabled={notesStatus !== 'completed' || isSendingEmail}
                variant="outline"
                className="justify-start h-12 overflow-hidden"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 flex-shrink-0 animate-spin" />
                    <span className="text-sm truncate">Sending...</span>
                  </>
                ) : emailSentTo ? (
                  <>
                    <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-xs truncate" title={`Email sent to ${emailSentTo}`}>
                      Email sent to {emailSentTo}
                    </span>
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm truncate">Email Notes to me</span>
                  </>
                )}
              </Button>
            </div>

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
