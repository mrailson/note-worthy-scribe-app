import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { extractAttendees } from '@/utils/extractAttendees';
import { useAuth } from '@/contexts/AuthContext';
import { generateMeetingFilename } from '@/utils/meetingFilename';

interface MeetingData {
  title: string;
  date: string;
  duration: string;
  attendees: string;
  overview: string;
  content: string;
  agendaItems?: Array<{
    title: string;
    subsections?: Array<{
      title: string;
      points?: string[];
    }>;
  }>;
  decisions?: Record<string, string[]>;
  actionItems?: Record<string, string[]>;
  deferredItems?: string[];
  risks?: Record<string, string[]>;
}

interface MeetingNotesWordExportProps {
  meetingData: MeetingData;
  /**
   * Optional. The DB id of the meeting being exported. When supplied, we look
   * up `meetings.notes_model_used` so the page footer can carry the model
   * provenance stamp on every download (including re-downloads of old notes).
   */
  meetingId?: string;
}

const MeetingNotesWordExport: React.FC<MeetingNotesWordExportProps> = ({ meetingData }) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');

  const generateWordDocument = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🔍 Generating full-featured Word document with formatting!');
    
    try {
      setIsGenerating(true);
      setStatus('Generating...');
      showToast.info('Generating Word document...', { section: 'meeting_manager' });
      
      if (!meetingData) {
        throw new Error('No meeting data available');
      }
      
      const { generateMeetingNotesDocx } = await import('@/utils/generateMeetingNotesDocx');
      
      // Combine overview and content
      let fullContent = '';
      if (meetingData.overview) {
        fullContent += meetingData.overview + '\n\n';
      }
      if (meetingData.content) {
        fullContent += meetingData.content;
      }

      // Try to extract the actual meeting title from content (e.g. "Meeting Title: ...")
      const titleMatch = fullContent.match(/^\s*[-•*]?\s*\**\s*Meeting Title\s*:\s*(.+)$/im);
      const extractedTitle = titleMatch ? titleMatch[1].trim() : (meetingData.title || 'Meeting Notes');
      const safeTitle = extractedTitle.replace(/\*\*/g, '').replace(/\*/g, '').trim();
      const filename = generateMeetingFilename(safeTitle, new Date(), 'docx');
      
      // Prefer meetingData.attendees, otherwise extract from content
      const computedAttendees = (meetingData.attendees && meetingData.attendees.trim())
        ? meetingData.attendees
        : extractAttendees(fullContent);
      console.log('🧑‍🤝‍🧑 Extracted attendees for DOCX:', computedAttendees);
      
      // Get logged-in user's name to replace Facilitator/Unidentified
      const loggedUserName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
      
      await generateMeetingNotesDocx({
        metadata: {
          title: safeTitle,
          date: meetingData.date,
          duration: meetingData.duration,
          attendees: computedAttendees,
          loggedUserName: loggedUserName,
        },
        content: fullContent,
        filename,
      });
      
      setStatus('Success!');
      showToast.success('Word document downloaded successfully!', { section: 'meeting_manager' });
      console.log('🔍 Full-featured Word document download completed!');
      
    } catch (error: any) {
      console.error('❌ Word generation failed:', error);
      setStatus('Failed!');
      showToast.error('Word generation failed: ' + error.message, { section: 'meeting_manager' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={generateWordDocument}
      disabled={isGenerating || !meetingData}
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs touch-manipulation"
      type="button"
    >
      <FileText className="h-3 w-3 mr-1" />
      {isGenerating ? "Generating..." : "Word Doc"}
      {status && (
        <span className="ml-1 text-xs">
          {status.includes('Error') ? '❌' : status.includes('Success') ? '✅' : '📄'}
        </span>
      )}
    </Button>
  );
};

export default MeetingNotesWordExport;