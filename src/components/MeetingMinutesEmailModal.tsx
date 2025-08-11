import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, X, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MeetingMinutesEmailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultToEmail: string;
  defaultSubject: string;
  defaultBody: string;
  meetingTitle?: string;
  meetingDate?: string;
  duration?: string;
  includeTranscript?: boolean;
  transcript?: string;
  practiceName?: string;
}

export const MeetingMinutesEmailModal: React.FC<MeetingMinutesEmailModalProps> = ({
  isOpen,
  onOpenChange,
  defaultToEmail,
  defaultSubject,
  defaultBody,
  meetingTitle = "Meeting",
  meetingDate = new Date().toLocaleString(),
  duration,
  includeTranscript = false,
  transcript,
  practiceName,
}) => {
  const [toEmail, setToEmail] = useState(defaultToEmail || "");
  const [ccRaw, setCcRaw] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);

  const ccList = useMemo(() =>
    ccRaw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  [ccRaw]);

  const handleSend = async () => {
    if (!toEmail) {
      toast.error("Recipient email is required");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-meeting-summary", {
        body: {
          userEmail: toEmail,
          attendeeEmails: ccList,
          meetingTitle,
          meetingDate,
          duration: duration ?? "",
          summary: body,
          includeTranscript,
          transcript: includeTranscript ? transcript ?? "" : undefined,
          practiceName,
        },
      });

      if (error) throw error;

      toast.success("Meeting summary email sent");
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to send meeting summary:", err);
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email AI-Generated Meeting Minutes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc">CC (comma separated)</Label>
              <Input
                id="cc"
                value={ccRaw}
                onChange={(e) => setCcRaw(e.target.value)}
                placeholder="colleague@nhs.net, manager@nhs.net"
              />
              {ccList.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {ccList.map((email) => (
                    <Badge key={email} variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {email}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[240px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This includes the AI-generated meeting summary. You can edit before sending.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || !toEmail}>
              {sending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
