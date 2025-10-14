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
  const [subject, setSubject] = useState(meetingTitle ? `Meeting Minutes - ${meetingTitle}` : 'Meeting Minutes');
  const [emailBody, setEmailBody] = useState(
    `Dear recipient,\n\nPlease find attached the meeting minutes${meetingTitle ? ` for "${meetingTitle}"` : ''}.\n\nThe minutes are also included below for your reference.\n\nKind regards,\n${profile?.display_name || 'GP Tools User'}`
  );
  const [isSending, setIsSending] = useState(false);
  const [includeTranscript, setIncludeTranscript] = useState(false);

  // Reset form when modal opens with new meeting data
  useEffect(() => {
    if (isOpen && meetingTitle) {
      setSubject(`Meeting Minutes - ${meetingTitle}`);
      setEmailBody(`Dear recipient,\n\nPlease find attached the meeting minutes for "${meetingTitle}".\n\nThe minutes are also included below for your reference.\n\nKind regards,\n${profile?.display_name || 'GP Tools User'}`);
    }
  }, [isOpen, meetingTitle, profile?.display_name]);

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

      // Generate transcript txt attachment if requested
      let transcriptAttachment = null;
      if (includeTranscript) {
        try {
          const transcriptBlob = new Blob([meetingNotes], { type: 'text/plain' });
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
          });
          reader.readAsDataURL(transcriptBlob);
          const base64Content = await base64Promise;
          
          transcriptAttachment = {
            content: base64Content,
            filename: `${meetingTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}_transcript.txt`,
            type: 'text/plain'
          };
        } catch (txtError) {
          console.warn('Transcript text file generation failed:', txtError);
        }
      }

      // Format meeting notes for better readability
      const formattedNotes = meetingNotes
        .replace(/## /g, '\n\n')
        .replace(/### /g, '\n')
        .replace(/\*\*/g, '')
        .replace(/^- /gm, '  • ')
        .replace(/^\d+\. /gm, (match) => `  ${match}`)
        .trim();

      // Prepare email data for EmailJS service
      const emailData = {
        to_email: toEmail.trim(),
        subject: subject.trim(),
        message: `${emailBody}

════════════════════════════════════════════════════════════════

MEETING MINUTES

${formattedNotes}

════════════════════════════════════════════════════════════════`,
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

      toast.success(`Meeting minutes sent successfully to ${toEmail}`);
      onOpenChange(false);
      
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(error.message || "Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange} modal={false}>
      <DialogContent className="sm:max-w-md z-[9999] border shadow-2xl" forceMount>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Meeting Minutes
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
                Include transcript as .txt attachment
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