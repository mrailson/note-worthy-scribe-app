import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, Loader2, FileText, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { renderMinutesMarkdown } from "@/lib/minutesRenderer";
import { toast } from "sonner";
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import jsPDF from 'jspdf';

interface StandardMinutesModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
  meetingTitle: string;
}

export function StandardMinutesModal({ isOpen, onClose, meetingId, meetingTitle }: StandardMinutesModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formattedContent, setFormattedContent] = useState<string>('');
  const [rawContent, setRawContent] = useState<string>('');

  useEffect(() => {
    if (isOpen && meetingId) {
      fetchAndFormatMinutes();
    }
  }, [isOpen, meetingId]);

  const fetchAndFormatMinutes = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch from meetings table
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('notes_style_3, notes_style_2, notes_style_4, notes_style_5, overview, whisper_transcript_text, assembly_transcript_text, live_transcript_text, title')
        .eq('id', meetingId)
        .single();

      if (meetingError) throw meetingError;

      // Fetch from meeting_notes_multi
      const { data: multiNotes, error: multiError } = await supabase
        .from('meeting_notes_multi')
        .select('content, note_type')
        .eq('meeting_id', meetingId)
        .eq('note_type', 'standard')
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Priority order for content
      let content = '';
      if (meetingData?.notes_style_3) {
        content = meetingData.notes_style_3;
      } else if (multiNotes?.content) {
        content = multiNotes.content;
      } else if (meetingData?.notes_style_2) {
        content = meetingData.notes_style_2;
      } else if (meetingData?.notes_style_4) {
        content = meetingData.notes_style_4;
      } else if (meetingData?.notes_style_5) {
        content = meetingData.notes_style_5;
      } else if (meetingData?.overview) {
        content = meetingData.overview;
      } else if (meetingData?.whisper_transcript_text) {
        content = meetingData.whisper_transcript_text;
      } else if (meetingData?.assembly_transcript_text) {
        content = meetingData.assembly_transcript_text;
      } else if (meetingData?.live_transcript_text) {
        content = meetingData.live_transcript_text;
      }

      if (!content) {
        setError('No meeting notes available. Please generate notes first.');
        setLoading(false);
        return;
      }

      setRawContent(content);

      // Format the content using the existing renderer
      const formatted = renderMinutesMarkdown(content, 13);
      setFormattedContent(formatted);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching standard minutes:', err);
      setError('Failed to load meeting minutes. Please try again.');
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      // Create a temporary div to extract plain text from HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formattedContent;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      
      await navigator.clipboard.writeText(plainText);
      toast.success('Copied to clipboard');
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownloadWord = async () => {
    try {
      // Simple Word document with plain text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formattedContent;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: meetingTitle,
              heading: HeadingLevel.HEADING_1,
            }),
            ...plainText.split('\n\n').map(para => 
              new Paragraph({
                children: [new TextRun(para)],
              })
            ),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${meetingTitle.replace(/[^a-z0-9]/gi, '_')}_standard_minutes.docx`);
      toast.success('Word document downloaded');
    } catch (err) {
      console.error('Error downloading Word:', err);
      toast.error('Failed to download Word document');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const pdf = new jsPDF();
      
      // Extract plain text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = formattedContent;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';
      
      // Add title
      pdf.setFontSize(16);
      pdf.text(meetingTitle, 20, 20);
      
      // Add content with text wrapping
      pdf.setFontSize(11);
      const splitText = pdf.splitTextToSize(plainText, 170);
      pdf.text(splitText, 20, 35);
      
      pdf.save(`${meetingTitle.replace(/[^a-z0-9]/gi, '_')}_standard_minutes.pdf`);
      toast.success('PDF downloaded');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Failed to download PDF');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Standard Minutes - {meetingTitle}
          </DialogTitle>
          <DialogDescription>
            Formatted meeting minutes ready to view, copy, or download
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            <span className="ml-3 text-sm text-muted-foreground">Loading minutes...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground text-center">{error}</p>
          </div>
        )}

        {!loading && !error && formattedContent && (
          <>
            <div 
              className="border rounded-lg p-8 bg-white"
              style={{
                fontFamily: "'Fira Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#212B32'
              }}
            >
              <style>
                {`
                  .standard-minutes-content h1 {
                    color: #005EB8;
                    font-size: 24px;
                    font-weight: 600;
                    margin: 24px 0 16px 0;
                    line-height: 1.3;
                  }
                  .standard-minutes-content h2 {
                    color: #005EB8;
                    font-size: 20px;
                    font-weight: 600;
                    margin: 20px 0 12px 0;
                    line-height: 1.3;
                  }
                  .standard-minutes-content h3 {
                    color: #005EB8;
                    font-size: 16px;
                    font-weight: 600;
                    margin: 16px 0 10px 0;
                    line-height: 1.3;
                  }
                  .standard-minutes-content h4 {
                    color: #005EB8;
                    font-size: 14px;
                    font-weight: 600;
                    margin: 14px 0 8px 0;
                    line-height: 1.3;
                  }
                  .standard-minutes-content p {
                    margin: 12px 0;
                    line-height: 1.6;
                  }
                  .standard-minutes-content ul, .standard-minutes-content ol {
                    margin: 12px 0;
                    padding-left: 24px;
                  }
                  .standard-minutes-content li {
                    margin: 6px 0;
                    line-height: 1.6;
                  }
                  .standard-minutes-content strong {
                    font-weight: 600;
                    color: #212B32;
                  }
                  .standard-minutes-content table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 16px 0;
                    border: 1px solid #d1d5db;
                    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
                  }
                  .standard-minutes-content table td,
                  .standard-minutes-content table th {
                    border: 1px solid #d1d5db;
                    padding: 12px;
                    text-align: left;
                  }
                  .standard-minutes-content table th {
                    background-color: #005EB8;
                    font-weight: 600;
                    color: #ffffff;
                    text-transform: uppercase;
                    font-size: 12px;
                    letter-spacing: 0.5px;
                  }
                  .standard-minutes-content table tbody tr {
                    transition: background-color 0.2s ease;
                  }
                  .standard-minutes-content table tbody tr:nth-child(odd) {
                    background-color: #ffffff;
                  }
                  .standard-minutes-content table tbody tr:nth-child(even) {
                    background-color: #f8f9fa;
                  }
                  .standard-minutes-content table tbody tr:hover {
                    background-color: #e6f2ff;
                  }
                `}
              </style>
              <div 
                className="standard-minutes-content"
                dangerouslySetInnerHTML={{ __html: formattedContent }}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyToClipboard}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy to Clipboard
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadWord}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Word
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="ml-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
