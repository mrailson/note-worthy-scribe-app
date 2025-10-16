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
      
      const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType } = await import('docx');
      
      console.log('🔍 Creating formatted document...');
      
      // Parse markdown tables and format text
      const parseMarkdownTables = (content: string) => {
        const lines = content.split('\n');
        const result = [];
        let i = 0;
        
        while (i < lines.length) {
          const line = lines[i];
          
          // Check if this line looks like a table header
          if (line.includes('|') && line.trim().startsWith('|') && line.trim().endsWith('|')) {
            // Look ahead for separator line
            const nextLine = lines[i + 1];
            if (nextLine && nextLine.includes('|') && nextLine.includes('-')) {
              // This is a table - collect all table rows
              const tableRows = [];
              
              // Add header row
              const headerCells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
              tableRows.push(headerCells);
              
              // Skip separator line
              i += 2;
              
              // Collect data rows
              while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
                const dataCells = lines[i].split('|').map(cell => cell.trim()).filter(cell => cell);
                tableRows.push(dataCells);
                i++;
              }
              
              result.push({ type: 'table', content: tableRows });
              continue;
            }
          }
          
          // Regular text line
          result.push({ type: 'text', content: line });
          i++;
        }
        
        return result;
      };
      
      // Strip HTML and process content to preserve formatting
      const stripHtmlAndFormat = (htmlContent: string) => {
        if (!htmlContent) return [];
        
        // First, convert HTML formatting to temporary markers
        let processedText = htmlContent
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<p[^>]*>/gi, '')
          .replace(/<\/h[1-6]>/gi, '\n')
          .replace(/<h[1-6][^>]*>/gi, '\n')
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**') // Convert HTML bold to markdown
          .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**') // Convert HTML bold to markdown
          .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*') // Convert HTML italic to markdown
          .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*') // Convert HTML italic to markdown
          .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/^---+$/gm, ''); // Remove horizontal rules (--- characters)

        // Parse for tables first
        const parsedContent = parseMarkdownTables(processedText);
        const paragraphs = [];
        
        for (const item of parsedContent) {
          if (item.type === 'table') {
            // Create table
            const tableRows = item.content.map((row, rowIndex) =>
              new TableRow({
                children: row.map((cellText) => {
                  // Parse cell text for formatting
                  const cellRuns = [] as any[];
                  let currentText = cellText;

                  // Handle bold text in cells
                  const boldRegex = /(\*\*|__)(.*?)\1/g;
                  let lastIndex = 0;
                  let match: RegExpExecArray | null;

                  while ((match = boldRegex.exec(currentText)) !== null) {
                    // Add text before bold
                    if (match.index > lastIndex) {
                      const beforeText = currentText.slice(lastIndex, match.index);
                      if (beforeText) cellRuns.push(new TextRun({ text: beforeText, size: rowIndex === 0 ? 22 : 20 }));
                    }

                    // Add bold text
                    cellRuns.push(new TextRun({ text: match[2], bold: true, size: rowIndex === 0 ? 22 : 20 }));
                    lastIndex = match.index + match[0].length;
                  }

                  // Add remaining text
                  if (lastIndex < currentText.length) {
                    const remainingText = currentText.slice(lastIndex);
                    if (remainingText) cellRuns.push(new TextRun({ text: remainingText, size: rowIndex === 0 ? 22 : 20 }));
                  }

                  if (cellRuns.length === 0) {
                    cellRuns.push(new TextRun({ text: cellText, size: rowIndex === 0 ? 22 : 20, bold: rowIndex === 0 }));
                  }

                  // Do not force equal-width cells; let the table's columnWidths control sizing
                  return new TableCell({
                    children: [new Paragraph({ children: cellRuns })],
                  });
                }),
              })
            );
            
            // Compute responsive column widths based on content length to avoid squashed columns on mobile Word (iPhone)
            const rowsArr = item.content as string[][];
            const colCount = Math.max(...rowsArr.map((r) => r.length));
            const weights = new Array(colCount).fill(1);
            rowsArr.forEach((r) =>
              r.forEach((cell, i) => {
                const len = Math.min(cell.replace(/\*\*|__/g, '').length, 80);
                if (len > weights[i]) weights[i] = len;
              })
            );
            const totalWidth = 9360; // approx text width (twips) for US Letter with 1" margins
            const totalWeight = weights.reduce((a, b) => a + b, 0) || colCount;
            const colWidths = weights.map((w) => Math.max(1, Math.floor((w / totalWeight) * totalWidth)));
            // Normalise rounding differences
            const sum = colWidths.reduce((a, b) => a + b, 0);
            if (sum !== totalWidth && colWidths.length > 0) {
              colWidths[colWidths.length - 1] += totalWidth - sum;
            }

            paragraphs.push(
              new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
                columnWidths: colWidths,
              })
            );
            
            // Add space after table
            paragraphs.push(new Paragraph({
              children: [new TextRun({ text: "", size: 22 })],
              spacing: { after: 120 }
            }));
          } else {
            // Process regular text
            const trimmedLine = item.content.trim();
            if (!trimmedLine) {
              // Add minimal spacing for empty lines
              paragraphs.push(new Paragraph({
                children: [new TextRun({ text: "", size: 22 })],
                spacing: { after: 60 }
              }));
              continue;
            }
            
            // Check for bold markers
            const boldMatch = trimmedLine.match(/^\*\*(.*?)\*\*$/);
            if (boldMatch) {
              // Bold text without ** markers
              paragraphs.push(new Paragraph({
                children: [new TextRun({
                  text: boldMatch[1],
                  bold: true,
                  size: 24,
                  color: "1f2937"
                })],
                spacing: { after: 80 }
              }));
              continue;
            }
            
            // Check for section headers and clean hashtags
            const isHeader = /^[#*]{1,4}\s/.test(trimmedLine) || 
                            /^[A-Z\s]{8,}$/.test(trimmedLine) ||
                            trimmedLine.includes('ATTENDEES') ||
                            trimmedLine.includes('OVERVIEW') ||
                            trimmedLine.includes('CONTENT') ||
                            trimmedLine.includes('DECISIONS') ||
                            trimmedLine.includes('ACTION') ||
                            trimmedLine.includes('RISKS') ||
                            trimmedLine.includes('MEETING OVERVIEW') ||
                            trimmedLine.includes('DETAILED MEETING');
            
            // Clean hashtags from headers
            let cleanedLine = trimmedLine;
            if (isHeader && /^[#]{1,4}\s/.test(trimmedLine)) {
              cleanedLine = trimmedLine.replace(/^[#]{1,4}\s*/, '');
            }
            
            // Handle inline bold markers within text
            const parts = [];
            let lastIndex = 0;
            
            // Find all **text** patterns (including single * patterns)
            const boldRegex = /\*{1,2}([^*]+?)\*{1,2}/g;
            let match;
            
            while ((match = boldRegex.exec(cleanedLine)) !== null) {
              // Add normal text before the bold part
              if (match.index > lastIndex) {
                const normalText = cleanedLine.substring(lastIndex, match.index);
                if (normalText) {
                  parts.push(new TextRun({
                    text: normalText,
                    size: 22,
                    color: "374151"
                  }));
                }
              }
              
              // Add bold text
              parts.push(new TextRun({
                text: match[1],
                bold: true,
                size: 22,
                color: "1f2937"
              }));
              
              lastIndex = match.index + match[0].length;
            }
            
            // Add remaining normal text
            if (lastIndex < cleanedLine.length) {
              const remainingText = cleanedLine.substring(lastIndex);
              if (remainingText) {
                parts.push(new TextRun({
                  text: remainingText,
                  size: 22,
                  color: "374151"
                }));
              }
            }
            
            // If no bold parts found, use the whole cleaned line
            if (parts.length === 0) {
              parts.push(new TextRun({
                text: cleanedLine,
                size: isHeader ? 24 : 22,
                bold: isHeader,
                color: isHeader ? "1f2937" : "374151"
              }));
            }
            
            // Check for bullet points
            const isBullet = cleanedLine.startsWith('-') || cleanedLine.startsWith('•');
            
            paragraphs.push(new Paragraph({
              children: parts,
              spacing: { 
                after: isHeader ? 120 : (isBullet ? 40 : 60),
                before: isHeader ? 160 : 0
              },
              indent: isBullet ? { left: 360 } : undefined
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
              ...stripHtmlAndFormat(meetingData.overview)
            ] : []),
            
            // Content Section
            ...(meetingData.content ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "DETAILED MEETING CONTENT",
                    bold: true,
                    size: 28,
                    color: "1f2937"
                  }),
                ],
                spacing: { before: 240, after: 120 }
              }),
              ...stripHtmlAndFormat(meetingData.content)
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
      
      console.log('🔍 Document created, converting to blob (browser-compatible)...');
      
      // Use toBlob instead of toBuffer for browser compatibility
      const blob = await Packer.toBlob(doc);
      console.log('🔍 Blob created successfully, size:', blob.size, 'bytes');
      
      // Create download directly with the blob
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Meeting_Notes_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      console.log('🔍 Triggering download...');
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
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