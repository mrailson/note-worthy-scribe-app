import { useState, useRef, useCallback, useEffect } from "react";
import { ScribeTranscriptData } from "@/types/scribe";
import { iPhoneWhisperTranscriber, TranscriptData as IPhoneTranscriptData } from '@/utils/iPhoneWhisperTranscriber';
import { DesktopWhisperTranscriber, TranscriptData as DesktopTranscriptData } from '@/utils/DesktopWhisperTranscriber';
import { ChromiumMicTranscriber, ChromiumTranscriptData } from '@/utils/ChromiumMicTranscriber';
import { mergeLive } from "@/utils/TranscriptMerge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const useScribeRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<ScribeTranscriptData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [wordCount, setWordCount] = useState(0);
  const [currentConfidence, setCurrentConfidence] = useState<number | undefined>(undefined);
  const [cleanedTranscript, setCleanedTranscript] = useState("");
  const [isCleaningTranscript, setIsCleaningTranscript] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const iPhoneTranscriberRef = useRef<iPhoneWhisperTranscriber | null>(null);
  const desktopTranscriberRef = useRef<DesktopWhisperTranscriber | null>(null);
  const chromiumTranscriberRef = useRef<ChromiumMicTranscriber | null>(null);
  const wakeLockRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Wake lock management
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('🔒 Scribe wake lock activated');
      }
    } catch (error) {
      console.warn('⚠️ Scribe wake lock failed:', error);
    }
  };

  const releaseWakeLock = () => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('🔓 Scribe wake lock released');
      }
    } catch (error) {
      console.warn('⚠️ Error releasing Scribe wake lock:', error);
    }
  };

  // Auto-save drafts every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const draft = cleanedTranscript || transcript;
        if (draft?.length > 20) {
          localStorage.setItem('scribeTranscriptDraft', draft);
          localStorage.setItem('scribeTranscriptDraftTimestamp', Date.now().toString());
        }
      } catch (error) {
        console.warn('Scribe draft auto-save failed:', error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [cleanedTranscript, transcript]);

  // Handle visibility changes to maintain wake lock during recording
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRecording) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording]);

  const handleTranscriptUpdate = useCallback((newTranscriptData: ScribeTranscriptData) => {
    setRealtimeTranscripts(prev => {
      const updated = [...prev, newTranscriptData];
      
      // Update main transcript with complete sentences
      if (newTranscriptData.isFinal && newTranscriptData.text.trim()) {
        const finalText = newTranscriptData.text.trim();
        setTranscript(prevTranscript => {
          const newTranscript = mergeLive(prevTranscript, finalText);
          setWordCount(newTranscript.split(' ').filter(word => word.trim()).length);
          return newTranscript;
        });
      }
      
      setCurrentConfidence(newTranscriptData.confidence);
      return updated;
    });
  }, []);

  const startRecording = useCallback(async (selectedMicrophoneId?: string) => {
    try {
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setConnectionStatus("Connecting...");
      
      // Generate session ID
      sessionIdRef.current = `scribe_${Date.now()}`;
      
      // Request wake lock to prevent device sleep
      await requestWakeLock();

      // Start timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Device detection for routing
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isChromium = /Chrome|Edg/.test(navigator.userAgent);
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      console.log('🎯 Scribe device detection:', { isIOS, isChromium, isMobile });
      console.log('🎤 Selected microphone ID:', selectedMicrophoneId || 'default');

      if (isIOS) {
        console.log('📱 Starting iPhone Whisper transcription for Scribe...');
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
          (error: string) => {
            console.error("iPhone transcriber error:", error);
            toast.error(`Transcription error: ${error}`);
            setConnectionStatus("Error");
          },
          (status: string) => {
            setConnectionStatus(status);
          },
          { 
            transcriberService: 'whisper', 
            transcriberThresholds: { whisper: 0.30, deepgram: 0.30 },
            selectedDeviceId: selectedMicrophoneId
          }
        );
        
        await iPhoneTranscriberRef.current.startTranscription();
      } else {
        console.log('🖥️ Starting Desktop Whisper transcription for Scribe...');
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
          (error: string) => {
            console.error("Desktop transcriber error:", error);
            toast.error(`Transcription error: ${error}`);
            setConnectionStatus("Error");
          },
          (status: string) => {
            setConnectionStatus(status);
          },
          { 
            transcriberService: 'whisper', 
            transcriberThresholds: { whisper: 0.30, deepgram: 0.30 },
            selectedDeviceId: selectedMicrophoneId
          }
        );
        
        await desktopTranscriberRef.current.startTranscription();
      }

      setConnectionStatus("Connected");
      toast.success("Recording started");
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Failed to start recording");
      setIsRecording(false);
      setConnectionStatus("Error");
    }
  }, [handleTranscriptUpdate]);

  const stopRecording = useCallback(async () => {
    try {
      // Stop timer first
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Show processing status to user
      setConnectionStatus("Processing final transcript...");
      
      // Stop transcribers and wait for final processing
      // The transcribers now handle the "Processing final transcript..." status internally
      if (iPhoneTranscriberRef.current) {
        console.log('🔄 Stopping iPhone transcriber...');
        await iPhoneTranscriberRef.current.stopTranscription();
        iPhoneTranscriberRef.current = null;
      }
      if (desktopTranscriberRef.current) {
        console.log('🔄 Stopping Desktop transcriber...');
        await desktopTranscriberRef.current.stopTranscription();
        desktopTranscriberRef.current = null;
      }
      if (chromiumTranscriberRef.current) {
        console.log('🔄 Stopping Chromium transcriber...');
        await chromiumTranscriberRef.current.stopTranscription();
        chromiumTranscriberRef.current = null;
      }

      releaseWakeLock();

      setIsRecording(false);
      setIsPaused(false);
      setConnectionStatus("Disconnected");
      toast.success("Recording stopped - transcript complete");

      return {
        transcript,
        duration,
        wordCount,
        sessionId: sessionIdRef.current
      };
    } catch (error) {
      console.error("Error stopping recording:", error);
      toast.error("Error stopping recording");
      setIsRecording(false);
      setConnectionStatus("Error");
      return null;
    }
  }, [transcript, duration, wordCount]);

  const pauseRecording = useCallback(() => {
    setIsPaused(true);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    toast.info("Recording paused");
  }, []);

  const resumeRecording = useCallback(() => {
    setIsPaused(false);
    intervalRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    toast.info("Recording resumed");
  }, []);

  const resetRecording = useCallback(() => {
    console.log("Scribe: Resetting recording state");
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setTranscript("");
    setRealtimeTranscripts([]);
    setConnectionStatus("Disconnected");
    setWordCount(0);
    setCurrentConfidence(undefined);
    setCleanedTranscript("");
    setIsCleaningTranscript(false);
    sessionIdRef.current = null;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    releaseWakeLock();
    console.log("Scribe: Recording state reset complete");
  }, []);

  const cleanTranscript = useCallback(async () => {
    if (!transcript.trim()) {
      toast.error("No transcript to clean");
      return;
    }

    try {
      setIsCleaningTranscript(true);
      
      const { data, error } = await supabase.functions.invoke('clean-transcript', {
        body: { transcript }
      });

      if (error) throw error;

      setCleanedTranscript(data.cleanedTranscript || transcript);
      toast.success("Transcript cleaned successfully");
    } catch (error) {
      console.error('Clean transcript error:', error);
      toast.error('Failed to clean transcript');
    } finally {
      setIsCleaningTranscript(false);
    }
  }, [transcript]);

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
    sessionId: sessionIdRef.current,

    // Actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    cleanTranscript,
    setTranscript,
    setCleanedTranscript,
    setIsCleaningTranscript,
    formatDuration,
  };
};
