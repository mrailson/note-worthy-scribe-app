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
import { format } from "date-fns";

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
  const [freshNotes, setFreshNotes] = useState<string>("");

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
      
      // Skip database query for test meeting IDs
      if (meetingId.startsWith('test-meeting-id-')) {
        const now = new Date();
        const roundedDate = roundToNearest15Minutes(now);
        const formattedDateTime = format(roundedDate, "dd-MM-yyyy 'at' HH:mm");
        setMeetingDateTime(formattedDateTime);
        const niceDate = formatNiceDate(roundedDate);
        setMeetingDate(niceDate);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select('start_time')
          .eq('id', meetingId)
          .maybeSingle();
        
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
      
      // Find recipient name - try multiple sources
      const getRecipientName = async () => {
        let recipientName = 'recipient';
        
        if (toEmail) {
          // First, check if they're in the meeting attendees list
          const attendee = meetingAttendees.find(a => a.email?.toLowerCase() === toEmail.toLowerCase());
          if (attendee?.name) {
            recipientName = attendee.name;
          } else {
            // Second, try to get their name from the profiles table
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('email', toEmail.toLowerCase())
                .maybeSingle();
              
              if (profileData?.full_name) {
                recipientName = profileData.full_name;
              } else {
                // Fall back to formatting the email username (e.g., "malcolm.railson" -> "Malcolm Railson")
                const emailUsername = toEmail.split('@')[0];
                recipientName = emailUsername
                  .split(/[._-]/)
                  .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                  .join(' ');
              }
            } catch (error) {
              console.error('Error fetching recipient profile:', error);
              // Fall back to formatting the email username
              const emailUsername = toEmail.split('@')[0];
              recipientName = emailUsername
                .split(/[._-]/)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join(' ');
            }
          }
        }
        
        setEmailBody(
          `Dear ${recipientName},\n\nPlease find attached the meeting notes for "${meetingTitle}".\n\nKind regards,\n${userName}`
        );
      };
      
      getRecipientName();
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

      // Skip database query for test meeting IDs
      if (meetingId.startsWith('test-meeting-id-')) {
        setMeetingAttendees([]);
        return;
      }

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

  // Fetch fresh notes from database when modal opens to ensure we have the latest tone-audited version
  useEffect(() => {
    const fetchFreshNotes = async () => {
      if (!isOpen || !meetingId) return;
      
      // Skip database query for test meeting IDs
      if (meetingId.startsWith('test-meeting-id-')) {
        setFreshNotes(meetingNotes);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meetingId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching fresh notes:', error);
          setFreshNotes(meetingNotes); // Fall back to prop
          return;
        }
        
        if (data?.summary) {
          console.log('📝 Using fresh notes from database');
          setFreshNotes(data.summary);
        } else {
          setFreshNotes(meetingNotes); // Fall back to prop
        }
      } catch (error) {
        console.error('Error fetching fresh notes:', error);
        setFreshNotes(meetingNotes); // Fall back to prop
      }
    };

    fetchFreshNotes();
  }, [isOpen, meetingId, meetingNotes]);

  const handleSendEmail = async () => {
    // Use fresh notes from database, fall back to prop
    const notesToSend = freshNotes || meetingNotes;
    
    if (!toEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    if (!notesToSend.trim()) {
      toast.error("No meeting notes available to send");
      return;
    }

    setIsSending(true);
    try {
      // Fetch meeting details and action items for the professional Word document
      let meetingLocation: string | undefined;
      let meetingTime: string | undefined;
      let attendeeNames: string | undefined;
      let actionItems: any[] = [];
      
      try {
        // Fetch meeting details
        const { data: meetingData } = await supabase
          .from('meetings')
          .select('start_time, meeting_location')
          .eq('id', meetingId)
          .maybeSingle();
        
        if (meetingData) {
          meetingLocation = meetingData.meeting_location || undefined;
          if (meetingData.start_time) {
            const startTime = new Date(meetingData.start_time);
            meetingTime = startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT';
          }
        }
        
        // Fetch action items
        const { data: actionItemsData } = await supabase
          .from('meeting_action_items')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('sort_order', { ascending: true });
        
        if (actionItemsData) {
          actionItems = actionItemsData;
        }
        
        // Get attendee names from already fetched meetingAttendees
        if (meetingAttendees.length > 0) {
          attendeeNames = meetingAttendees.map(a => a.name).join(', ');
        }
      } catch (fetchError) {
        console.warn('Error fetching meeting details for Word doc:', fetchError);
      }
      
      // Generate professional Word document attachment (same format as SafeModeNotesModal download)
      let wordAttachment = null;
      try {
        const { generateProfessionalWordBlob } = await import('@/utils/generateProfessionalMeetingDocx');
        
        // Clean the title
        const cleanTitle = meetingTitle.replace(/^\*+\s*/, '').replace(/\*\*/g, '').trim();
        
        // Build parsed details with fetched data
        const parsedDetails = {
          title: cleanTitle,
          date: meetingDate || undefined,
          time: meetingTime,
          location: meetingLocation,
          attendees: attendeeNames,
        };
        
        // Convert action items to expected format
        const parsedActionItems = actionItems.map((item: any) => ({
          action: item.action_text,
          owner: item.assignee_name || 'Unassigned',
          deadline: item.due_date || undefined,
          priority: item.priority || 'medium',
          status: item.status || 'Open',
          isCompleted: item.status === 'completed',
        }));
        
        // Generate the professional Word blob
        const blob = await generateProfessionalWordBlob(notesToSend, cleanTitle, parsedDetails, parsedActionItems);
        
        // Convert blob to base64
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

      // Strip duplicate meeting details blocks from notes
      const stripDuplicateBlocks = (text: string): string => {
        if (!text) return text;
        
        let cleaned = text;
        
        // Remove standalone "MEETING NOTES" headings (with/without markdown)
        cleaned = cleaned.replace(/^#*\s*MEETING\s*NOTES\s*$/gim, '');
        
        // Remove standalone "MEETING DETAILS" headings (with/without markdown)
        cleaned = cleaned.replace(/^#{0,2}\s*MEETING\s*DETAILS\s*$/gim, '');
        
        // Remove "Meeting Title:" lines (with optional bullets and markdown bold)
        cleaned = cleaned.replace(/^[\s•\-\*]*\*?\*?Meeting\s*Title:\*?\*?.*$/gim, '');
        
        // Remove "Date:" lines
        cleaned = cleaned.replace(/^[\s•\-\*]*\*?\*?Date:\*?\*?.*$/gim, '');
        
        // Remove "Time:" lines
        cleaned = cleaned.replace(/^[\s•\-\*]*\*?\*?Time:\*?\*?.*$/gim, '');
        
        // Remove "Location:" lines
        cleaned = cleaned.replace(/^[\s•\-\*]*\*?\*?Location:\*?\*?.*$/gim, '');
        
        // Clean up excessive blank lines
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
        
        return cleaned;
      };

      // Helper function to convert markdown and format to HTML with proper structure
      const convertToStyledHTML = (text: string): string => {
        // First strip duplicate blocks
        const cleanedText = stripDuplicateBlocks(text);
        // Strip bold markers
        let processedText = cleanedText.replace(/\*\*/g, '');
        
        // Remove transcript sections
        const transcriptIndex = processedText.indexOf('MEETING TRANSCRIPT FOR REFERENCE:');
        if (transcriptIndex !== -1) {
          processedText = processedText.substring(0, transcriptIndex).trim();
        }
        processedText = processedText.replace(/\n*MEETING TRANSCRIPT FOR REFERENCE:[\s\S]*$/i, '');
        processedText = processedText.replace(/\n*Transcript:[\s\S]*$/i, '');
        processedText = processedText.replace(/\n*Full Transcript:[\s\S]*$/i, '');
        
        const lines = processedText.split('\n');
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
          
          // Handle markdown headers (# ## ###) - strip the hash characters
          if (line.match(/^#{1,6}\s/)) {
            const headerText = line.replace(/^#{1,6}\s*/, '').trim();
            html += `<h2 style="color: #2563EB; font-size: 14px; font-weight: 700; margin: 20px 0 8px 0; font-family: Arial, sans-serif; text-transform: uppercase;">${headerText}</h2>\n`;
            i++;
            continue;
          }
          
          // Handle section headers (ALL CAPS lines)
          if (line.length > 0 && line === line.toUpperCase() && line.length < 100 && !line.match(/^\d/)) {
            html += `<h2 style="color: #2563EB; font-size: 14px; font-weight: 700; margin: 20px 0 8px 0; font-family: Arial, sans-serif; text-transform: uppercase;">${line}</h2>\n`;
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
          
          // Handle numbered lists - only the numbered heading should be bold and blue
          // Body text that follows should remain regular weight and black
          if (line.match(/^\d+\.\s/)) {
            // Extract just the heading part (before the first colon if present)
            const fullText = line.replace(/^\d+\.\s*/, '');
            const numberMatch = line.match(/^(\d+)\.\s/);
            const number = numberMatch ? numberMatch[1] : '';
            
            // If there's a colon, split heading from body text
            const colonIndex = fullText.indexOf(':');
            if (colonIndex !== -1) {
              const heading = fullText.substring(0, colonIndex + 1);
              const bodyText = fullText.substring(colonIndex + 1).trim();
              
              // Heading in blue and bold, body text in regular black
              html += `<p style="margin: 16px 0 8px 0; line-height: 1.5; font-family: Arial, sans-serif; font-size: 14px;">`;
              html += `<strong style="color: #2563EB;">${number}. ${heading}</strong>`;
              if (bodyText) {
                html += ` <span style="color: #1a1a1a; font-weight: normal;">${bodyText}</span>`;
              }
              html += `</p>\n`;
            } else {
              // No colon, entire line is heading
              html += `<p style="margin: 16px 0 8px 0; line-height: 1.5; font-family: Arial, sans-serif; font-size: 14px;"><strong style="color: #2563EB;">${number}. ${fullText}</strong></p>\n`;
            }
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

      // Format meeting notes as styled HTML - use fresh notes
      const formattedNotes = convertToStyledHTML(notesToSend);

      // Check for audio overview and prepare attachment if available
      let audioAttachment = null;
      if (meetingId) {
        try {
          const { data: audioData } = await supabase
            .from('meeting_overviews')
            .select('audio_overview_url')
            .eq('meeting_id', meetingId)
            .maybeSingle();
          
          if (audioData?.audio_overview_url) {
            console.log('🔊 Found audio overview, fetching for attachment...');
            const audioResponse = await fetch(audioData.audio_overview_url);
            if (audioResponse.ok) {
              const audioBlob = await audioResponse.blob();
              const audioReader = new FileReader();
              const audioBase64Promise = new Promise<string>((resolve) => {
                audioReader.onloadend = () => {
                  const base64 = (audioReader.result as string).split(',')[1];
                  resolve(base64);
                };
              });
              audioReader.readAsDataURL(audioBlob);
              const audioBase64 = await audioBase64Promise;
              
              const safeAudioFilename = meetingTitle
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .replace(/\s+/g, '_')
                .substring(0, 50);
              
              audioAttachment = {
                content: audioBase64,
                filename: `${safeAudioFilename}_Audio_Overview.mp3`,
                type: 'audio/mpeg'
              };
              console.log('✅ Audio attachment prepared');
            }
          }
        } catch (audioError) {
          console.warn('Audio attachment fetch failed:', audioError);
        }
      }

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

      // Primary recipient is the first one, rest are CC
      const primaryRecipient = uniqueRecipients[0];
      const ccRecipients = uniqueRecipients.slice(1);

      const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #ffffff; padding: 20px;"><div style="margin-bottom: 20px;"><p style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 14px; line-height: 1.5;">${emailBody.replace(/\n/g, '<br>')}</p></div><hr style="border: none; border-top: 3px solid #0066cc; margin: 20px 0;" /><div style="margin-top: 20px;">${formattedNotes}</div></div>`;

      const emailData = {
        to_email: primaryRecipient,
        cc_emails: ccRecipients,
        subject: subject.trim(),
        html_content: htmlContent,
        from_name: 'Notewell AI - Meeting Notes',
        word_attachment: wordAttachment,
        audio_attachment: audioAttachment
      };

      // Send email via Resend edge function
      const { data, error } = await supabase.functions.invoke('send-meeting-email-resend', {
        body: emailData
      });

      if (error) {
        console.error('Email sending error:', error);
        throw new Error(error.message || 'Failed to send email');
      }

      if (!data?.success) {
        console.error('Resend error:', data);
        throw new Error(data?.error || 'Failed to send email');
      }

      // Toast removed - user finds it distracting
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