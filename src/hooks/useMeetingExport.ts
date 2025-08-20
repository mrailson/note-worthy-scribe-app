import { useState } from "react";
import { MeetingData, MeetingSettingsState } from "@/types/meetingTypes";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from "docx";
import jsPDF from "jspdf";
import { toast } from "sonner";

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
      const margin = 20;
      const maxWidth = pageWidth - (2 * margin);
      
      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pageWidth / 2, 30, { align: 'center' });
      
      // Date
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${getMeetingDate()}`, pageWidth / 2, 45, { align: 'center' });
      
      // Content
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(content, maxWidth);
      doc.text(lines, margin, 60);
      
      doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${getMeetingDate()}.pdf`);
      toast.success('PDF generated successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('Content copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
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