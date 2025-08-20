import React, { useState } from 'react';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { Button } from '@/components/ui/button';
import { Download, FileText, CheckCircle, AlertCircle } from 'lucide-react';

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

  const createWordDocument = () => {
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
                text: "Partnership Meeting Notes",
                bold: true,
                size: 32, // 16pt
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 }, // 24pt spacing after
          }),
          
          // Meeting Details
          new Paragraph({
            children: [
              new TextRun({
                text: "Date: ",
                bold: true,
                size: 22, // 11pt
              }),
              new TextRun({
                text: meetingData.date || "Not specified",
                size: 22,
              }),
            ],
            spacing: { after: 120 }, // 6pt spacing
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: "Duration: ",
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: meetingData.duration || "Not specified",
                size: 22,
              }),
            ],
            spacing: { after: 120 },
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: "Attendees: ",
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: meetingData.attendees || "Not specified",
                size: 22,
              }),
            ],
            spacing: { after: 360 }, // 18pt spacing before next section
          }),
          
          // Meeting Overview
          new Paragraph({
            children: [
              new TextRun({
                text: "MEETING OVERVIEW",
                bold: true,
                size: 28, // 14pt
              }),
            ],
            spacing: { after: 240 }, // 12pt spacing
          }),
          
          new Paragraph({
            children: [
              new TextRun({
                text: meetingData.overview || "",
                size: 22,
              }),
            ],
            spacing: { after: 480 }, // 24pt spacing before next section
          }),
          
          // Dynamic agenda sections
          ...createAgendaSections(meetingData.agendaItems || []),
          
          // Consolidated Decisions
          new Paragraph({
            children: [
              new TextRun({
                text: "CONSOLIDATED DECISIONS FROM ENTIRE MEETING",
                bold: true,
                size: 28,
              }),
            ],
            spacing: { after: 240 },
          }),
          
          ...createDecisionsSections(meetingData.decisions || {}),
          
          // Action Items
          new Paragraph({
            children: [
              new TextRun({
                text: "CONSOLIDATED ACTION ITEMS FROM ENTIRE MEETING",
                bold: true,
                size: 28,
              }),
            ],
            spacing: { after: 240 },
          }),
          
          ...createActionItemsSections(meetingData.actionItems || {}),
          
          // Deferred Items
          new Paragraph({
            children: [
              new TextRun({
                text: "DEFERRED ITEMS",
                bold: true,
                size: 28,
              }),
            ],
            spacing: { after: 240 },
          }),
          
          ...createDeferredItemsSections(meetingData.deferredItems || []),
          
          // Risks
          new Paragraph({
            children: [
              new TextRun({
                text: "RISKS AND CONSIDERATIONS",
                bold: true,
                size: 28,
              }),
            ],
            spacing: { after: 240 },
          }),
          
          ...createRisksSections(meetingData.risks || {}),

          // Meeting Content from Claude AI
          ...(meetingData.content ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: "DETAILED MEETING NOTES",
                  bold: true,
                  size: 28,
                }),
              ],
              spacing: { after: 240, before: 480 },
            }),
            ...processContentForWord(meetingData.content)
          ] : []),
          
          // Closing paragraph
          new Paragraph({
            children: [
              new TextRun({
                text: "This comprehensive meeting covered significant operational restructuring proposals requiring careful implementation planning and risk management. The partnership demonstrated thorough consideration of multiple alternatives whilst acknowledging both opportunities for efficiency gains and potential challenges in execution.",
                size: 22,
                italics: true,
              }),
            ],
            spacing: { before: 480 }, // 24pt spacing before
          }),
        ],
      }],
    });
    
    return doc;
  };
  
  const createAgendaSections = (agendaItems: Array<{ title: string; subsections?: Array<{ title: string; points?: string[] }> }>) => {
    const sections = [];
    
    agendaItems.forEach((item, index) => {
      // Main heading
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${index + 1}. ${item.title}`,
              bold: true,
              size: 28,
            }),
          ],
          spacing: { after: 240 },
        })
      );
      
      // Sub-sections
      item.subsections?.forEach(subsection => {
        // Sub-heading
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: subsection.title,
                bold: true,
                size: 24, // 12pt
              }),
            ],
            spacing: { after: 120 },
          })
        );
        
        // Bullet points
        subsection.points?.forEach(point => {
          const isQuoted = point.includes('"');
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${point}`,
                  size: 22,
                  italics: isQuoted,
                }),
              ],
              indent: { left: 720 }, // Indent bullet points
              spacing: { after: 120 },
            })
          );
        });
      });
      
      // Spacing after main section
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: "", size: 22 })],
          spacing: { after: 360 },
        })
      );
    });
    
    return sections;
  };
  
  const createDecisionsSections = (decisions: Record<string, string[]>) => {
    const sections = [];
    
    Object.entries(decisions).forEach(([category, items]) => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: category,
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 120 },
        })
      );
      
      items.forEach(item => {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `• ${item}`,
                size: 22,
              }),
            ],
            indent: { left: 720 },
            spacing: { after: 120 },
          })
        );
      });
    });
    
    return sections;
  };
  
  const createActionItemsSections = (actionItems: Record<string, string[]>) => {
    const sections = [];
    
    Object.entries(actionItems).forEach(([person, actions]) => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${person}:`,
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 120 },
        })
      );
      
      actions.forEach(action => {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `• ${action}`,
                size: 22,
              }),
            ],
            indent: { left: 720 },
            spacing: { after: 120 },
          })
        );
      });
    });
    
    return sections;
  };
  
  const createDeferredItemsSections = (deferredItems: string[]) => {
    return deferredItems.map(item => 
      new Paragraph({
        children: [
          new TextRun({
            text: `• ${item}`,
            size: 22,
          }),
        ],
        indent: { left: 720 },
        spacing: { after: 120 },
      })
    );
  };
  
  const createRisksSections = (risks: Record<string, string[]>) => {
    const sections = [];
    
    Object.entries(risks).forEach(([category, items]) => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: category,
              bold: true,
              size: 24,
            }),
          ],
          spacing: { after: 120 },
        })
      );
      
      items.forEach(item => {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `• ${item}`,
                size: 22,
              }),
            ],
            indent: { left: 720 },
            spacing: { after: 120 },
          })
        );
      });
    });
    
    return sections;
  };

  // Function to process content and create appropriate Word elements
  const processContentForWord = (content: string): Paragraph[] => {
    const paragraphs = [];
    const lines = content.split('\n');

    lines.forEach(line => {
      if (line.trim()) {
        paragraphs.push(createParagraphFromLine(line));
      }
    });

    return paragraphs;
  };

  // Helper function to create paragraph from a line of text
  const createParagraphFromLine = (line: string): Paragraph => {
    // Handle markdown-style formatting
    let isHeader = false;
    let headerLevel = 0;
    let text = line;
    
    // Check for headers
    if (line.startsWith('###')) {
      isHeader = true;
      headerLevel = 3;
      text = line.replace(/^###\s*/, '');
    } else if (line.startsWith('##')) {
      isHeader = true;
      headerLevel = 2;  
      text = line.replace(/^##\s*/, '');
    } else if (line.startsWith('#')) {
      isHeader = true;
      headerLevel = 1;
      text = line.replace(/^#\s*/, '');
    }

    // Handle bullet points
    const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
    if (isBullet) {
      text = '• ' + text.replace(/^[\s\-\*]+/, '');
    }

    // Handle bold text (basic support)
    const runs = [];
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before bold
      if (match.index > lastIndex) {
        runs.push(new TextRun({
          text: text.slice(lastIndex, match.index),
          size: isHeader ? (headerLevel === 1 ? 28 : headerLevel === 2 ? 26 : 24) : 22,
          bold: isHeader,
        }));
      }
      
      // Add bold text
      runs.push(new TextRun({
        text: match[1],
        bold: true,
        size: isHeader ? (headerLevel === 1 ? 28 : headerLevel === 2 ? 26 : 24) : 22,
      }));
      
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      runs.push(new TextRun({
        text: text.slice(lastIndex),
        size: isHeader ? (headerLevel === 1 ? 28 : headerLevel === 2 ? 26 : 24) : 22,
        bold: isHeader,
      }));
    }

    // If no special formatting, create simple run
    if (runs.length === 0) {
      runs.push(new TextRun({
        text: text,
        size: isHeader ? (headerLevel === 1 ? 28 : headerLevel === 2 ? 26 : 24) : 22,
        bold: isHeader,
      }));
    }

    return new Paragraph({
      children: runs,
      indent: isBullet ? { left: 720 } : undefined,
      spacing: { 
        after: isHeader ? 240 : 120, 
      },
    });
  };
  
  const generateWordDocument = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🔍 Word Doc button clicked!');
    console.log('🔍 Meeting data:', meetingData);
    
    setIsGenerating(true);
    setStatus('Generating Word document...');

    try {
      console.log('🔍 Creating document...');
      const doc = createWordDocument();
      console.log('🔍 Document created, packing...');
      const buffer = await Packer.toBuffer(doc);
      console.log('🔍 Buffer created, size:', buffer.byteLength);
      
      // Create download
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      console.log('🔍 Blob created, size:', blob.size);
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Partnership_Meeting_Notes_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      console.log('🔍 Triggering download...');
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setStatus('Document generated successfully!');
      console.log('🔍 Word document download completed!');
      
    } catch (error) {
      console.error('❌ Error creating Word document:', error);
      setStatus('Error generating document. Please try again.');
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
          {status.includes('Error') ? '❌' : '✅'}
        </span>
      )}
    </Button>
  );
};

export default MeetingNotesWordExport;