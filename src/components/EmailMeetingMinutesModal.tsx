import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Send, Loader2 } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateWordDocument } from "@/utils/documentGenerators";
import { format } from "date-fns";
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType, Packer } from "docx";

interface MeetingAttendee {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  organization: string | null;
  organization_type: string | null;
}

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
  const [meetingAttendees, setMeetingAttendees] = useState<MeetingAttendee[]>([]);
  const [selectedAttendeeEmails, setSelectedAttendeeEmails] = useState<string[]>([]);
  const [meetingDateTime, setMeetingDateTime] = useState<string>("");
  const [meetingDate, setMeetingDate] = useState<string>("");

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

  // Helper function to add ordinal suffix to day
  const getOrdinalSuffix = (day: number): string => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Helper function to format date nicely
  const formatNiceDate = (date: Date): string => {
    const day = date.getDate();
    const ordinal = getOrdinalSuffix(day);
    return format(date, `d'${ordinal}' MMMM yyyy`);
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
          const niceDate = formatNiceDate(roundedDate);
          setMeetingDate(niceDate);
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
      const subjectLine = meetingDate 
        ? `Meeting Minutes - ${meetingTitle} - ${meetingDate}`
        : `Meeting Minutes - ${meetingTitle}`;
      setSubject(subjectLine);
      const userName = profile?.full_name || profile?.display_name || 'GP Tools User';
      
      // Find recipient name from attendees list or use email prefix as fallback
      let recipientName = 'recipient';
      if (toEmail) {
        const attendee = meetingAttendees.find(a => a.email?.toLowerCase() === toEmail.toLowerCase());
        recipientName = attendee?.name || toEmail.split('@')[0];
      }
      
      setEmailBody(
        `Dear ${recipientName},\n\nPlease find attached the meeting notes for "${meetingTitle}".\n\nKind regards,\n${userName}`
      );
    }
  }, [isOpen, meetingTitle, profile?.display_name, profile?.full_name, meetingDate, toEmail, meetingAttendees]);

  // Ensure user's email auto-fills when available
  useEffect(() => {
    if (isOpen && profile?.email && (!toEmail || toEmail.trim() === "")) {
      setToEmail(profile.email);
    }
  }, [isOpen, profile?.email]);

  // Fetch meeting attendees
  useEffect(() => {
    const fetchAttendees = async () => {
      if (!isOpen || !meetingId) return;

      try {
        const { data: meetingAttendeesData, error } = await supabase
          .from('meeting_attendees')
          .select(`
            attendee_id,
            attendees:attendee_id (
              id,
              name,
              email,
              role,
              organization,
              organization_type
            )
          `)
          .eq('meeting_id', meetingId);

        if (error) {
          console.error('Error fetching meeting attendees:', error);
          return;
        }

        if (meetingAttendeesData) {
          const attendeesWithEmail = meetingAttendeesData
            .filter((ma: any) => ma.attendees && ma.attendees.email)
            // Filter out the user's own email
            .filter((ma: any) => ma.attendees.email !== profile?.email)
            .map((ma: any) => ({
              id: ma.attendees.id,
              name: ma.attendees.name,
              email: ma.attendees.email,
              role: ma.attendees.role,
              organization: ma.attendees.organization,
              organization_type: ma.attendees.organization_type,
            }));

          setMeetingAttendees(attendeesWithEmail);
        }
      } catch (error) {
        console.error('Error fetching attendees:', error);
      }
    };

    fetchAttendees();
  }, [isOpen, meetingId, profile?.email]);

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

      // Helper function to convert markdown and format to HTML with proper structure
      const convertToStyledHTML = (text: string): string => {
        // Strip bold markers
        let cleanedText = text.replace(/\*\*/g, '');
        
        // Remove transcript sections
        const transcriptIndex = cleanedText.indexOf('MEETING TRANSCRIPT FOR REFERENCE:');
        if (transcriptIndex !== -1) {
          cleanedText = cleanedText.substring(0, transcriptIndex).trim();
        }
        cleanedText = cleanedText.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
        cleanedText = cleanedText.replace(/\n*Transcript:[\s\S]*$/i, '');
        cleanedText = cleanedText.replace(/\n*Full Transcript:[\s\S]*$/i, '');
        
        const lines = cleanedText.split('\n');
        let html = '';
        let i = 0;
        
        while (i < lines.length) {
          const line = lines[i].trim();
          
          // Handle tables
          if (line.includes('|')) {
            let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 16px 0; font-family: Arial, sans-serif;">\n';
            let isFirstRow = true;
            let inTable = true;
            
            while (i < lines.length && inTable) {
              const currentLine = lines[i].trim();
              
              if (/^[\|\-\s]+$/.test(currentLine)) {
                i++;
                continue;
              }
              
              if (currentLine.includes('|')) {
                const cells = currentLine.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
                
                if (cells.length > 0) {
                  tableHTML += '  <tr>\n';
                  cells.forEach(cell => {
                    if (isFirstRow) {
                      tableHTML += `    <th style="border: 1px solid #ddd; padding: 10px; background-color: #f5f5f5; text-align: left; font-weight: 600;">${cell}</th>\n`;
                    } else {
                      tableHTML += `    <td style="border: 1px solid #ddd; padding: 10px; text-align: left;">${cell}</td>\n`;
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
          
          // Handle section headers (ALL CAPS lines)
          if (line.length > 0 && line === line.toUpperCase() && line.length < 100 && !line.match(/^\d/)) {
            html += `<h2 style="color: #1a1a1a; font-size: 14px; font-weight: 700; margin: 20px 0 8px 0; font-family: Arial, sans-serif; text-transform: uppercase;">${line}</h2>\n`;
            i++;
            continue;
          }
          
          // Handle bullet points
          if (line.match(/^[•\-\*]\s/)) {
            let listHTML = '<ul style="margin: 8px 0 8px 20px; padding: 0;">\n';
            while (i < lines.length && lines[i].trim().match(/^[•\-\*]\s/)) {
              const itemText = lines[i].trim().replace(/^[•\-\*]\s/, '');
              listHTML += `  <li style="margin: 4px 0; line-height: 1.5; font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px;">${itemText}</li>\n`;
              i++;
            }
            listHTML += '</ul>\n';
            html += listHTML;
            continue;
          }
          
          // Handle numbered lists - but treat each numbered item as a standalone heading with bold text
          // This prevents non-sequential numbering issues when numbers restart
          if (line.match(/^\d+\.\s/)) {
            const itemText = line.replace(/^\d+\.\s*/, '');
            const numberMatch = line.match(/^(\d+)\.\s/);
            const number = numberMatch ? numberMatch[1] : '';
            html += `<p style="margin: 16px 0 8px 0; line-height: 1.5; font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px;"><strong>${number}. ${itemText}</strong></p>\n`;
            i++;
            continue;
          }
          
          // Handle empty lines
          if (line.length === 0) {
            i++;
            continue;
          }
          
          // Handle regular paragraphs
          html += `<p style="margin: 8px 0; line-height: 1.5; font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px;">${line}</p>\n`;
          i++;
        }
        
        return html;
      };

      // Format meeting notes as styled HTML
      const formattedNotes = convertToStyledHTML(meetingNotes);

      // Prepare email data for EmailJS service
      // Combine all recipient emails
      const allRecipients = [
        toEmail.trim(),
        ...selectedAttendeeEmails
      ].filter(email => email); // Remove empty strings

      // Remove duplicates
      const uniqueRecipients = Array.from(new Set(allRecipients));

      if (uniqueRecipients.length === 0) {
        toast.error("Please add at least one email recipient.");
        return;
      }

      // Build meeting details section
      const meetingDetailsHTML = `
        <h2 style="color: #1a1a1a; font-size: 14px; font-weight: 700; margin: 20px 0 8px 0; font-family: Arial, sans-serif; text-transform: uppercase;">MEETING DETAILS</h2>
        <p style="margin: 4px 0; line-height: 1.5; font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px;"><strong>Meeting Title:</strong> ${meetingTitle}</p>
        ${meetingDate ? `<p style="margin: 4px 0; line-height: 1.5; font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px;"><strong>Date:</strong> ${meetingDate}</p>` : ''}
        ${meetingDateTime ? `<p style="margin: 4px 0; line-height: 1.5; font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px;"><strong>Time:</strong> ${meetingDateTime.split(' at ')[1]}</p>` : ''}
      `;

      const emailData = {
        to_email: uniqueRecipients.join(', '),
        subject: subject.trim(),
        message: `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #ffffff; padding: 20px;"><div style="margin-bottom: 20px;"><p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 14px; line-height: 1.5;">${emailBody.replace(/\n/g, '<br>')}</p></div><div style="border-top: 3px solid #0066cc; padding-top: 20px;"><h1 style="color: #0066cc; font-size: 18px; font-weight: bold; margin: 0 0 16px 0; font-family: Arial, sans-serif;">MEETING NOTES</h1>${meetingDetailsHTML}<div style="margin-top: 16px;">${formattedNotes}</div></div></div>`,
        template_type: 'meeting_minutes',
        from_name: 'GP Tools - Meeting Minutes',
        reply_to: 'noreply@gp-tools.nhs.uk',
        word_attachment: wordAttachment,
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
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto border shadow-2xl" style={{ zIndex: 200 }}>
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

          {meetingAttendees.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Add Meeting Participants ({selectedAttendeeEmails.length} of {meetingAttendees.length} selected)</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allEmails = meetingAttendees
                        .filter(a => a.email)
                        .map(a => a.email as string);
                      setSelectedAttendeeEmails(allEmails);
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedAttendeeEmails([])}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-muted/20">
                {meetingAttendees.map((attendee) => (
                  <div key={attendee.id} className="flex items-start gap-3 p-2 hover:bg-accent rounded-md transition-colors">
                    <Checkbox
                      id={`attendee-${attendee.id}`}
                      checked={selectedAttendeeEmails.includes(attendee.email as string)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedAttendeeEmails([...selectedAttendeeEmails, attendee.email as string]);
                        } else {
                          setSelectedAttendeeEmails(selectedAttendeeEmails.filter(e => e !== attendee.email));
                        }
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <Label 
                        htmlFor={`attendee-${attendee.id}`}
                        className="text-sm font-medium cursor-pointer block"
                      >
                        {attendee.name}
                      </Label>
                      <p className="text-xs text-muted-foreground truncate">{attendee.email}</p>
                      {(attendee.role || attendee.organization) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {attendee.role && <span>{attendee.role}</span>}
                          {attendee.role && attendee.organization && <span> • </span>}
                          {attendee.organization && <span>{attendee.organization}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
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
              placeholder="Email message (meeting notes will be attached below)"
              rows={10}
              className="w-full resize-none"
            />
          </div>
          
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border">
            <p className="font-medium mb-1">What will be sent:</p>
            <ul className="text-xs space-y-1">
              <li>• Word document with the meeting notes</li>
              <li>• Meeting notes included in email body</li>
              {(toEmail.trim() || selectedAttendeeEmails.length > 0) && (
                <li className="font-medium mt-2 pt-2 border-t">
                  Recipients: {[toEmail.trim(), ...selectedAttendeeEmails].filter(Boolean).length} email{[toEmail.trim(), ...selectedAttendeeEmails].filter(Boolean).length !== 1 ? 's' : ''}
                </li>
              )}
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