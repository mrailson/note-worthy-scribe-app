import { useState, useRef, useCallback, useEffect } from "react";
import { ScribeTranscriptData, ScribeSettings, AudioRecordingFormat, CHUNK_DURATION_OPTIONS } from "@/types/scribe";
import { iPhoneWhisperTranscriber, TranscriptData as IPhoneTranscriptData } from '@/utils/iPhoneWhisperTranscriber';
import { DesktopWhisperTranscriber, TranscriptData as DesktopTranscriptData, ChunkMetadata } from '@/utils/DesktopWhisperTranscriber';
import { ChromiumMicTranscriber, ChromiumTranscriptData } from '@/utils/ChromiumMicTranscriber';
import { mergeLive } from "@/utils/TranscriptMerge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useChunkTracker, ChunkStatus } from "./useChunkTracker";

export type AudioSourceMode = 'microphone' | 'microphone_and_system';

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
  
  // Audio source mode states
  const [audioSourceMode, setAudioSourceMode] = useState<AudioSourceMode>('microphone');
  const [isSwitchingAudioSource, setIsSwitchingAudioSource] = useState(false);
  const [micCaptured, setMicCaptured] = useState(false);
  const [systemAudioCaptured, setSystemAudioCaptured] = useState(false);

  // Chunk tracking for debugging
  const { chunks, addChunk, clearChunks, getStats } = useChunkTracker();
  const recordingStartTimeRef = useRef<number>(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const iPhoneTranscriberRef = useRef<iPhoneWhisperTranscriber | null>(null);
  const desktopTranscriberRef = useRef<DesktopWhisperTranscriber | null>(null);
  const chromiumTranscriberRef = useRef<ChromiumMicTranscriber | null>(null);
  const wakeLockRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const currentMicIdRef = useRef<string | undefined>(undefined);

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

  // Chunk tracking callbacks
  const handleChunkProcessed = useCallback((metadata: ChunkMetadata) => {
    addChunk({
      timestamp: new Date(),
      text: metadata.text || '',
      confidence: metadata.confidence || 0,
      status: metadata.confidence && metadata.confidence < 0.3 ? 'low_confidence' : 'success',
      speaker: metadata.speaker,
      isFinal: true,
      reason: undefined
    });
  }, [addChunk]);

  const handleChunkFiltered = useCallback((metadata: ChunkMetadata) => {
    addChunk({
      timestamp: new Date(),
      text: metadata.text || '[audio chunk]',
      confidence: metadata.confidence || 0,
      status: 'filtered',
      speaker: undefined,
      isFinal: false,
      reason: metadata.reason || 'Unknown filter reason'
    });
  }, [addChunk]);

  const startRecording = useCallback(async (
    selectedMicrophoneId?: string, 
    mode: AudioSourceMode = 'microphone',
    audioFormat?: AudioRecordingFormat,
    chunkDurationSeconds?: number
  ) => {
    try {
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      setConnectionStatus("Connecting...");
      setAudioSourceMode(mode);
      currentMicIdRef.current = selectedMicrophoneId;
      
      // Generate session ID and clear previous chunks
      sessionIdRef.current = `scribe_${Date.now()}`;
      recordingStartTimeRef.current = Date.now();
      clearChunks();
      
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
      console.log('🔊 Audio source mode:', mode);
      console.log('🎵 Audio format:', audioFormat || 'webm (default)');
      console.log('⏱️ Chunk duration:', chunkDurationSeconds || CHUNK_DURATION_OPTIONS.default, 'seconds');

      // For system audio capture (if requested and not on mobile/iOS)
      let combinedStream: MediaStream | undefined;
      if (mode === 'microphone_and_system' && !isMobile && !isIOS) {
        try {
          console.log('📺 Requesting system audio capture...');
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // Required by some browsers, we won't use it
            audio: true
          });
          
          // Stop video tracks - we only want audio
          displayStream.getVideoTracks().forEach(track => track.stop());
          
          const audioTracks = displayStream.getAudioTracks();
          if (audioTracks.length > 0) {
            systemStreamRef.current = new MediaStream(audioTracks);
            setSystemAudioCaptured(true);
            console.log('✅ System audio captured successfully');
            
            // Get microphone stream
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: selectedMicrophoneId 
                ? { deviceId: { exact: selectedMicrophoneId } }
                : true
            });
            setMicCaptured(true);
            
            // Combine streams using AudioContext
            const audioContext = new AudioContext();
            const destination = audioContext.createMediaStreamDestination();
            
            const micSource = audioContext.createMediaStreamSource(micStream);
            const systemSource = audioContext.createMediaStreamSource(systemStreamRef.current);
            
            micSource.connect(destination);
            systemSource.connect(destination);
            
            combinedStream = destination.stream;
          }
        } catch (error) {
          console.warn('⚠️ System audio capture failed, falling back to mic only:', error);
          toast.info("System audio unavailable, using microphone only");
          setAudioSourceMode('microphone');
        }
      }

      if (isIOS) {
        console.log('📱 Starting iPhone Whisper transcription for Scribe...');
        setMicCaptured(true);
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
        setMicCaptured(true);
        
        // Convert chunk duration to milliseconds
        const chunkDurationMs = chunkDurationSeconds 
          ? chunkDurationSeconds * 1000 
          : CHUNK_DURATION_OPTIONS.default * 1000;
        
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
          { transcriberService: 'whisper', transcriberThresholds: { whisper: 0.30, deepgram: 0.30 } }, // meetingSettings
          undefined, // meetingId
          undefined, // onAudioActivity
          handleChunkProcessed, // onChunkProcessed - now passing actual callback
          handleChunkFiltered, // onChunkFiltered - now passing actual callback
          selectedMicrophoneId, // selectedDeviceId
          combinedStream, // externalStream
          audioFormat, // audioFormat - user preference
          chunkDurationMs // customChunkDurationMs - user preference
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
      setMicCaptured(false);
      setSystemAudioCaptured(false);
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
    setAudioSourceMode('microphone');
    setMicCaptured(false);
    setSystemAudioCaptured(false);
    sessionIdRef.current = null;
    currentMicIdRef.current = undefined;
    recordingStartTimeRef.current = 0;
    clearChunks();

    // Stop system audio stream if active
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach(track => track.stop());
      systemStreamRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    releaseWakeLock();
    console.log("Scribe: Recording state reset complete");
  }, [clearChunks]);

  // Switch audio source mode while recording
  const switchAudioSourceLive = useCallback(async (newMode: AudioSourceMode): Promise<void> => {
    if (!isRecording || isSwitchingAudioSource) return;
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // Can't switch to system audio on mobile/iOS
    if (newMode === 'microphone_and_system' && (isMobile || isIOS)) {
      toast.error("System audio is not supported on mobile devices");
      return;
    }
    
    if (newMode === audioSourceMode) return;
    
    try {
      setIsSwitchingAudioSource(true);
      setConnectionStatus("Switching audio...");
      
      console.log(`🔄 Switching audio source from ${audioSourceMode} to ${newMode}`);
      
      // Stop current transcribers
      if (iPhoneTranscriberRef.current) {
        await iPhoneTranscriberRef.current.stopTranscription();
        iPhoneTranscriberRef.current = null;
      }
      if (desktopTranscriberRef.current) {
        await desktopTranscriberRef.current.stopTranscription();
        desktopTranscriberRef.current = null;
      }
      if (chromiumTranscriberRef.current) {
        await chromiumTranscriberRef.current.stopTranscription();
        chromiumTranscriberRef.current = null;
      }
      
      // Stop system audio if switching away from it
      if (systemStreamRef.current) {
        systemStreamRef.current.getTracks().forEach(track => track.stop());
        systemStreamRef.current = null;
        setSystemAudioCaptured(false);
      }
      
      // Update mode
      setAudioSourceMode(newMode);
      
      // Prepare new streams
      let combinedStream: MediaStream | undefined;
      
      if (newMode === 'microphone_and_system') {
        try {
          console.log('📺 Requesting system audio capture...');
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
          
          // Stop video tracks
          displayStream.getVideoTracks().forEach(track => track.stop());
          
          const audioTracks = displayStream.getAudioTracks();
          if (audioTracks.length > 0) {
            systemStreamRef.current = new MediaStream(audioTracks);
            setSystemAudioCaptured(true);
            console.log('✅ System audio captured successfully');
            
            // Get microphone stream
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: currentMicIdRef.current 
                ? { deviceId: { exact: currentMicIdRef.current } }
                : true
            });
            
            // Combine streams
            const audioContext = new AudioContext();
            const destination = audioContext.createMediaStreamDestination();
            
            const micSource = audioContext.createMediaStreamSource(micStream);
            const systemSource = audioContext.createMediaStreamSource(systemStreamRef.current);
            
            micSource.connect(destination);
            systemSource.connect(destination);
            
            combinedStream = destination.stream;
          } else {
            throw new Error("No system audio available");
          }
        } catch (error) {
          console.warn('⚠️ System audio capture failed:', error);
          toast.error("Failed to capture system audio");
          setAudioSourceMode('microphone');
          setSystemAudioCaptured(false);
        }
      }
      
      // Restart transcription with new audio source
      console.log('🖥️ Restarting Desktop Whisper transcription...');
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
        { transcriberService: 'whisper', transcriberThresholds: { whisper: 0.30, deepgram: 0.30 } }, // meetingSettings
        undefined, // meetingId
        undefined, // onAudioActivity
        handleChunkProcessed, // onChunkProcessed
        handleChunkFiltered, // onChunkFiltered
        currentMicIdRef.current, // selectedDeviceId
        combinedStream // externalStream
      );
      
      await desktopTranscriberRef.current.startTranscription();
      
      setConnectionStatus("Connected");
      toast.success(newMode === 'microphone_and_system' 
        ? "Now capturing microphone + system audio"
        : "Switched to microphone only"
      );
      
    } catch (error) {
      console.error("Failed to switch audio source:", error);
      toast.error("Failed to switch audio source");
      setConnectionStatus("Error");
    } finally {
      setIsSwitchingAudioSource(false);
    }
  }, [isRecording, isSwitchingAudioSource, audioSourceMode, handleTranscriptUpdate]);

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
    
    // Audio source states
    audioSourceMode,
    isSwitchingAudioSource,
    micCaptured,
    systemAudioCaptured,

    // Chunk tracking
    chunks,
    chunkStats: getStats(),
    clearChunks,

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
    switchAudioSourceLive,
  };
};
