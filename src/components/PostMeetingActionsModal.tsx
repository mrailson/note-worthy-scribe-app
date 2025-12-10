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
import { generateMeetingNotesDocx } from '@/utils/generateMeetingNotesDocx';

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
      supabase.removeChannel(channel);
    };
  }, [meetingId, isOpen]);

  // Auto-send email when notes are ready
  useEffect(() => {
    if (notesStatus !== 'completed' || !meetingData || !user?.email || emailSentRef.current) {
      return;
    }

    const sendAutoEmail = async () => {
      // Prevent duplicate sends
      emailSentRef.current = true;
      setEmailSent(true);

      try {
        console.log('📧 Auto-sending meeting notes email...');
        
        // Get user's full name from profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('email', user.email)
          .single();
        
        const senderName = profileData?.full_name || user.email?.split('@')[0] || 'Notewell AI';
        
        // Format the meeting date for subject
        const meetingDate = meetingData.startTime 
          ? new Date(meetingData.startTime).toLocaleDateString('en-GB', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })
          : new Date().toLocaleDateString('en-GB', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            });
        
        const subject = `Meeting Minutes - ${meetingData.title || meetingTitle} - ${meetingDate}`;
        
        // Convert notes content to styled HTML
        const htmlContent = convertNotesToStyledHTML(
          meetingData.content || meetingNotes,
          senderName,
          meetingData.title || meetingTitle
        );
        
        // Generate Word document attachment
        let wordAttachment = null;
        try {
          const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");
          const { parseContentToDocxElements, stripTranscriptSection } = await import('@/utils/generateMeetingNotesDocx');
          const { buildNHSStyles, buildNumbering, NHS_COLORS, FONTS } = await import('@/utils/wordTheme');
          
          const cleanedContent = stripTranscriptSection(meetingData.content || meetingNotes);
          const cleanTitle = (meetingData.title || meetingTitle).replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim();
          
          const children: any[] = [];
          
          children.push(
            new Paragraph({
              children: [new TextRun({
                text: cleanTitle,
                bold: true,
                size: FONTS.size.title,
                color: NHS_COLORS.headingBlue,
                font: FONTS.default,
              })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 240 },
            })
          );
          
          const contentElements = await parseContentToDocxElements(cleanedContent);
          children.push(...contentElements);
          
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-GB');
          const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          
          children.push(
            new Paragraph({
              children: [new TextRun({
                text: `Generated on ${dateStr} ${timeStr}`,
                italics: true,
                size: FONTS.size.footer,
                color: NHS_COLORS.textLightGrey,
                font: FONTS.default,
              })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 480 },
            })
          );
          
          const styles = buildNHSStyles();
          const numbering = buildNumbering();
          
          const doc = new Document({
            styles: styles,
            numbering: numbering,
            sections: [{ children }],
          });
          
          const blob = await Packer.toBlob(doc);
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
          });
          reader.readAsDataURL(blob);
          const base64Content = await base64Promise;
          
          const safeFilename = (meetingData.title || meetingTitle)
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
          
          wordAttachment = {
            content: base64Content,
            filename: `${safeFilename}_Meeting_Notes.docx`,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          };
        } catch (docError) {
          console.warn('Word document generation failed for auto-email:', docError);
        }
        
        // Check for audio overview and include if available
        let audioAttachment = null;
        try {
          const { data: audioData } = await supabase
            .from('audio_overview_sessions')
            .select('audio_url, title')
            .eq('id', meetingId)
            .maybeSingle();
          
          if (audioData?.audio_url) {
            console.log('🔊 Found audio overview, fetching for attachment...');
            const audioResponse = await fetch(audioData.audio_url);
            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob();
              const audioReader = new FileReader();
              const audioBase64Promise = new Promise<string>((resolve) => {
                audioReader.onloadend = () => {
                  const base64 = (audioReader.result as string).split(',')[1];
                  resolve(base64);
                };
              });
              audioReader.readAsDataURL(audioBlob);
              const audioBase64 = await audioBase64Promise;
              
              const safeAudioFilename = (meetingData.title || meetingTitle)
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);
              
              audioAttachment = {
                content: audioBase64,
                filename: `${safeAudioFilename}_Audio_Overview.mp3`,
                type: 'audio/mpeg'
              };
              console.log('✅ Audio attachment prepared');
            }
          }
        } catch (audioError) {
          console.warn('Audio attachment fetch failed:', audioError);
        }
        
        // Send email via Resend edge function
        const { data, error } = await supabase.functions.invoke('send-meeting-email-resend', {
          body: {
            to_email: user.email,
            cc_emails: [],
            subject,
            html_content: htmlContent,
            from_name: senderName,
            word_attachment: wordAttachment,
            audio_attachment: audioAttachment
          }
        });
        
        if (error) {
          console.error('Auto-email sending error:', error);
          return;
        }
        
        if (data?.success) {
          console.log('✅ Auto-email sent successfully to:', user.email);
        } else {
          console.error('Auto-email failed:', data);
        }
      } catch (error) {
        console.error('Error sending auto-email:', error);
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

  // Helper function to convert notes to styled HTML for email
  const convertNotesToStyledHTML = (content: string, senderName: string, title: string): string => {
    // Strip markdown hash characters from headings
    let html = content
      .replace(/^#{1,6}\s*(.*?)$/gm, (_, text) => `<h2 style="color: #2563EB; font-size: 14px; font-weight: 700; margin: 20px 0 8px 0; font-family: Arial, sans-serif; text-transform: uppercase;">${text.trim()}</h2>`)
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #2563EB;">$1</strong>')
      .replace(/\n/g, '<br>');

    return `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #ffffff; padding: 20px;">
      <div style="margin-bottom: 20px;">
        <p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 14px; line-height: 1.5;">
          Dear ${senderName},<br><br>
          Please find attached the meeting notes for "${title}".<br><br>
          Kind regards,<br>
          ${senderName}
        </p>
      </div>
      <hr style="border: none; border-top: 3px solid #0066cc; margin: 20px 0;" />
      <div style="margin-top: 20px;">
        ${html}
      </div>
    </div>`;
  };

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
    // Navigate to meeting history with state to open the standard notes view
    navigate('/meeting-history', { 
      state: { 
        viewNotes: meetingId, 
        openModal: true 
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
                    <Badge variant="outline" className="flex items-center gap-1.5 text-muted-foreground border-muted-foreground/30">
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
