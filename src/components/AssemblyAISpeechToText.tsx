import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AssemblyRealtimeClient } from "@/lib/assembly-realtime";

interface AssemblyAISpeechToTextProps {
  onTranscription: (text: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export const AssemblyAISpeechToText = ({ 
  onTranscription, 
  className = "", 
  size = "md",
  inputRef 
}: AssemblyAISpeechToTextProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const clientRef = useRef<AssemblyRealtimeClient | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState("");

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setIsProcessing(true);
      setCurrentTranscript("");

      const client = new AssemblyRealtimeClient({
        onOpen: () => {
          console.log("AssemblyAI connection opened");
          setIsRecording(true);
          setIsProcessing(false);
          toast.success("Recording started. Speak now!");
        },
        onPartial: (text) => {
          console.log("Partial transcript:", text);
          setCurrentTranscript(text);
        },
        onFinal: (text) => {
          console.log("Final transcript:", text);
          if (text && text.trim()) {
            onTranscription(text.trim());
            setCurrentTranscript("");
          }
        },
        onError: (error) => {
          console.error("AssemblyAI error:", error);
          toast.error("Speech recognition error");
          setIsRecording(false);
          setIsProcessing(false);
          setCurrentTranscript("");
        },
        onClose: () => {
          console.log("AssemblyAI connection closed");
          setIsRecording(false);
          setIsProcessing(false);
          if (currentTranscript.trim()) {
            onTranscription(currentTranscript.trim());
          }
          setCurrentTranscript("");
        }
      });

      clientRef.current = client;
      await client.start();
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Failed to start recording");
      setIsRecording(false);
      setIsProcessing(false);
      setCurrentTranscript("");
    }
  };

  const stopRecording = () => {
    if (clientRef.current) {
      clientRef.current.stop();
      clientRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const buttonSize = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm", 
    lg: "h-12 px-6 text-base"
  }[size];

  const getButtonSize = () => {
    switch(size) {
      case "sm": return "sm";
      case "lg": return "lg";
      default: return "default";
    }
  };

  const iconSize = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  }[size];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Button
        type="button"
        variant={isRecording ? "destructive" : "outline"}
        size={getButtonSize()}
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`flex items-center gap-2 ${buttonSize}`}
        title={isRecording ? "Stop recording" : "Start voice input (AssemblyAI)"}
      >
        {isProcessing ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : isRecording ? (
          <MicOff className={iconSize} />
        ) : (
          <Mic className={iconSize} />
        )}
        {isProcessing ? (
          "Connecting..."
        ) : isRecording ? (
          "Stop Recording"
        ) : (
          "Voice Input"
        )}
      </Button>
      
      {isRecording && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          Recording... (AssemblyAI)
        </div>
      )}
      
      {currentTranscript && (
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          <strong>Live:</strong> {currentTranscript}
        </div>
      )}
    </div>
  );
};