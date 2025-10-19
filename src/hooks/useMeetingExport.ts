import { useState } from "react";
import { MeetingData, MeetingSettingsState } from "@/types/meetingTypes";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { stripMarkdown, copyPlainTextToClipboard } from '@/utils/stripMarkdown';

// Helper function to render tables in PDF
const renderTable = (
  doc: any, 
  tableData: string[][], 
  margin: number, 
  yPosition: number, 
  maxWidth: number, 
  pageHeight: number
): number => {
  if (tableData.length === 0) return yPosition;
  
  const colCount = Math.max(...tableData.map(row => row.length));
  const colWidth = maxWidth / colCount;
  const rowHeight = 8;
  let currentY = yPosition;
  
  tableData.forEach((row, rowIndex) => {
    // Check if we need a new page
    if (currentY + rowHeight > pageHeight - 30) {
      doc.addPage();
      currentY = 20;
    }
    
    // Draw row
    row.forEach((cell, colIndex) => {
      const x = margin + (colIndex * colWidth);
      
      // Draw cell border
      doc.rect(x, currentY, colWidth, rowHeight);
      
      // Draw cell text
      doc.setFontSize(10);
      doc.setFont('helvetica', rowIndex === 0 ? 'bold' : 'normal');
      
      // Wrap text if too long
      const cellText = doc.splitTextToSize(cell, colWidth - 4);
      doc.text(cellText[0] || '', x + 2, currentY + 5);
    });
    
    currentY += rowHeight;
  });
  
  return currentY + 5; // Add spacing after table
};

export const useMeetingExport = (meetingData: MeetingData | null, meetingSettings: MeetingSettingsState) => {
  const [isExporting, setIsExporting] = useState(false);

  const getMeetingDate = () => {
    if (meetingData?.startTime) {
      return new Date(meetingData.startTime).toLocaleDateString();
    }
    return new Date().toLocaleDateString();
  };

  const generateWordDocument = async (content: string, title: string = "Meeting Notes") => {
    try {
      setIsExporting(true);
      
      // Function to parse a line and convert markdown formatting to Word TextRuns
      const parseLineToTextRuns = (line: string): TextRun[] => {
        const runs: TextRun[] = [];
        let currentIndex = 0;
        
        // Regex to match **bold** and *italic* patterns
        const markdownRegex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
        let match;
        
        while ((match = markdownRegex.exec(line)) !== null) {
          // Add text before the match as normal text
          if (match.index > currentIndex) {
            const normalText = line.substring(currentIndex, match.index);
            if (normalText) {
              runs.push(new TextRun({ text: normalText, size: 22 }));
            }
          }
          
          // Add the matched text with formatting
          if (match[2]) {
            // Bold text (**text**)
            runs.push(new TextRun({ text: match[2], size: 22, bold: true }));
          } else if (match[3]) {
            // Italic text (*text*)
            runs.push(new TextRun({ text: match[3], size: 22, italics: true }));
          }
          
          currentIndex = match.index + match[0].length;
        }
        
        // Add remaining text after last match
        if (currentIndex < line.length) {
          const remainingText = line.substring(currentIndex);
          if (remainingText) {
            runs.push(new TextRun({ text: remainingText, size: 22 }));
          }
        }
        
        // If no markdown found, return the whole line as normal text
        if (runs.length === 0) {
          runs.push(new TextRun({ text: line, size: 22 }));
        }
        
        return runs;
      };
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: title,
                  bold: true,
                  size: 32,
                })
              ],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Date: ${getMeetingDate()}`,
                  size: 24,
                })
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }), // Empty line
            ...content.split('\n').map(line => 
              new Paragraph({
                children: parseLineToTextRuns(line)
              })
            )
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${getMeetingDate()}.docx`);
      toast.success('Word document generated successfully!');
    } catch (error) {
      console.error('Word generation error:', error);
      toast.error('Failed to generate Word document');
    } finally {
      setIsExporting(false);
    }
  };

  const generatePDF = (content: string, title: string = "Meeting Notes") => {
    try {
      setIsExporting(true);
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - (2 * margin);
      let yPosition = 30;
      
      // Remove transcript section from content FIRST
      let cleanContent = content.replace(/\*\*/g, ''); // Remove bold markers first
      cleanContent = cleanContent.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
      cleanContent = cleanContent.replace(/\n*Transcript:[\s\S]*$/i, '');
      cleanContent = cleanContent.replace(/\n*Full Transcript:[\s\S]*$/i, '');
      cleanContent = cleanContent.replace(/\n*##?\s*TRANSCRIPT[\s\S]*$/i, '');
      cleanContent = cleanContent.replace(/\n*##?\s*Meeting Transcript[\s\S]*$/i, '');
      
      // Title - wrap if too long
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(title, maxWidth);
      titleLines.forEach((line: string) => {
        doc.text(line, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 8;
      });
      yPosition += 7;
      
      // Date
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${getMeetingDate()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
      // Process content with proper formatting
      const lines = cleanContent.split('\n');
      let inTable = false;
      let tableData: string[][] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if we need a new page
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Empty line
        if (!line) {
          // If we were in a table, render it
          if (inTable && tableData.length > 0) {
            yPosition = renderTable(doc, tableData, margin, yPosition, maxWidth, pageHeight);
            tableData = [];
            inTable = false;
          }
          yPosition += 5;
          continue;
        }
        
        // Detect table rows (lines with |)
        if (line.includes('|')) {
          const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
          
          // Skip separator rows (like |---|---|)
          if (!cells.every(cell => /^-+$/.test(cell))) {
            inTable = true;
            tableData.push(cells);
          }
          continue;
        } else if (inTable) {
          // End of table - render it
          yPosition = renderTable(doc, tableData, margin, yPosition, maxWidth, pageHeight);
          tableData = [];
          inTable = false;
        }
        
        // Section headers (lines starting with #)
        if (line.startsWith('#')) {
          const headerText = line.replace(/^#+\s*/, '');
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          const headerLines = doc.splitTextToSize(headerText, maxWidth);
          doc.text(headerLines, margin, yPosition);
          yPosition += (headerLines.length * 7) + 5;
          continue;
        }
        
        // Bold text (lines with **)
        if (line.includes('**')) {
          const cleanLine = line.replace(/\*\*/g, '');
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          const boldLines = doc.splitTextToSize(cleanLine, maxWidth);
          doc.text(boldLines, margin, yPosition);
          yPosition += (boldLines.length * 6) + 3;
          continue;
        }
        
        // Bullet points (lines starting with - or •)
        if (line.startsWith('-') || line.startsWith('•')) {
          const bulletText = line.replace(/^[-•]\s*/, '');
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          
          // Add bullet point
          doc.text('•', margin, yPosition);
          
          // Add text with indent
          const bulletLines = doc.splitTextToSize(bulletText, maxWidth - 10);
          doc.text(bulletLines, margin + 7, yPosition);
          yPosition += (bulletLines.length * 5.5) + 2;
          continue;
        }
        
        // Numbered list items (lines starting with numbers)
        const numberMatch = line.match(/^(\d+)\.\s*/);
        if (numberMatch) {
          const number = numberMatch[1];
          const listText = line.replace(/^\d+\.\s*/, '');
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          
          // Add number
          doc.text(`${number}.`, margin, yPosition);
          
          // Add text with indent
          const listLines = doc.splitTextToSize(listText, maxWidth - 10);
          doc.text(listLines, margin + 7, yPosition);
          yPosition += (listLines.length * 5.5) + 2;
          continue;
        }
        
        // Regular text
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const textLines = doc.splitTextToSize(line, maxWidth);
        doc.text(textLines, margin, yPosition);
        yPosition += (textLines.length * 5.5) + 2;
      }
      
      // Render any remaining table
      if (inTable && tableData.length > 0) {
        renderTable(doc, tableData, margin, yPosition, maxWidth, pageHeight);
      }
      
      doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${getMeetingDate()}.pdf`);
      toast.success('PDF generated successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = async (content: string) => {
    const success = await copyPlainTextToClipboard(content);
    if (success) {
      toast.success('Content copied to clipboard!');
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  const downloadTranscript = () => {
    if (!meetingData?.transcript) {
      toast.error('No transcript available');
      return;
    }
    
    const element = document.createElement("a");
    const file = new Blob([meetingData.transcript], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `transcript-${getMeetingDate()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Transcript downloaded successfully!");
  };

  return {
    isExporting,
    generateWordDocument,
    generatePDF,
    copyToClipboard,
    downloadTranscript,
    getMeetingDate
  };
};