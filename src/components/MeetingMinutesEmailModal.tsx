import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, X, Users, List, ChevronDown } from "lucide-react";
import { showToast } from "@/utils/toastWrapper";
import { supabase } from "@/integrations/supabase/client";
import { useDistributionLists } from "@/hooks/useDistributionLists";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  meetingId?: string;
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
  meetingId,
}) => {
  const [toEmail, setToEmail] = useState("");
  const [ccRaw, setCcRaw] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [freshNotes, setFreshNotes] = useState<string>("");
  
  const { distributionLists, getEmailsFromList } = useDistributionLists();

  const handleSelectDistributionList = async (listId: string, listName: string) => {
    const emails = getEmailsFromList(listId);
    if (emails.length === 0) {
      showToast.error("No members with email addresses in this distribution list", { section: 'meeting_manager' });
      return;
    }
    
    // Add emails to CC field, avoiding duplicates
    const existingEmails = ccRaw.split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const newEmails = emails.filter(e => !existingEmails.includes(e.toLowerCase()) && e.toLowerCase() !== toEmail.toLowerCase());
    
    if (newEmails.length === 0) {
      showToast.info("All members from this list are already added", { section: 'meeting_manager' });
      return;
    }
    
    const updatedCc = ccRaw ? `${ccRaw}, ${newEmails.join(', ')}` : newEmails.join(', ');
    setCcRaw(updatedCc);
    showToast.success(`Added ${newEmails.length} recipients from "${listName}"`, { section: 'meeting_manager' });
  };

  // Fetch fresh notes from database when modal opens to ensure we have the latest tone-audited version
  React.useEffect(() => {
    const fetchFreshNotes = async () => {
      if (!isOpen || !meetingId) return;
      
      try {
        const { data, error } = await supabase
          .from('meeting_summaries')
          .select('summary')
          .eq('meeting_id', meetingId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching fresh notes:', error);
          setFreshNotes(defaultBody);
          return;
        }
        
        if (data?.summary) {
          console.log('📝 MeetingMinutesEmailModal: Using fresh notes from database');
          setFreshNotes(data.summary);
        } else {
          setFreshNotes(defaultBody);
        }
      } catch (error) {
        console.error('Error fetching fresh notes:', error);
        setFreshNotes(defaultBody);
      }
    };

    fetchFreshNotes();
  }, [isOpen, meetingId, defaultBody]);

  // Initialize state when modal opens or defaults change - use fresh notes if available
  React.useEffect(() => {
    if (isOpen) {
      setToEmail(defaultToEmail || "");
      setSubject(defaultSubject || `${meetingTitle}, ${meetingDate} - Minutes`);
      // Use fresh notes from database if available, otherwise fall back to prop
      setBody(freshNotes || defaultBody);
    }
  }, [isOpen, defaultToEmail, defaultSubject, freshNotes, defaultBody, meetingTitle, meetingDate]);

  const ccList = useMemo(() =>
    ccRaw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((email) => email.toLowerCase() !== toEmail.toLowerCase()),
  [ccRaw, toEmail]);

  const handleSend = async () => {
    if (!toEmail) {
      showToast.error("Recipient email is required", { section: 'meeting_manager' });
      return;
    }
    setSending(true);
    try {
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

      const { data, error } = await supabase.functions.invoke("send-meeting-email-resend", {
        body: {
          to_email: toEmail,
          cc_emails: ccList,
          subject,
          html_content: body,
          audio_attachment: audioAttachment
        },
      });

      if (error) throw error;

      showToast.success("Meeting summary email sent", { section: 'meeting_manager' });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to send meeting summary:", err);
      showToast.error("Failed to send email", { section: 'meeting_manager' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl z-[150]" style={{ zIndex: 150 }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email AI-Generated Meeting Minutes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
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
            <div className="flex items-center justify-between">
              <Label htmlFor="cc">Add Meeting Participants (comma separated)</Label>
              {distributionLists.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <List className="h-3 w-3 mr-1" />
                      Distribution Lists
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[200]">
                    {distributionLists.map((list) => (
                      <DropdownMenuItem
                        key={list.id}
                        onClick={() => handleSelectDistributionList(list.id, list.name)}
                        className="cursor-pointer"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        {list.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
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
