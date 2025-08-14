import { useState, useRef, useCallback } from "react";
import { TranscriptData } from "@/types/gpscribe";
import { UnifiedAudioCapture } from "@/utils/UnifiedAudioCapture";
import { iPhoneWhisperTranscriber, TranscriptData as IPhoneTranscriptData } from '@/utils/iPhoneWhisperTranscriber';
import { DesktopWhisperTranscriber, TranscriptData as DesktopTranscriptData } from '@/utils/DesktopWhisperTranscriber';
import { toast } from "sonner";

export const useGPScribeRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<TranscriptData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [wordCount, setWordCount] = useState(0);
  const [currentConfidence, setCurrentConfidence] = useState<number | undefined>(undefined);
  const [cleanedTranscript, setCleanedTranscript] = useState("");
  const [isCleaningTranscript, setIsCleaningTranscript] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transciberRef = useRef<UnifiedAudioCapture | null>(null);
  const iPhoneTranscriberRef = useRef<iPhoneWhisperTranscriber | null>(null);
  const desktopTranscriberRef = useRef<DesktopWhisperTranscriber | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscriptUpdate = useCallback((newTranscriptData: TranscriptData) => {
    setRealtimeTranscripts(prev => {
      const updated = [...prev, newTranscriptData];
      
      // Update main transcript with complete sentences
      if (newTranscriptData.isFinal && newTranscriptData.text.trim()) {
        const finalText = newTranscriptData.text.trim();
        setTranscript(prevTranscript => {
          const newTranscript = prevTranscript ? `${prevTranscript} ${finalText}` : finalText;
          setWordCount(newTranscript.split(' ').filter(word => word.trim()).length);
          return newTranscript;
        });
      }
      
      setCurrentConfidence(newTranscriptData.confidence);
      return updated;
    });
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setConnectionStatus("Connecting...");

      // Start timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Initialize transcriber based on device
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isIOS) {
        iPhoneTranscriberRef.current = new iPhoneWhisperTranscriber(
          (data: IPhoneTranscriptData) => {
            handleTranscriptUpdate({
              text: data.text,
              speaker: data.speaker || "Speaker",
              confidence: data.confidence || 0.8,
              timestamp: new Date().toISOString(),
              isFinal: data.is_final || false
            });
          },
          (status: string) => {
            setConnectionStatus(status);
          },
          (error: string) => {
            console.error("iPhone transcriber error:", error);
            toast.error(`Transcription error: ${error}`);
          }
        );
        
        await iPhoneTranscriberRef.current.startTranscription();
      } else if (isMobile) {
        // Use desktop transcriber for Android
        desktopTranscriberRef.current = new DesktopWhisperTranscriber(
          (data: DesktopTranscriptData) => {
            handleTranscriptUpdate({
              text: data.text,
              speaker: data.speaker || "Speaker",
              confidence: data.confidence || 0.8,
              timestamp: new Date().toISOString(),
              isFinal: data.is_final || false
            });
          },
          (status: string) => {
            setConnectionStatus(status);
          },
          (error: string) => {
            console.error("Desktop transcriber error:", error);
            toast.error(`Transcription error: ${error}`);
          }
        );
        
        await desktopTranscriberRef.current.startTranscription();
      } else {
        // Desktop fallback
        transciberRef.current = new UnifiedAudioCapture(
          handleTranscriptUpdate,
          (status: string) => {
            setConnectionStatus(status);
          },
          (error: string) => {
            console.error("Unified audio capture error:", error);
            toast.error(`Recording error: ${error}`);
          }
        );
        
        await transciberRef.current.startCapture();
      }

      setConnectionStatus("Connected");
      toast.success("Recording started");
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Failed to start recording");
      setIsRecording(false);
      setConnectionStatus("Disconnected");
    }
  }, [handleTranscriptUpdate]);

  const stopRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      setIsPaused(false);
      setConnectionStatus("Disconnected");

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (transciberRef.current) {
        await transciberRef.current.stopCapture();
        transciberRef.current = null;
      }

      if (iPhoneTranscriberRef.current) {
        await iPhoneTranscriberRef.current.stopTranscription();
        iPhoneTranscriberRef.current = null;
      }

      if (desktopTranscriberRef.current) {
        await desktopTranscriberRef.current.stopTranscription();
        desktopTranscriberRef.current = null;
      }

      toast.success("Recording stopped");
    } catch (error) {
      console.error("Failed to stop recording:", error);
      toast.error("Failed to stop recording");
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPaused(true);
    toast.info("Recording paused");
  }, []);

  const resumeRecording = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    setIsPaused(false);
    toast.info("Recording resumed");
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setRealtimeTranscripts([]);
    setWordCount(0);
    setCleanedTranscript("");
    setCurrentConfidence(undefined);
  }, []);

  return {
    // States
    isRecording,
    isPaused,
    duration,
    transcript,
    realtimeTranscripts,
    connectionStatus,
    wordCount,
    currentConfidence,
    cleanedTranscript,
    isCleaningTranscript,
    
    // Actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearTranscript,
    setTranscript,
    setCleanedTranscript,
    setIsCleaningTranscript,
    
    // Utils
    formatDuration
  };
};