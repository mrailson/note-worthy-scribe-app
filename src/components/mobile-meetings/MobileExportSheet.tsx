import React, { useState } from 'react';
import { FileText, Share2, List, Clock, Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateMeetingNotesDocx } from '@/utils/generateMeetingNotesDocx';
import { toast } from 'sonner';
import './mobile-meetings.css';

interface MobileExportSheetProps {
  open: boolean;
  onClose: () => void;
  meetingId?: string | null;
  wordCount?: number;
  onShare?: () => void;
}

export const MobileExportSheet: React.FC<MobileExportSheetProps> = ({
  open,
  onClose,
  meetingId,
  wordCount = 0,
  onShare,
}) => {
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);

  const fetchMeetingData = async () => {
    if (!meetingId || !user) return null;
    const { data } = await supabase
      .from('meetings')
      .select('id, title, created_at, start_time, duration_minutes, word_count, best_of_all_transcript, notes_style_3, overview, meeting_attendees_json, participants, meeting_format, meeting_location')
      .eq('id', meetingId)
      .eq('user_id', user.id)
      .maybeSingle();
    return data;
  };

  const handleExportNotes = async () => {
    try {
      const meeting = await fetchMeetingData();
      if (!meeting) {
        toast.error('Could not load meeting data');
        return;
      }

      const notesContent = meeting.notes_style_3 || meeting.overview || '';
      if (!notesContent) {
        toast.error('No notes available. Generate notes first.');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user!.id)
        .maybeSingle();

      await generateMeetingNotesDocx({
        metadata: {
          title: meeting.title || 'Meeting Notes',
          date: new Date(meeting.created_at).toLocaleDateString('en-GB'),
          duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : undefined,
          loggedUserName: profile?.full_name || undefined,
        },
        content: notesContent,
      });

      toast.success('Notes exported');
      onClose();
    } catch (error) {
      console.error('Export notes error:', error);
      toast.error('Failed to export notes');
    }
  };

  const handleEmailNotes = async () => {
    if (!user?.email) {
      toast.error('No email address found in your profile');
      return;
    }

    setIsSending(true);
    try {
      const meeting = await fetchMeetingData();
      if (!meeting) {
        toast.error('Could not load meeting data');
        return;
      }

      // Prefer meeting_summaries.summary (canonical source) over notes_style_3
      let notesContent = '';
      try {
        const { data: summaryData } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meetingId!)
          .maybeSingle();
        notesContent = summaryData?.summary || '';
      } catch {
        // fallback
      }
      if (!notesContent) {
        notesContent = meeting.notes_style_3 || meeting.overview || '';
      }

      if (!notesContent) {
        toast.error('No notes available. Generate notes first.');
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user!.id)
        .maybeSingle();

      const senderName = profile?.full_name || user.email?.split('@')[0] || 'Notewell AI';

      // Format meeting date
      const meetingStartTime = meeting.start_time || meeting.created_at;
      const meetingDate = new Date(meetingStartTime).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const meetingTime = new Date(meetingStartTime).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }) + ' GMT';

      const cleanTitle = (meeting.title || 'Meeting Notes').replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim();
      const subject = `Notewell AI | ${cleanTitle} — ${meetingDate}`;

      // Build professional NHS-branded email HTML (same as auto-email on meeting create)
      const { buildProfessionalMeetingEmail } = await import('@/utils/meetingEmailBuilder');
      const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
      const htmlContent = buildProfessionalMeetingEmail(
        notesContent,
        senderName,
        cleanTitle,
        {
          date: meetingDate,
          time: meetingTime,
          duration: meeting.duration_minutes,
          format: meeting.meeting_format,
          location: meeting.meeting_location,
          overview: meeting.overview,
          wordCount: meeting.word_count,
          attendees: participants as string[],
        }
      );

      // Generate professional Word document attachment (same as auto-email)
      let wordAttachment = null;
      try {
        const { generateProfessionalWordBlob } = await import('@/utils/generateProfessionalMeetingDocx');

        const parsedDetails = {
          title: cleanTitle,
          date: meetingDate,
          time: meetingTime,
          location: meeting.meeting_format || meeting.meeting_location || undefined,
          attendees: participants.length > 0 ? (participants as string[]).join(', ') : undefined,
        };

        // Fetch action items
        let parsedActionItems: any[] = [];
        try {
          const { data: actionItemsData } = await supabase
            .from('meeting_action_items')
            .select('action_text, assignee_name, due_date, priority, status')
            .eq('meeting_id', meetingId!);

          if (actionItemsData && actionItemsData.length > 0) {
            parsedActionItems = actionItemsData.map((item: any) => ({
              action: item.action_text,
              owner: item.assignee_name || 'Unassigned',
              deadline: item.due_date || undefined,
              priority: item.priority || 'medium',
              status: item.status === 'completed' ? 'Completed' as const : item.status === 'in_progress' ? 'In Progress' as const : 'Open' as const,
              isCompleted: item.status === 'completed',
            }));
          }
        } catch (aiErr) {
          console.warn('Could not fetch action items for Word attachment:', aiErr);
        }

        const blob = await generateProfessionalWordBlob(notesContent, cleanTitle, parsedDetails, parsedActionItems);

        const base64Content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            if (result) {
              resolve(result.split(',')[1]);
            } else {
              reject(new Error('FileReader returned empty result'));
            }
          };
          reader.onerror = () => reject(new Error('FileReader error'));
          reader.readAsDataURL(blob);
        });

        const { generateMeetingFilename } = await import('@/utils/meetingFilename');
        const attachmentFilename = generateMeetingFilename(
          cleanTitle,
          new Date(meetingStartTime),
          'docx'
        );

        wordAttachment = {
          content: base64Content,
          filename: attachmentFilename,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
        console.log('📎 Professional Word attachment generated:', attachmentFilename);
      } catch (docError) {
        console.error('Word document generation failed:', docError);
        // Fallback: try without parsed data
        try {
          const { generateProfessionalWordBlob } = await import('@/utils/generateProfessionalMeetingDocx');
          const blob = await generateProfessionalWordBlob(notesContent, cleanTitle, undefined, []);
          const reader = new FileReader();
          const base64Content = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          });
          reader.readAsDataURL(blob);
          wordAttachment = {
            content: await base64Content,
            filename: `meeting_notes.docx`,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          };
        } catch (fallbackError) {
          console.error('All Word generation attempts failed:', fallbackError);
        }
      }

      // Send via Resend edge function
      const { data, error } = await supabase.functions.invoke('send-meeting-email-resend', {
        body: {
          to_email: user.email,
          cc_emails: [],
          subject,
          html_content: htmlContent,
          from_name: senderName,
          word_attachment: wordAttachment,
        },
      });

      if (error) throw new Error(error.message || 'Failed to send email');
      if (!data?.success) throw new Error(data?.error || 'Failed to send email');

      toast.success(`Meeting notes sent to ${user.email}`);
      onClose();
    } catch (error: any) {
      console.error('Email notes error:', error);
      toast.error(error.message || 'Failed to email notes');
    } finally {
      setIsSending(false);
    }
  };

  const handleExportTranscript = async () => {
    try {
      const meeting = await fetchMeetingData();
      if (!meeting) {
        toast.error('Could not load meeting data');
        return;
      }

      const transcript = meeting.best_of_all_transcript || '';
      if (!transcript) {
        toast.error('No transcript available');
        return;
      }

      await generateMeetingNotesDocx({
        metadata: {
          title: `${meeting.title || 'Meeting'} — Full Transcript`,
          date: new Date(meeting.created_at).toLocaleDateString('en-GB'),
          duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : undefined,
        },
        content: transcript,
      });

      toast.success('Transcript exported');
      onClose();
    } catch (error) {
      console.error('Export transcript error:', error);
      toast.error('Failed to export transcript');
    }
  };

  const handleExportQuality = async () => {
    try {
      const meeting = await fetchMeetingData();
      if (!meeting) {
        toast.error('Could not load meeting data');
        return;
      }

      // Fetch confidence data
      const { data: fullMeeting } = await supabase
        .from('meetings')
        .select('whisper_confidence, assembly_confidence, whisper_transcript_text, assembly_transcript_text, best_of_all_transcript')
        .eq('id', meetingId!)
        .maybeSingle();

      const whisperWords = fullMeeting?.whisper_transcript_text?.split(/\s+/).length || 0;
      const assemblyWords = fullMeeting?.assembly_transcript_text?.split(/\s+/).length || 0;
      const bestWords = fullMeeting?.best_of_all_transcript?.split(/\s+/).length || 0;

      const qualityContent = [
        `# Quality Summary`,
        ``,
        `## Transcription Engines`,
        `- **Whisper**: ${whisperWords.toLocaleString()} words (confidence: ${fullMeeting?.whisper_confidence || 'N/A'}%)`,
        `- **AssemblyAI**: ${assemblyWords.toLocaleString()} words (confidence: ${fullMeeting?.assembly_confidence || 'N/A'}%)`,
        `- **Best of All (merged)**: ${bestWords.toLocaleString()} words`,
        ``,
        `## Meeting Details`,
        `- Duration: ${meeting.duration_minutes || 'N/A'} minutes`,
        `- Word count: ${meeting.word_count?.toLocaleString() || 'N/A'}`,
      ].join('\n');

      await generateMeetingNotesDocx({
        metadata: {
          title: `${meeting.title || 'Meeting'} — Quality Summary`,
          date: new Date(meeting.created_at).toLocaleDateString('en-GB'),
        },
        content: qualityContent,
      });

      toast.success('Quality summary exported');
      onClose();
    } catch (error) {
      console.error('Export quality error:', error);
      toast.error('Failed to export quality summary');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Meeting notes', text: 'Shared from Notewell AI' });
      } catch { /* user cancelled */ }
    }
    onShare?.();
  };

  return (
    <>
      <div className={`nw-mh-sheet-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`nw-mh-sheet ${open ? 'open' : ''}`}>
        <div className="nw-mh-sheet-handle" />
        <div className="nw-mh-sheet-title">Export meeting</div>

        <button className="nw-mh-sheet-option" onClick={handleExportNotes}>
          <div className="nw-mh-sheet-option-icon" style={{ background: 'var(--nw-blue-light)' }}>
            <FileText size={20} color="var(--nw-blue)" />
          </div>
          <div>
            <div>Meeting notes (.docx)</div>
            <div className="nw-mh-sheet-option-detail">Formatted governance document with action log</div>
          </div>
        </button>

        <button className="nw-mh-sheet-option" onClick={handleEmailNotes} disabled={isSending}>
          <div className="nw-mh-sheet-option-icon" style={{ background: 'hsl(var(--accent))' }}>
            {isSending ? <Loader2 size={20} className="animate-spin" style={{ color: 'hsl(var(--accent-foreground))' }} /> : <Mail size={20} style={{ color: 'hsl(var(--accent-foreground))' }} />}
          </div>
          <div>
            <div>{isSending ? 'Sending…' : 'Email notes to me'}</div>
            <div className="nw-mh-sheet-option-detail">Send notes with Word attachment to your email</div>
          </div>
        </button>

        <button className="nw-mh-sheet-option" onClick={handleExportTranscript}>
          <div className="nw-mh-sheet-option-icon" style={{ background: 'var(--nw-green-light)' }}>
            <List size={20} color="var(--nw-green)" />
          </div>
          <div>
            <div>Full transcript (.docx)</div>
            <div className="nw-mh-sheet-option-detail">
              Best of All merged transcript{wordCount > 0 ? ` — ${wordCount.toLocaleString()} words` : ''}
            </div>
          </div>
        </button>

        <button className="nw-mh-sheet-option" onClick={handleExportQuality}>
          <div className="nw-mh-sheet-option-icon" style={{ background: 'var(--nw-amber-light)' }}>
            <Clock size={20} color="var(--nw-amber)" />
          </div>
          <div>
            <div>Quality summary (.docx)</div>
            <div className="nw-mh-sheet-option-detail">Engine comparison, chunk data, and confidence scores</div>
          </div>
        </button>

        <button className="nw-mh-sheet-option" onClick={handleShare}>
          <div className="nw-mh-sheet-option-icon" style={{ background: 'var(--nw-surface2)' }}>
            <Share2 size={20} color="var(--nw-text2)" />
          </div>
          <div>
            <div>Share via…</div>
            <div className="nw-mh-sheet-option-detail">Email, Teams, Slack, or copy link</div>
          </div>
        </button>
      </div>
    </>
  );
};
