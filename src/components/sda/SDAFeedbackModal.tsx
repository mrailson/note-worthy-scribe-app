import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Mic, MicOff, Square } from "lucide-react";
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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { toast } = useToast();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "Recording started",
        description: "Speak now. Click the stop button when finished.",
      });
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to use voice input.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        const { data, error } = await supabase.functions.invoke("voice-to-text", {
          body: { audio: base64Audio },
        });

        if (error) throw error;

        if (data?.text) {
          setMessage(prev => prev ? `${prev} ${data.text}` : data.text);
          toast({
            title: "Transcription complete",
            description: "Your voice has been converted to text.",
          });
        }
        setIsTranscribing(false);
      };
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast({
        title: "Transcription failed",
        description: "Could not convert voice to text. Please try again.",
        variant: "destructive",
      });
      setIsTranscribing(false);
    }
  };

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
          <div className="relative rounded-lg border-2 border-[#005EB8]/30 focus-within:border-[#005EB8] transition-colors bg-background">
            <Textarea
              placeholder="Describe your feedback or the problem you're experiencing..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pr-12"
              disabled={isTranscribing}
            />
            <div className="absolute right-2 top-2">
              {isTranscribing ? (
                <div className="flex items-center justify-center h-9 w-9">
                  <Loader2 className="h-5 w-5 animate-spin text-[#005EB8]" />
                </div>
              ) : isRecording ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={stopRecording}
                  className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 text-white animate-pulse"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={startRecording}
                  className="h-9 w-9 rounded-full hover:bg-[#005EB8]/10 text-[#005EB8]"
                  title="Click to record voice feedback"
                >
                  <Mic className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
          {isRecording && (
            <p className="text-sm text-red-500 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              Recording... Click the stop button when finished.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isRecording}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || isRecording || isTranscribing}>
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