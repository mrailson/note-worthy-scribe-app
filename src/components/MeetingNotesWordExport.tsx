import React from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';

interface MeetingData {
  title?: string;
  date?: string;
  duration?: string;
  attendees?: string;
  overview?: string;
  content?: string;
}

interface MeetingNotesWordExportProps {
  meetingData: MeetingData;
  className?: string;
}

const MeetingNotesWordExport: React.FC<MeetingNotesWordExportProps> = ({ 
  meetingData, 
  className = "" 
}) => {
  
  const parseContentIntoSections = (content: string) => {
    // Parse the meeting content into structured sections
    const lines = content.split('\n').filter(line => line.trim());
    const sections: any[] = [];
    let currentSection: any = null;
    let currentSubsection: any = null;
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Main headings (numbered sections like "1. DISPENSARY CONSOLIDATION")
      if (/^\d+\.\s+[A-Z\s]+$/.test(trimmed)) {
        if (currentSection) sections.push(currentSection);
        currentSection = {
          title: trimmed,
          subsections: []
        };
        currentSubsection = null;
      }
      // Sub-headings (title case)
      else if (/^[A-Z][a-z\s]+:?$/.test(trimmed) && !trimmed.startsWith('-') && !trimmed.startsWith('•')) {
        if (currentSection) {
          currentSubsection = {
            title: trimmed,
            points: []
          };
          currentSection.subsections.push(currentSubsection);
        }
      }
      // Bullet points
      else if ((trimmed.startsWith('-') || trimmed.startsWith('•')) && currentSubsection) {
        currentSubsection.points.push(trimmed.substring(1).trim());
      }
      // Regular content
      else if (trimmed && currentSection) {
        if (!currentSubsection) {
          currentSubsection = {
            title: "Details",
            points: []
          };
          currentSection.subsections.push(currentSubsection);
        }
        currentSubsection.points.push(trimmed);
      }
    });
    
    if (currentSection) sections.push(currentSection);
    return sections;
  };

  const createWordDocument = () => {
    const agendaItems = parseContentIntoSections(meetingData.content || '');
    
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1417,    // 2.5cm in twips
              right: 1417,
              bottom: 1417,
              left: 1417,
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
                size: 32, // 16pt
                font: "Calibri",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 240, line: 360 }, // 12pt spacing after, 1.5 line spacing
          }),
          
          // Meeting Details Section
          new Paragraph({
            children: [
              new TextRun({
                text: "Date: ",
                bold: true,
                size: 22, // 11pt
                font: "Calibri",
              }),
              new TextRun({
                text: meetingData.date || "Not specified",
                size: 22,
                font: "Calibri",
              }),
            ],
            spacing: { after: 60, line: 360 }, // 3pt spacing, 1.5 line spacing
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: "Duration: ",
                bold: true,
                size: 22,
                font: "Calibri",
              }),
              new TextRun({
                text: meetingData.duration || "Not specified",
                size: 22,
                font: "Calibri",
              }),
            ],
            spacing: { after: 60, line: 360 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: "Attendees: ",
                bold: true,
                size: 22,
                font: "Calibri",
              }),
              new TextRun({
                text: meetingData.attendees || "Not specified",
                size: 22,
                font: "Calibri",
              }),
            ],
            spacing: { after: 180, line: 360 }, // 9pt spacing before next section
          }),
          
          // Meeting Overview Section
          ...(meetingData.overview ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: "MEETING OVERVIEW",
                  bold: true,
                  size: 28, // 14pt
                  font: "Calibri",
                }),
              ],
              spacing: { after: 120, line: 360 }, // 6pt spacing
            }),
            
            new Paragraph({
              children: [
                new TextRun({
                  text: meetingData.overview,
                  size: 22,
                  font: "Calibri",
                }),
              ],
              spacing: { after: 240, line: 360 }, // 12pt spacing before next section
            }),
          ] : []),
          
          // Main sections
          ...createAgendaSections(agendaItems),
        ],
      }],
    });
    
    return doc;
  };
  
  const createAgendaSections = (agendaItems: any[]) => {
    const sections: any[] = [];
    
    agendaItems.forEach((item, index) => {
      // Main heading
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: item.title,
              bold: true,
              size: 28,
              font: "Calibri",
            }),
          ],
          spacing: { after: 120, line: 360 },
        })
      );
      
      // Sub-sections
      item.subsections?.forEach((subsection: any) => {
        // Sub-heading
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: subsection.title,
                bold: true,
                size: 24, // 12pt
                font: "Calibri",
              }),
            ],
            spacing: { after: 60, line: 360 },
          })
        );
        
        // Bullet points
        subsection.points?.forEach((point: string) => {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: point.includes('"') ? 
                    point.replace(/"/g, '"').replace(/"/g, '"') : point,
                  size: 22,
                  font: "Calibri",
                  italics: point.includes('"'), // Italicize quoted text
                }),
              ],
              bullet: { level: 0 },
              spacing: { after: 60, line: 360 },
            })
          );
        });
      });
      
      // Spacing after main section
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: "", size: 22, font: "Calibri" })],
          spacing: { after: 240, line: 360 },
        })
      );
    });
    
    return sections;
  };
  
  const downloadDocument = async () => {
    try {
      const doc = createWordDocument();
      const buffer = await Packer.toBuffer(doc);
      
      // Create download
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${meetingData.title || 'Meeting_Notes'}_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Word document downloaded successfully!');
      
    } catch (error) {
      console.error('Error creating Word document:', error);
      toast.error('Error creating document. Please try again.');
    }
  };
  
  return (
    <Button 
      onClick={downloadDocument}
      variant="outline"
      size="sm"
      className={`h-7 px-2 text-xs touch-manipulation ${className}`}
    >
      <FileDown className="h-3 w-3 mr-1" />
      Word Doc
    </Button>
  );
};

export default MeetingNotesWordExport;