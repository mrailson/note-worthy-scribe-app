import React from 'react';
import { FileText, Share2, List, Clock, Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateMeetingNotesDocx } from '@/utils/generateMeetingNotesDocx';
import { useAutoEmail } from '@/hooks/useAutoEmail';
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

  const fetchMeetingData = async () => {
    if (!meetingId || !user) return null;
    const { data } = await supabase
      .from('meetings')
      .select('id, title, created_at, duration_minutes, word_count, best_of_all_transcript, notes_style_3, overview, meeting_attendees_json')
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
