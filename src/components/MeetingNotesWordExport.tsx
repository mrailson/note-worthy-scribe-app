import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';

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
}

const MeetingNotesWordExport: React.FC<MeetingNotesWordExportProps> = ({ meetingData }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');

  const generateWordDocument = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🔍 Generating full-featured Word document with formatting!');
    
    try {
      setIsGenerating(true);
      setStatus('Generating...');
      toast.info('Generating Word document...');
      
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
      
      await generateMeetingNotesDocx({
        metadata: {
          title: meetingData.title || 'Meeting Notes',
          date: meetingData.date,
          duration: meetingData.duration,
          attendees: meetingData.attendees,
        },
        content: fullContent,
        filename: `Meeting_Notes_${new Date().toISOString().split('T')[0]}.docx`,
      });
      
      setStatus('Success!');
      toast.success('Word document downloaded successfully!');
      console.log('🔍 Full-featured Word document download completed!');
      
    } catch (error: any) {
      console.error('❌ Word generation failed:', error);
      setStatus('Failed!');
      toast.error('Word generation failed: ' + error.message);
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