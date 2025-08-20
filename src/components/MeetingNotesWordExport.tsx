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
    console.log('🔍 Button clicked - starting basic test');
    
    try {
      toast.info('Starting Word document generation...');
      
      if (!meetingData) {
        throw new Error('No meeting data available');
      }

      setIsGenerating(true);
      setStatus('Generating document...');
      
      console.log('🔍 Testing dynamic import of docx...');
      
      // Dynamic import to handle potential loading issues
      const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
      
      console.log('🔍 Docx imported successfully, creating document...');
      
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: meetingData.title || "Meeting Notes",
                  bold: true,
                  size: 32,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Date: ${meetingData.date || 'Not specified'}`,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Duration: ${meetingData.duration || 'Not specified'}`,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Attendees: ${meetingData.attendees || 'Not specified'}`,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Overview:",
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: meetingData.overview || "No overview available",
                  size: 20,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Content:",
                  bold: true,
                  size: 24,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: meetingData.content || "No content available",
                  size: 20,
                }),
              ],
            }),
          ],
        }],
      });
      
      console.log('🔍 Document created, generating buffer...');
      const buffer = await Packer.toBuffer(doc);
      console.log('🔍 Buffer size:', buffer.byteLength);
      
      // Create download
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Meeting_Notes_${new Date().toISOString().split('T')[0]}.docx`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setStatus('Success!');
      toast.success('Word document downloaded successfully!');
      console.log('🔍 Download completed successfully');
      
    } catch (error: any) {
      console.error('❌ Error:', error);
      setStatus('Error!');
      toast.error(`Error: ${error.message || 'Unknown error'}`);
      
      // Fallback to text download if Word generation fails
      console.log('🔍 Attempting fallback to text download...');
      try {
        const textContent = `
MEETING NOTES

Title: ${meetingData?.title || 'Meeting Notes'}
Date: ${meetingData?.date || 'Not specified'}
Duration: ${meetingData?.duration || 'Not specified'}
Attendees: ${meetingData?.attendees || 'Not specified'}

Overview:
${meetingData?.overview || 'No overview available'}

Content:
${meetingData?.content || 'No content available'}
        `.trim();
        
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Meeting_Notes_${new Date().toISOString().split('T')[0]}.txt`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('Downloaded as text file (Word generation failed)');
        setStatus('Text downloaded');
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        toast.error('Both Word and text download failed');
      }
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
        <span className="ml-1 text-xs text-muted-foreground">
          {status.includes('Error') ? '❌' : status.includes('Success') ? '✅' : '📄'}
        </span>
      )}
    </Button>
  );
};

export default MeetingNotesWordExport;