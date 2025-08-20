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
    console.log('🔍 Button clicked - starting Word document generation');
    
    try {
      toast.info('Generating Word document...');
      
      if (!meetingData) {
        throw new Error('No meeting data available');
      }

      setIsGenerating(true);
      setStatus('Generating...');
      
      console.log('🔍 Importing docx library...');
      
      // Dynamic import to handle potential loading issues
      const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
      
      console.log('🔍 Docx imported successfully, creating document...');
      
      // Process content to preserve formatting
      const processContentToParagraphs = (content: string) => {
        const paragraphs = [];
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) {
            // Add empty paragraph for spacing
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: "", size: 20 })],
              spacing: { after: 120 }
            }));
            continue;
          }
          
          // Check if line is a header (contains emojis or all caps sections)
          const isHeader = /^[1-5]️⃣/.test(trimmedLine) || 
                          /^[A-Z\s]{10,}$/.test(trimmedLine) ||
                          trimmedLine.includes('ATTENDEES') ||
                          trimmedLine.includes('OVERVIEW') ||
                          trimmedLine.includes('CONTENT');
          
          if (isHeader) {
            paragraphs.push(new Paragraph({
              children: [new TextRun({
                text: trimmedLine,
                bold: true,
                size: 28,
                color: "1f2937"
              })],
              spacing: { before: 240, after: 120 }
            }));
          } else {
            // Regular content
            paragraphs.push(new Paragraph({
              children: [new TextRun({
                text: trimmedLine,
                size: 22,
                color: "374151"
              })],
              spacing: { after: 120 }
            }));
          }
        }
        
        return paragraphs;
      };
      
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,    // 1 inch
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: [
            // Title
            new Paragraph({
              children: [
                new TextRun({
                  text: meetingData.title || "Meeting Notes",
                  bold: true,
                  size: 36,
                  color: "1f2937"
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 480 }
            }),
            
            // Meeting Details
            new Paragraph({
              children: [
                new TextRun({
                  text: "Date: ",
                  bold: true,
                  size: 24,
                  color: "1f2937"
                }),
                new TextRun({
                  text: meetingData.date || 'Not specified',
                  size: 24,
                  color: "374151"
                }),
              ],
              spacing: { after: 120 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({
                  text: "Duration: ",
                  bold: true,
                  size: 24,
                  color: "1f2937"
                }),
                new TextRun({
                  text: meetingData.duration || 'Not specified',
                  size: 24,
                  color: "374151"
                }),
              ],
              spacing: { after: 120 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({
                  text: "Attendees: ",
                  bold: true,
                  size: 24,
                  color: "1f2937"
                }),
                new TextRun({
                  text: meetingData.attendees || 'Not specified',
                  size: 24,
                  color: "374151"
                }),
              ],
              spacing: { after: 360 }
            }),
            
            // Overview Section
            ...(meetingData.overview ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "OVERVIEW",
                    bold: true,
                    size: 28,
                    color: "1f2937"
                  }),
                ],
                spacing: { before: 240, after: 120 }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: meetingData.overview,
                    size: 22,
                    color: "374151"
                  }),
                ],
                spacing: { after: 360 }
              })
            ] : []),
            
            // Content Section
            ...(meetingData.content ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "DETAILED CONTENT",
                    bold: true,
                    size: 28,
                    color: "1f2937"
                  }),
                ],
                spacing: { before: 240, after: 120 }
              }),
              ...processContentToParagraphs(meetingData.content)
            ] : []),
            
            // Footer
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
                  italics: true,
                  size: 18,
                  color: "6b7280"
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 480 }
            }),
          ],
        }],
      });
      
      console.log('🔍 Document created, generating buffer...');
      const buffer = await Packer.toBuffer(doc);
      console.log('🔍 Buffer size:', buffer.byteLength, 'bytes');
      
      if (buffer.byteLength === 0) {
        throw new Error('Generated document buffer is empty');
      }
      
      // Create download
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      console.log('🔍 Blob created, size:', blob.size, 'bytes');
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Meeting_Notes_${new Date().toISOString().split('T')[0]}.docx`;
      link.style.display = 'none';
      document.body.appendChild(link);
      console.log('🔍 Triggering download...');
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setStatus('Success!');
      toast.success('Word document downloaded successfully!');
      console.log('🔍 Word document download completed successfully');
      
    } catch (error: any) {
      console.error('❌ Error generating Word document:', error);
      setStatus('Error!');
      toast.error(`Failed to generate Word document: ${error.message}`);
      
      console.log('🔍 Word generation failed');
      
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