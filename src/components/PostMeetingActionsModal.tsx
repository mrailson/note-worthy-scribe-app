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
import { showToast } from "@/utils/toastWrapper";

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
  const [isDownloaded, setIsDownloaded] = useState(false);
  
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

  // Reset email sent state and download state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setEmailSentTo('');
      setIsDownloaded(false);
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
        
        // Use notes_style_3 (Standard Minutes) if available, fall back to overview
        const detailedNotes = data.notes_style_3 || data.overview || '';
        
        // Set meeting data for export
        setMeetingData({
          title: data.title,
          startTime: data.start_time,
          duration: data.duration_minutes ? `${data.duration_minutes} minutes` : meetingDuration,
          attendees: data.participants || [],
          meetingLocation: '',
          overview: data.overview || '',
          content: detailedNotes,
        });
        
        if (data.notes_generation_status === 'completed') {
          setNotesStatus('completed');
          setMeetingNotes(detailedNotes);
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

  const handleDownload = async () => {
    if (!meetingData) {
      showToast.error('Meeting data not loaded yet', { section: 'meeting_manager' });
      return;
    }
    
    try {
      const content = meetingData.overview || meetingData.content || '';
      const title = meetingData.title || meetingTitle; // Use updated title from database
      await generateWordDocument(content, title);
      setIsDownloaded(true);
      showToast.success('Meeting notes downloaded!', { section: 'meeting_manager' });
    } catch (error) {
      console.error('Download error:', error);
      showToast.error('Failed to download meeting notes', { section: 'meeting_manager' });
    }
  };

  const handleEmail = async () => {
    if (notesStatus !== 'completed') {
      showToast.info('Meeting notes are still being generated. Please wait a moment.', { section: 'meeting_manager' });
      return;
    }
    
    if (!meetingData || !meetingNotes) {
      showToast.error('Meeting data not available', { section: 'meeting_manager' });
      return;
    }
    
    setIsSendingEmail(true);
    
    try {
      // Get user profile for email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        showToast.error('User email not found', { section: 'meeting_manager' });
        return;
      }
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('user_id', user.id)
        .single();
      
      const userEmail = profileData?.email || user.email;
      const userName = profileData?.full_name || 'User';
      
      // Generate NHS-styled Word document using the same utilities as standard minutes email
      const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
      const { parseContentToDocxElements, stripTranscriptSection } = await import('@/utils/generateMeetingNotesDocx');
      const { buildNHSStyles, buildNumbering, NHS_COLORS, FONTS } = await import('@/utils/wordTheme');
      const { renderNHSMarkdown } = await import('@/lib/nhsMarkdownRenderer');
      
      // Strip transcript sections
      const cleanedContent = stripTranscriptSection(meetingNotes);
      
      // Clean the title
      const cleanTitle = meetingTitle.replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim();
      
      // Build document children
      const children: any[] = [];
      
      // Title
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
      
      const meetingTime = meetingData?.startTime 
        ? new Date(meetingData.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : undefined;
      
      const meetingDate = meetingData.startTime 
        ? new Date(meetingData.startTime).toLocaleDateString('en-GB')
        : new Date().toLocaleDateString('en-GB');
      
      // Meeting details
      if (meetingDate || meetingTime) {
        children.push(
          new Paragraph({
            children: [new TextRun({
              text: `Date: ${meetingDate}${meetingTime ? ` at ${meetingTime}` : ''}`,
              size: FONTS.size.body,
              color: NHS_COLORS.textGrey,
              font: FONTS.default,
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
              size: FONTS.size.body,
              color: NHS_COLORS.textGrey,
              font: FONTS.default,
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
              size: FONTS.size.body,
              color: NHS_COLORS.textGrey,
              font: FONTS.default,
            })],
            spacing: { after: 240 },
          })
        );
      }
      
      // Parse and add content using NHS-styled elements
      const contentElements = await parseContentToDocxElements(cleanedContent);
      children.push(...contentElements);
      
      // Footer
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
      
      // Create document with NHS theme
      const styles = buildNHSStyles();
      const numbering = buildNumbering();
      
      const doc = new Document({
        styles: styles,
        numbering: numbering,
        sections: [{
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
      
      // Format meeting date and render HTML using NHS markdown renderer
      const niceDate = meetingData.startTime 
        ? new Date(meetingData.startTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      
      // Convert meeting notes to styled HTML using the same renderer as standard minutes
      const renderedNotesHTML = renderNHSMarkdown(meetingNotes, { enableNHSStyling: false, isUserMessage: false });
      
      // Add email-specific CSS styling to match the standard minutes appearance
      const emailCSS = `
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; color: #1f2937; background-color: #ffffff; margin: 0; padding: 20px; }
          .message-container { max-width: 700px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; }
          h1 { color: #2563eb; font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; margin-top: 1.5rem; }
          h2 { color: #2563eb; font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; margin-top: 1.25rem; }
          h3 { color: #2563eb; font-size: 1.125rem; font-weight: 600; margin-bottom: 0.75rem; margin-top: 1rem; }
          p { margin-bottom: 0.75rem; line-height: 1.6; color: inherit; }
          strong { font-weight: 600; color: #1f2937; }
        </style>
      `;
      
      const styledMessage = `${emailCSS}<div class="message-container">
        <p style="margin-bottom: 16px;">Dear ${userName},</p>
        <p style="margin-bottom: 16px;">Please find attached the meeting notes for "${meetingTitle}".</p>
        <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 20px 0;" />
        ${renderedNotesHTML}
        <hr style="border: none; border-top: 2px solid #e2e8f0; margin: 20px 0;" />
        <p style="margin-top: 16px;">Kind regards,<br>${userName}</p>
      </div>`;
      
      // Send email via edge function
      const { error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: {
          to_email: userEmail,
          subject: `Meeting Minutes - ${meetingTitle} - ${niceDate}`,
          message: styledMessage,
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
      showToast.success(`Email sent to ${userEmail}!`, { section: 'meeting_manager' });
    } catch (error) {
      console.error('Email error:', error);
      showToast.error('Failed to send email', { section: 'meeting_manager' });
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
                className="justify-start h-12 overflow-hidden"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 flex-shrink-0 animate-spin" />
                    <span className="text-sm truncate">Downloading...</span>
                  </>
                ) : isDownloaded ? (
                  <>
                    <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-xs truncate">Meeting Notes Downloaded</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm truncate">Download Notes (Word Docx)</span>
                  </>
                )}
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
