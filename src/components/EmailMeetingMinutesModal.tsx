import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Send, Loader2 } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateWordDocument } from "@/utils/documentGenerators";
import { format } from "date-fns";
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType, Packer } from "docx";

interface EmailMeetingMinutesModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  meetingId: string;
  meetingTitle: string;
  meetingNotes: string;
}

export function EmailMeetingMinutesModal({
  isOpen,
  onOpenChange,
  meetingId = '',
  meetingTitle = '',
  meetingNotes = ''
}: EmailMeetingMinutesModalProps) {
  const { profile } = useUserProfile();
  const [toEmail, setToEmail] = useState(profile?.email || "");
  const [subject, setSubject] = useState(meetingTitle ? `Meeting Notes - ${meetingTitle}` : 'Meeting Notes');
  const [emailBody, setEmailBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [meetingDateTime, setMeetingDateTime] = useState<string>("");

  // Helper function to round time to nearest 15 minutes
  const roundToNearest15Minutes = (date: Date): Date => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const roundedDate = new Date(date);
    roundedDate.setMinutes(roundedMinutes);
    roundedDate.setSeconds(0);
    roundedDate.setMilliseconds(0);
    return roundedDate;
  };

  // Fetch meeting data to get the start time
  useEffect(() => {
    const fetchMeetingData = async () => {
      if (!meetingId) return;
      
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select('start_time')
          .eq('id', meetingId)
          .single();
        
        if (error) throw error;
        
        if (data?.start_time) {
          const meetingDate = new Date(data.start_time);
          const roundedDate = roundToNearest15Minutes(meetingDate);
          // Use dashes instead of forward slashes to avoid HTML encoding issues
          const formattedDateTime = format(roundedDate, "dd-MM-yyyy 'at' HH:mm");
          setMeetingDateTime(formattedDateTime);
        }
      } catch (error) {
        console.error('Error fetching meeting data:', error);
      }
    };

    if (isOpen) {
      fetchMeetingData();
    }
  }, [isOpen, meetingId]);

  // Reset form when modal opens with new meeting data
  useEffect(() => {
    if (isOpen && meetingTitle) {
      const subjectLine = meetingDateTime 
        ? `${meetingTitle} - ${meetingDateTime}`
        : meetingTitle;
      setSubject(subjectLine);
      const userName = profile?.full_name || profile?.display_name || 'GP Tools User';
      setEmailBody(
        `Dear recipient,\n\nPlease find attached the meeting notes for "${meetingTitle}".\n\nKind regards,\n${userName}`
      );
    }
  }, [isOpen, meetingTitle, profile?.display_name, profile?.full_name, meetingDateTime]);

  const handleSendEmail = async () => {
    if (!toEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    if (!meetingNotes.trim()) {
      toast.error("No meeting notes available to send");
      return;
    }

    setIsSending(true);
    try {
      // Generate Word document attachment
      let wordAttachment = null;
      try {
        const blob = await generateWordDocument(meetingNotes, meetingTitle, false);
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
        });
        reader.readAsDataURL(blob);
        const base64Content = await base64Promise;
        
        wordAttachment = {
          content: base64Content,
          filename: `${meetingTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}_minutes.docx`,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
      } catch (docError) {
        console.warn('Word document generation failed:', docError);
        // Continue without attachment
      }

      // Generate transcript Word document attachment if requested
      let transcriptAttachment = null;
      if (includeTranscript) {
        try {
          // Fetch the actual transcript from the database
          const { data: transcriptData, error: transcriptError } = await supabase
            .rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });
          
          if (transcriptError) {
            console.error('Error fetching transcript:', transcriptError);
            throw transcriptError;
          }
          
          // Extract transcript text from the result
          let actualTranscript = transcriptData?.[0]?.transcript || '';
          
          if (!actualTranscript.trim()) {
            toast.error('No transcript available for this meeting');
            return;
          }
          
          // Parse and clean the transcript to extract only text (remove timestamps)
          try {
            const transcriptArray = JSON.parse(actualTranscript);
            if (Array.isArray(transcriptArray)) {
              // Extract just the text from each segment
              actualTranscript = transcriptArray
                .map((segment: any) => segment.text || '')
                .join(' ')
                .trim();
            }
          } catch (e) {
            // If it's not JSON, use as-is (already plain text)
            console.log('Transcript is plain text format');
          }
          
          // Create a formatted Word document for the transcript
          const transcriptDoc = new Document({
            sections: [
              {
                properties: {
                  page: {
                    margin: {
                      top: 1440,
                      right: 1440,
                      bottom: 1440,
                      left: 1440,
                    },
                  },
                },
                children: [
                  // Title
                  new Paragraph({
                    text: 'MEETING TRANSCRIPT',
                    heading: HeadingLevel.HEADING_1,
                    spacing: { after: 200 },
                    alignment: AlignmentType.CENTER,
                    shading: {
                      fill: '0066CC',
                      type: ShadingType.CLEAR,
                    },
                  }),
                  // Meeting title
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: meetingTitle,
                        bold: true,
                        size: 28,
                      }),
                    ],
                    spacing: { after: 200, before: 200 },
                    alignment: AlignmentType.CENTER,
                  }),
                  // Date and time
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: meetingDateTime || 'Date and time not recorded',
                        size: 22,
                        color: '666666',
                      }),
                    ],
                    spacing: { after: 400 },
                    alignment: AlignmentType.CENTER,
                  }),
                  // Divider
                  new Paragraph({
                    border: {
                      bottom: {
                        color: '0066CC',
                        space: 1,
                        style: BorderStyle.SINGLE,
                        size: 6,
                      },
                    },
                    spacing: { after: 400 },
                  }),
                  // Transcript heading
                  new Paragraph({
                    text: 'Transcript',
                    heading: HeadingLevel.HEADING_2,
                    spacing: { after: 200, before: 200 },
                  }),
                  // Transcript content - split into paragraphs for better formatting
                  ...actualTranscript.split(/\.\s+/).filter(sentence => sentence.trim()).map(sentence => 
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: sentence.trim() + '.',
                          size: 22,
                        }),
                      ],
                      spacing: { after: 100 },
                      alignment: AlignmentType.LEFT,
                    })
                  ),
                ],
              },
            ],
          });
          
          const transcriptDocBlob = await Packer.toBlob(transcriptDoc);
          const transcriptReader = new FileReader();
          const transcriptBase64Promise = new Promise<string>((resolve) => {
            transcriptReader.onloadend = () => {
              const base64 = (transcriptReader.result as string).split(',')[1];
              resolve(base64);
            };
          });
          transcriptReader.readAsDataURL(transcriptDocBlob);
          const transcriptBase64Content = await transcriptBase64Promise;
          
          // Use "Transcript_" naming convention
          const sanitizedTitle = meetingTitle.replace(/[^a-zA-Z0-9\s\-_]/g, '').replace(/\s+/g, '_');
          transcriptAttachment = {
            content: transcriptBase64Content,
            filename: `Transcript_${sanitizedTitle}.docx`,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          };
        } catch (txtError) {
          console.warn('Transcript document generation failed:', txtError);
          toast.error('Failed to generate transcript document');
        }
      }

      // Helper function to convert markdown and format to HTML
      const convertToStyledHTML = (text: string): string => {
        // FIRST: Strip ALL bold markers from the entire text before any processing
        const cleanedText = text.replace(/\*\*/g, '');
        const lines = cleanedText.split('\n');
        let html = '';
        let i = 0;
        
        while (i < lines.length) {
          const line = lines[i].trim();
          
          // Handle tables
          if (line.includes('|')) {
            let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 20px 0; font-family: Arial, sans-serif; background-color: #ffffff;">\n';
            let isFirstRow = true;
            let inTable = true;
            
            while (i < lines.length && inTable) {
              const currentLine = lines[i].trim();
              
              // Check if it's a separator line (dashes and pipes)
              if (/^[\|\-\s]+$/.test(currentLine)) {
                i++;
                continue;
              }
              
              // Check if line has pipes (table row)
              if (currentLine.includes('|')) {
                const cells = currentLine.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
                
                if (cells.length > 0) {
                  tableHTML += '  <tr>\n';
                  cells.forEach(cell => {
                    if (isFirstRow) {
                      tableHTML += `    <th style="border: 1px solid #ddd; padding: 12px; background-color: #f8f9fa; text-align: left; font-weight: bold;">${cell}</th>\n`;
                    } else {
                      tableHTML += `    <td style="border: 1px solid #ddd; padding: 12px; text-align: left;">${cell}</td>\n`;
                    }
                  });
                  tableHTML += '  </tr>\n';
                  isFirstRow = false;
                }
                i++;
              } else {
                inTable = false;
              }
            }
            
            tableHTML += '</table>\n';
            html += tableHTML;
            continue;
          }
          
          // Handle headers (lines in ALL CAPS or starting with #)
          if (line.match(/^#{1,6}\s/) || (line.length > 0 && line === line.toUpperCase() && line.length < 100)) {
            const headerText = line.replace(/^#{1,6}\s/, '');
            html += `<h2 style="color: #2c3e50; font-size: 18px; font-weight: bold; margin: 24px 0 12px 0; font-family: Arial, sans-serif;">${headerText}</h2>\n`;
            i++;
            continue;
          }
          
          // Handle bullet points
          if (line.match(/^[•\-\*]\s/)) {
            let listHTML = '<ul style="margin: 12px 0; padding-left: 20px;">\n';
            while (i < lines.length && lines[i].trim().match(/^[•\-\*]\s/)) {
              const itemText = lines[i].trim().replace(/^[•\-\*]\s/, '');
              listHTML += `  <li style="margin: 6px 0; line-height: 1.6; font-family: Arial, sans-serif; color: #2c3e50;">${itemText}</li>\n`;
              i++;
            }
            listHTML += '</ul>\n';
            html += listHTML;
            continue;
          }
          
          // Handle numbered lists
          if (line.match(/^\d+\.\s/)) {
            let listHTML = '<ol style="margin: 12px 0; padding-left: 20px;">\n';
            while (i < lines.length && lines[i].trim().match(/^\d+\.\s/)) {
              const itemText = lines[i].trim().replace(/^\d+\.\s/, '');
              listHTML += `  <li style="margin: 6px 0; line-height: 1.6; font-family: Arial, sans-serif; color: #2c3e50;">${itemText}</li>\n`;
              i++;
            }
            listHTML += '</ol>\n';
            html += listHTML;
            continue;
          }
          
          // Handle empty lines
          if (line.length === 0) {
            i++;
            continue;
          }
          
          // Handle regular paragraphs
          html += `<p style="margin: 12px 0; line-height: 1.6; font-family: Arial, sans-serif; color: #2c3e50;">${line}</p>\n`;
          i++;
        }
        
        return html;
      };

      // Format meeting notes as styled HTML
      const formattedNotes = convertToStyledHTML(meetingNotes);

      // Prepare email data for EmailJS service
      const emailData = {
        to_email: toEmail.trim(),
        subject: subject.trim(),
        message: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #ffffff;"><div style="background-color: #f8f9fa; padding: 20px; border-bottom: 3px solid #0066cc;"><p style="margin: 0; color: #2c3e50; font-size: 14px; line-height: 1.6;">${emailBody.replace(/\n/g, '<br>')}</p></div><div style="padding: 20px; background-color: #ffffff;"><div style="border-top: 2px solid #0066cc; padding-top: 20px;"><h1 style="color: #0066cc; font-size: 24px; font-weight: bold; margin: 0 0 20px 0;">MEETING NOTES</h1>${formattedNotes}</div></div></div>`,
        template_type: 'meeting_minutes',
        from_name: 'GP Tools - Meeting Minutes',
        reply_to: 'noreply@gp-tools.nhs.uk',
        word_attachment: wordAttachment,
        transcript_attachment: transcriptAttachment,
        meeting_title: meetingTitle,
        meeting_id: meetingId
      };

      // Send email via Supabase edge function
      const { data, error } = await supabase.functions.invoke('send-email-via-emailjs', {
        body: emailData
      });

      if (error) {
        console.error('Email sending error:', error);
        throw new Error(error.message || 'Failed to send email');
      }

      if (!data?.success) {
        console.error('EmailJS error:', data);
        throw new Error(data?.error || 'Failed to send email via EmailJS');
      }

      // Toast removed - user finds it distracting
      // toast.success(`Meeting minutes sent successfully to ${toEmail}`);
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || "Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border shadow-2xl" style={{ zIndex: 200 }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Meeting Notes
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="to-email">To Email</Label>
              {profile?.email && toEmail !== profile.email && (
                <button
                  type="button"
                  onClick={() => setToEmail(profile.email || "")}
                  className="text-xs text-primary hover:underline"
                >
                  Send to myself
                </button>
              )}
            </div>
            <Input
              id="to-email"
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="Enter recipient email address"
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Email message (meeting minutes will be attached below)"
              rows={6}
              className="w-full resize-none"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include-transcript"
                checked={includeTranscript}
                onChange={(e) => setIncludeTranscript(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="include-transcript" className="text-sm font-normal cursor-pointer">
                Include meeting transcript as separate attachment
              </Label>
            </div>
          </div>

          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border">
            <p className="font-medium mb-1">What will be sent:</p>
            <ul className="text-xs space-y-1">
              <li>• Word document with meeting minutes attached</li>
              <li>• Meeting minutes included in email body</li>
              {includeTranscript && <li>• Transcript as .txt file attachment</li>}
              <li>• Professional email formatting</li>
            </ul>
          </div>
        </div>
        
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={isSending || !toEmail.trim()}
            className="flex-1"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}