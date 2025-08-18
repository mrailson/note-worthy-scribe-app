import { useState, useRef, useCallback, useEffect } from "react";
import { TranscriptData } from "@/types/gpscribe";
import { UnifiedAudioCapture } from "@/utils/UnifiedAudioCapture";
import { iPhoneWhisperTranscriber, TranscriptData as IPhoneTranscriptData } from '@/utils/iPhoneWhisperTranscriber';
import { DesktopWhisperTranscriber, TranscriptData as DesktopTranscriptData } from '@/utils/DesktopWhisperTranscriber';
import { ChromiumMicTranscriber, ChromiumTranscriptData } from '@/utils/ChromiumMicTranscriber';
import { toast } from "sonner";
import { bus } from "@/lib/bus";
import { supabase } from "@/integrations/supabase/client";

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
  const pauseDetectionRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptTimeRef = useRef<number>(Date.now());
  const transciberRef = useRef<UnifiedAudioCapture | null>(null);
  const iPhoneTranscriberRef = useRef<iPhoneWhisperTranscriber | null>(null);
  const desktopTranscriberRef = useRef<DesktopWhisperTranscriber | null>(null);
  const chromiumTranscriberRef = useRef<ChromiumMicTranscriber | null>(null);

  // Natural pause detection based on transcript activity
  useEffect(() => {
    if (isRecording) {
      const detectNaturalPause = () => {
        const now = Date.now();
        const timeSinceLastTranscript = now - lastTranscriptTimeRef.current;
        
        // If no new transcript for 3 seconds, consider it a natural pause
        if (timeSinceLastTranscript > 3000) {
          console.log('🔄 Natural speech pause detected - emitting SPEECH_PAUSE_DETECTED');
          bus.emit("SPEECH_PAUSE_DETECTED");
          lastTranscriptTimeRef.current = now; // Reset to prevent multiple rapid events
        }
      };

      // Check for pauses every 500ms
      pauseDetectionRef.current = setInterval(detectNaturalPause, 500);
    } else {
      if (pauseDetectionRef.current) {
        clearInterval(pauseDetectionRef.current);
        pauseDetectionRef.current = null;
      }
    }

    return () => {
      if (pauseDetectionRef.current) {
        clearInterval(pauseDetectionRef.current);
        pauseDetectionRef.current = null;
      }
    };
  }, [isRecording]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscriptUpdate = useCallback((newTranscriptData: TranscriptData) => {
    // Update timestamp for pause detection
    lastTranscriptTimeRef.current = Date.now();
    
    setRealtimeTranscripts(prev => {
      const updated = [...prev, newTranscriptData];
      
      // Update main transcript with complete sentences
      if (newTranscriptData.isFinal && newTranscriptData.text.trim()) {
        const finalText = newTranscriptData.text.trim();
        setTranscript(prevTranscript => {
          const newTranscript = prevTranscript ? `${prevTranscript} ${finalText}` : finalText;
          setWordCount(newTranscript.split(' ').filter(word => word.trim()).length);
          
          // Create translation request for each final transcript segment
          if (finalText.length > 10) { // Only translate meaningful phrases
            console.log('🔄 Creating translation for:', finalText);
            
            // Create initial translation event with placeholder
            const messageId = `transcript_${Date.now()}`;
            bus.emit("TRANSLATION_READY", {
              messageId,
              sourceLang: "en",
              targetLang: "bn", // This should come from user settings
              originalText: finalText,
              translatedText: "", // Start empty
              isStreaming: true
            });
            
            // Call translation service
            const translateText = async () => {
              try {
                console.log('🔄 Calling translation service for:', finalText);
                const { data, error } = await supabase.functions.invoke('translate-text', {
                  body: {
                    text: finalText,
                    targetLanguage: 'bn', // Bengali
                    sourceLanguage: 'en'
                  }
                });
                
                console.log('Translation response:', { data, error });
                
                if (error) {
                  console.error('Translation error:', error);
                  throw error;
                }
                
                // Emit updated translation
                bus.emit("TRANSLATION_READY", {
                  messageId,
                  sourceLang: "en",
                  targetLang: "bn",
                  originalText: finalText,
                  translatedText: data.translatedText || finalText,
                  isStreaming: false
                });
              } catch (error) {
                console.error('Translation failed:', error);
                // Emit with fallback
                bus.emit("TRANSLATION_READY", {
                  messageId,
                  sourceLang: "en",
                  targetLang: "bn",
                  originalText: finalText,
                  translatedText: `[Translation failed] ${finalText}`,
                  isStreaming: false
                });
              }
            };
            
            translateText();
          }
          
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

      // Device detection for routing
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|Edg/.test(navigator.userAgent);
      const isChromium = /Chrome|Edg/.test(navigator.userAgent);
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      // Feature flag for Chromium mic pipeline (default: false)
      const useChromiumMicPipeline = 
        isChromium && 
        !isMobile && 
        import.meta.env.VITE_USE_CHROMIUM_MIC_PIPELINE === 'true';

      console.log('🎯 Device detection:', { 
        isIOS, 
        isSafari, 
        isChromium, 
        isMobile, 
        useChromiumMicPipeline,
        userAgent: navigator.userAgent.substring(0, 100)
      });

      if (isIOS) {
        console.log('📱 Starting iPhone Whisper transcription for GP Scribe...');
        iPhoneTranscriberRef.current = new iPhoneWhisperTranscriber(
          (data: IPhoneTranscriptData) => {
            handleTranscriptUpdate({
              text: data.text,
              speaker: data.speaker || "Patient",
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
          }
        );
        
        await iPhoneTranscriberRef.current.startTranscription();
      } else if (isMobile) {
        console.log('📱 Starting Desktop Whisper transcription for Android GP Scribe...');
        // Use desktop transcriber for Android - same as meeting recorder
        desktopTranscriberRef.current = new DesktopWhisperTranscriber(
          (data: DesktopTranscriptData) => {
            handleTranscriptUpdate({
              text: data.text,
              speaker: data.speaker || "Patient",
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
          }
        );
        
        await desktopTranscriberRef.current.startTranscription();
      } else if (useChromiumMicPipeline) {
        console.log('🚀 Starting Chromium Mic Pipeline for GP Scribe...');
        // Use new Chromium-optimized mic pipeline
        chromiumTranscriberRef.current = new ChromiumMicTranscriber(
          (data: ChromiumTranscriptData) => {
            handleTranscriptUpdate({
              text: data.text,
              speaker: data.speaker || "Patient",
              confidence: data.confidence || 0.8,
              timestamp: new Date().toISOString(),
              isFinal: data.is_final || false
            });
          },
          (error: string) => {
            console.error("Chromium transcriber error:", error);
            toast.error(`Chromium transcription error: ${error}`);
            setConnectionStatus("Error");
          },
          (status: string) => {
            setConnectionStatus(status);
          }
        );
        
        await chromiumTranscriberRef.current.startTranscription();
      } else {
        console.log('🖥️ Starting Desktop Whisper transcription for GP Scribe...');
        // Use desktop transcriber for better reliability - don't use UnifiedAudioCapture
        desktopTranscriberRef.current = new DesktopWhisperTranscriber(
          (data: DesktopTranscriptData) => {
            handleTranscriptUpdate({
              text: data.text,
              speaker: data.speaker || "Patient",
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

      if (chromiumTranscriberRef.current) {
        chromiumTranscriberRef.current.stopTranscription();
        chromiumTranscriberRef.current = null;
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