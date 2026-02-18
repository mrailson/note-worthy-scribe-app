import { useState, useRef, useCallback, useEffect } from "react";
import { TranscriptData, AudioCaptureMode } from "@/types/gpscribe";
import { UnifiedAudioCapture } from "@/utils/UnifiedAudioCapture";
import { iPhoneWhisperTranscriber, TranscriptData as IPhoneTranscriptData } from '@/utils/iPhoneWhisperTranscriber';
import { DesktopWhisperTranscriber, TranscriptData as DesktopTranscriptData } from '@/utils/DesktopWhisperTranscriber';
import { ChromiumMicTranscriber, ChromiumTranscriptData } from '@/utils/ChromiumMicTranscriber';
import { SystemAudioCapture } from '@/utils/SystemAudioCapture';
import { mergeLive } from "@/utils/TranscriptMerge";
import { showToast } from "@/utils/toastWrapper";
import { bus } from "@/lib/bus";
import { supabase } from "@/integrations/supabase/client";

export const useGPScribeRecording = (selectedMicrophoneId?: string | null, audioCaptureMode: AudioCaptureMode = 'mic-only') => {
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
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pauseDetectionRef = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptTimeRef = useRef<number>(Date.now());
  const transciberRef = useRef<UnifiedAudioCapture | null>(null);
  const iPhoneTranscriberRef = useRef<iPhoneWhisperTranscriber | null>(null);
  const desktopTranscriberRef = useRef<DesktopWhisperTranscriber | null>(null);
  const chromiumTranscriberRef = useRef<ChromiumMicTranscriber | null>(null);
  const systemAudioCaptureRef = useRef<SystemAudioCapture | null>(null);
  const wakeLockRef = useRef<any>(null);
  const meetingIdRef = useRef<string | null>(null); // Store meeting ID for status updates

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

  // Wake lock management
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('🔒 GPScribe wake lock activated');
      }
    } catch (error) {
      console.warn('⚠️ GPScribe wake lock failed:', error);
    }
  };

  const releaseWakeLock = () => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('🔓 GPScribe wake lock released');
      }
    } catch (error) {
      console.warn('⚠️ Error releasing GPScribe wake lock:', error);
    }
  };

  // Auto-save drafts every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const draft = cleanedTranscript || transcript;
        if (draft?.length > 20) {
          localStorage.setItem('gpscribeTranscriptDraft', draft);
          localStorage.setItem('gpscribeTranscriptDraftTimestamp', Date.now().toString());
        }
      } catch (error) {
        console.warn('GPScribe draft auto-save failed:', error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [cleanedTranscript, transcript]);

  // Smart beforeunload handler - only warn on manual edits, not during recording
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // ONLY warn if user has unsaved manual edits and is NOT recording
      if (hasUnsavedEdits && !isRecording) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes to your consultation transcript. Are you sure you want to leave?';
        return 'You have unsaved changes to your consultation transcript. Are you sure you want to leave?';
      }
      // Otherwise, allow navigation without prompt during recording
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedEdits, isRecording]);

  // Clean unload handler
  useEffect(() => {
    const handleUnload = () => {
      try {
        // Stop transcribers fast
        if (iPhoneTranscriberRef.current) {
          iPhoneTranscriberRef.current.stopTranscription();
        }
        if (desktopTranscriberRef.current) {
          desktopTranscriberRef.current.stopTranscription();
        }
        if (chromiumTranscriberRef.current) {
          chromiumTranscriberRef.current.stopTranscription();
        }
        
        // Send final transcript data if available
        const finalText = cleanedTranscript || transcript;
        if (finalText) {
          navigator.sendBeacon(
            '/api/gpscribe/flush',
            new Blob([JSON.stringify({ 
              transcript: finalText,
              timestamp: new Date().toISOString(),
              wordCount,
              duration
            })], { type: 'application/json' })
          );
        }
        
        releaseWakeLock();
      } catch (error) {
        console.warn('GPScribe unload cleanup failed:', error);
      }
    };

    window.addEventListener('unload', handleUnload);
    return () => window.removeEventListener('unload', handleUnload);
  }, [cleanedTranscript, transcript, wordCount, duration]);

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

  const handleTranscriptUpdate = useCallback((newTranscriptData: TranscriptData) => {
    // Update timestamp for pause detection
    lastTranscriptTimeRef.current = Date.now();
    
    setRealtimeTranscripts(prev => {
      const updated = [...prev, newTranscriptData];
      
      // Update main transcript with complete sentences
      if (newTranscriptData.isFinal && newTranscriptData.text.trim()) {
        const finalText = newTranscriptData.text.trim();
        setTranscript(prevTranscript => {
          // Use mergeLive to detect and remove overlapping text sections
          const newTranscript = mergeLive(prevTranscript, finalText);
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
      setHasUnsavedEdits(false); // Clear unsaved edits flag when starting new recording
      
      // Create meeting record in database
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: meetingData, error: meetingError } = await supabase
            .from('meetings')
            .insert({
              user_id: user.id,
              title: 'GP Consultation',
              meeting_type: 'consultation',
              status: 'recording',
              start_time: new Date().toISOString()
            })
            .select('id')
            .single();
          
          if (!meetingError && meetingData) {
            meetingIdRef.current = meetingData.id;
            console.log('✅ Created meeting record:', meetingData.id);
            // Attach device info in background
            import('@/utils/meetingDeviceCapture').then(({ attachDeviceInfoToMeeting }) => {
              attachDeviceInfoToMeeting(meetingData.id);
            });
          } else {
            console.error('Failed to create meeting record:', meetingError);
          }
        }
      } catch (error) {
        console.error('Error creating meeting record:', error);
      }
      
      // Request wake lock to prevent device sleep
      await requestWakeLock();

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
        envVar: import.meta.env.VITE_USE_CHROMIUM_MIC_PIPELINE,
        userAgent: navigator.userAgent.substring(0, 100)
      });

      // Show user which pipeline is being used
      if (useChromiumMicPipeline) {
        showToast.info("Using optimized Chromium microphone pipeline", { section: 'gpscribe' });
      } else if (isIOS) {
        showToast.info("Using iPhone Whisper pipeline", { section: 'gpscribe' });
      } else {
        showToast.info("Using desktop Whisper pipeline", { section: 'gpscribe' });
      }

      if (isIOS) {
        console.log('📱 Starting iPhone Whisper transcription for GP Scribe...');
        console.log('🎤 Using microphone device:', selectedMicrophoneId || 'default');
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
            showToast.error(`Transcription error: ${error}`, { section: 'gpscribe' });
            setConnectionStatus("Error");
          },
          (status: string) => {
            setConnectionStatus(status);
          },
          { transcriberService: 'whisper', transcriberThresholds: { whisper: 0.30, deepgram: 0.30 } }, // Lower threshold for consultations
          undefined, // meetingId
          undefined, // onAudioActivity
          selectedMicrophoneId // Selected device ID
        );
        
        await iPhoneTranscriberRef.current.startTranscription();
      } else if (isMobile) {
        console.log('📱 Starting Desktop Whisper transcription for Android GP Scribe...');
        console.log('🎤 Using microphone device:', selectedMicrophoneId || 'default');
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
            showToast.error(`Transcription error: ${error}`, { section: 'gpscribe' });
            setConnectionStatus("Error");
          },
          (status: string) => {
            setConnectionStatus(status);
          },
          { transcriberService: 'whisper', transcriberThresholds: { whisper: 0.7, deepgram: 0.8 } }, // Lower threshold for consultations
          undefined, // meetingId
          undefined, // onAudioActivity
          undefined, // onChunkProcessed
          undefined, // onChunkFiltered
          selectedMicrophoneId // Selected device ID
        );
        
        await desktopTranscriberRef.current.startTranscription();
      } else if (useChromiumMicPipeline) {
        console.log('🚀 Starting Chromium Mic Pipeline for GP Scribe...');
        console.log('🎤 Using microphone device:', selectedMicrophoneId || 'default');
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
            showToast.error(`Chromium transcription error: ${error}`, { section: 'gpscribe' });
            setConnectionStatus("Error");
          },
          (status: string) => {
            setConnectionStatus(status);
          },
          { transcriberService: 'whisper', transcriberThresholds: { whisper: 0.30, deepgram: 0.30 } }, // Lower threshold for consultations
          selectedMicrophoneId // Selected device ID
        );
        
        await chromiumTranscriberRef.current.startTranscription();
      } else {
        console.log('🖥️ Starting Desktop Whisper transcription for GP Scribe...');
        console.log('🎤 Using microphone device:', selectedMicrophoneId || 'default');
        console.log('🔊 Audio capture mode:', audioCaptureMode);
        
        let externalStream: MediaStream | null = null;
        
        // If mic-browser mode, use SystemAudioCapture to get mixed stream
        if (audioCaptureMode === 'mic-browser') {
          try {
            showToast.info("Please select a browser tab and tick 'Share audio' to capture patient voice", { section: 'gpscribe', duration: 8000 });
            systemAudioCaptureRef.current = new SystemAudioCapture();
            externalStream = await systemAudioCaptureRef.current.startCapture();
            showToast.success("Browser audio capture enabled - both voices will be transcribed", { section: 'gpscribe' });
          } catch (error: any) {
            console.warn('Failed to capture browser audio, falling back to mic-only:', error);
            showToast.warning("Browser audio not available - using microphone only", { section: 'gpscribe' });
            // Fall back to mic-only mode
          }
        }
        
        // Use desktop transcriber for better reliability
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
            showToast.error(`Transcription error: ${error}`, { section: 'gpscribe' });
            setConnectionStatus("Error");
          },
          (status: string) => {
            setConnectionStatus(status);
          },
          { transcriberService: 'whisper', transcriberThresholds: { whisper: 0.30, deepgram: 0.30 } }, // Lower threshold for consultations
          undefined, // meetingId
          undefined, // onAudioActivity
          undefined, // onChunkProcessed
          undefined, // onChunkFiltered
          externalStream ? undefined : selectedMicrophoneId, // Only use device ID if not using external stream
          externalStream // Pass external stream if available
        );
        
        await desktopTranscriberRef.current.startTranscription();
      }

      setConnectionStatus("Connected");
      showToast.success("Recording started", { section: 'gpscribe' });
    } catch (error) {
      console.error("Failed to start recording:", error);
      showToast.error("Failed to start recording", { section: 'gpscribe' });
      setIsRecording(false);
      setConnectionStatus("Disconnected");
    }
  }, [handleTranscriptUpdate]);

  const stopRecording = useCallback(async (navigate?: (path: string, options?: any) => void) => {
    try {
      setIsRecording(false);
      setIsPaused(false);
      setConnectionStatus("Disconnected");
      setHasUnsavedEdits(false); // Clear unsaved edits flag when stopping
      
      // Update meeting status to completed
      if (meetingIdRef.current) {
        try {
          const { error: updateError } = await supabase
            .from('meetings')
            .update({
              status: 'completed',
              end_time: new Date().toISOString(),
              transcript: transcript.trim(),
              word_count: wordCount,
              duration_minutes: Math.floor(duration / 60)
            })
            .eq('id', meetingIdRef.current);
          
          if (updateError) {
            console.error('Failed to update meeting status:', updateError);
            // Try again with just status update as fallback
            await supabase
              .from('meetings')
              .update({ status: 'completed', end_time: new Date().toISOString() })
              .eq('id', meetingIdRef.current);
          } else {
            console.log('✅ Meeting marked as completed:', meetingIdRef.current);
          }
        } catch (error) {
          console.error('Error updating meeting status:', error);
        }
      }
      
      // Release wake lock
      releaseWakeLock();

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

      if (systemAudioCaptureRef.current) {
        systemAudioCaptureRef.current.stopCapture();
        systemAudioCaptureRef.current = null;
      }

      showToast.success("Recording stopped", { section: 'gpscribe' });

      // Auto-navigate to meeting summary if transcript exists and navigate function provided
      if (navigate && transcript.trim() && wordCount > 10) {
        const meetingData: any = {
          title: "GP Consultation",
          duration,
          wordCount,
          transcript: transcript.trim(),
          speakerCount: 1,
          startTime: new Date().toISOString(),
          meetingFormat: 'consultation'
        };

        // Auto-generate Meeting Style 2 (Clear & Direct format)
        try {
          const { data, error } = await supabase.functions.invoke('generate-meeting-notes-claude', {
            body: {
              transcript: transcript.trim(),
              meetingTitle: "GP Consultation",
              meetingDate: new Date().toLocaleDateString('en-GB', { 
                day: 'numeric',
                month: 'long', 
                year: 'numeric'
              }),
              meetingTime: new Date().toLocaleTimeString('en-GB', { 
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
              }),
              detailLevel: 'informal' // Style 2 = Clear & Direct = informal
            }
          });

          if (!error && data?.success && data?.meetingMinutes) {
            // Include the generated notes in the meeting data
            meetingData.generatedNotes = data.meetingMinutes;
          } else {
            console.error('Failed to generate meeting notes:', error || data?.error);
            showToast.warning("Recording saved but notes generation failed - you can generate them manually", { section: 'gpscribe' });
          }
        } catch (error) {
          console.error('Error generating meeting notes:', error);
          showToast.warning("Recording saved but notes generation failed - you can generate them manually", { section: 'gpscribe' });
        }

        navigate('/meeting-summary', { state: meetingData });
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      showToast.error("Failed to stop recording", { section: 'gpscribe' });
    }
  }, [transcript, duration, wordCount]);

  const pauseRecording = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPaused(true);
    showToast.info("Recording paused", { section: 'gpscribe' });
  }, []);

  const resumeRecording = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    setIsPaused(false);
    showToast.info("Recording resumed", { section: 'gpscribe' });
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
    hasUnsavedEdits,
    
    // Actions
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearTranscript,
    setTranscript,
    setCleanedTranscript,
    setIsCleaningTranscript,
    setHasUnsavedEdits,
    
    // Utils
    formatDuration
  };
};