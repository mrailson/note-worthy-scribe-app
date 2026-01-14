import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Mic, Square } from "lucide-react";
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

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export const SDAFeedbackModal = ({ open, onOpenChange, currentSection }: SDAFeedbackModalProps) => {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const { toast } = useToast();
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startRecording = () => {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast({
        title: "Not supported",
        description: "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-GB';

      recognition.onstart = () => {
        setIsRecording(true);
        setInterimTranscript("");
        toast({
          title: "Recording started",
          description: "Speak now. Your words will appear in real-time.",
        });
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }

        if (final) {
          setMessage(prev => prev + final);
          setInterimTranscript("");
        } else {
          setInterimTranscript(interim);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== 'aborted') {
          toast({
            title: "Recognition error",
            description: `Error: ${event.error}. Please try again.`,
            variant: "destructive",
          });
        }
        setIsRecording(false);
        setInterimTranscript("");
      };

      recognition.onend = () => {
        setIsRecording(false);
        setInterimTranscript("");
      };

      recognition.start();
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      toast({
        title: "Failed to start",
        description: "Could not start speech recognition. Please try again.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setInterimTranscript("");
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
          to_email: user.email,
          subject: `[SDA Programme Feedback] - ${sectionName}`,
          html_content: `
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

  // Combine message with interim transcript for display
  const displayText = message + (interimTranscript ? interimTranscript : "");

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
              value={displayText}
              onChange={(e) => {
                setMessage(e.target.value);
                setInterimTranscript("");
              }}
              rows={5}
              className="resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pr-12"
            />
            {interimTranscript && (
              <div className="absolute bottom-2 left-3 right-12 text-sm text-muted-foreground italic truncate">
                {interimTranscript}
              </div>
            )}
            <div className="absolute right-2 top-2">
              {isRecording ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={stopRecording}
                  className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 text-white animate-pulse-gentle"
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
              Listening... Speak now. Click stop when finished.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting || isRecording}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || isRecording}>
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