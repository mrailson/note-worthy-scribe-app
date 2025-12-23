import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send } from "lucide-react";
import { format } from "date-fns";

interface SDAFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSection: string;
}

const sectionLabels: Record<string, string> = {
  executive: "Executive Summary",
  estates: "Estates & Capacity",
  digital: "IT & Digital",
  workforce: "Workforce & Innovation",
  risks: "Risks & Mitigation",
  finance: "Finance & Governance",
  evidence: "Evidence Library",
};

export const SDAFeedbackModal = ({ open, onOpenChange, currentSection }: SDAFeedbackModalProps) => {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter your feedback or describe the problem.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        toast({
          title: "Authentication required",
          description: "Please log in to submit feedback.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const sectionName = sectionLabels[currentSection] || currentSection;
      const submittedAt = format(new Date(), "dd/MM/yyyy, HH:mm");

      // Send email via edge function
      const { error } = await supabase.functions.invoke("send-email-resend", {
        body: {
          to: user.email,
          subject: `[SDA Programme Feedback] - ${sectionName}`,
          html: `
            <h2>SDA Programme Feedback Received</h2>
            <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;">From</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${user.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;">Section</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${sectionName}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f5f5f5;">Date & Time</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${submittedAt}</td>
              </tr>
            </table>
            <h3 style="margin-top: 20px;">Message:</h3>
            <div style="padding: 15px; background-color: #f9f9f9; border-left: 4px solid #005eb8; margin-top: 10px;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          `,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback. A copy has been sent to your email.",
      });

      setMessage("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending feedback:", error);
      toast({
        title: "Failed to send feedback",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Feedback or Report a Problem</DialogTitle>
          <DialogDescription>
            Let us know about any issues or suggestions for the {sectionLabels[currentSection] || currentSection} section.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Textarea
            placeholder="Describe your feedback or the problem you're experiencing..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
