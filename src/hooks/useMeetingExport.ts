import { useState } from "react";
import { MeetingData, MeetingSettingsState } from "@/types/meetingTypes";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { stripMarkdown, copyPlainTextToClipboard } from '@/utils/stripMarkdown';

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
                children: [new TextRun({ text: line, size: 22 })]
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
      
      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
      // Date
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${getMeetingDate()}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
      // Process content with proper formatting
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if we need a new page
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Empty line
        if (!line) {
          yPosition += 5;
          continue;
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