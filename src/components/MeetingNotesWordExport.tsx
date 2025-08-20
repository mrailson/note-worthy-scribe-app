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
    console.log('🔍 BUTTON CLICKED - This should appear in console!');
    
    try {
      setIsGenerating(true);
      setStatus('Testing...');
      toast.info('Testing button click...');
      
      console.log('🔍 About to test docx import...');
      
      // Test if docx package is available
      try {
        const docxModule = await import('docx');
        console.log('🔍 Docx module loaded:', Object.keys(docxModule));
      } catch (importError) {
        console.error('❌ Failed to import docx:', importError);
        throw new Error('Docx package not available: ' + importError.message);
      }
      
      console.log('🔍 Creating simple test document...');
      
      const { Document, Packer, Paragraph, TextRun } = await import('docx');
      
      // Create the simplest possible document
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Test Document",
                  bold: true,
                }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: meetingData?.title || "Meeting Notes",
                }),
              ],
            }),
          ],
        }],
      });
      
      console.log('🔍 Document created, converting to buffer...');
      const buffer = await Packer.toBuffer(doc);
      console.log('🔍 Buffer created, size:', buffer.byteLength);
      
      // Create download
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Test_Document.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setStatus('Success!');
      toast.success('Test document created!');
      console.log('🔍 Test completed successfully');
      
    } catch (error: any) {
      console.error('❌ Test failed:', error);
      console.error('❌ Error stack:', error.stack);
      setStatus('Failed!');
      toast.error('Test failed: ' + error.message);
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