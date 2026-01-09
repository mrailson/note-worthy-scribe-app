import { useState, useRef, useCallback, useEffect } from 'react';
import { showShadcnToast } from '@/utils/toastWrapper';
import { StandaloneTranscriber } from '@/utils/StandaloneTranscriber';
import { BrowserSpeechFallback } from '@/utils/BrowserSpeechFallback';
import { cleanTranscript } from '@/lib/transcriptCleaner';
import { NHS_DEFAULT_RULES } from '@/lib/nhsDefaultRules';

export const useStandaloneRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [cleanedTranscript, setCleanedTranscript] = useState('');
  const [showCleaned, setShowCleaned] = useState(true);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const [transcriptionService, setTranscriptionService] = useState<'whisper' | 'deepgram'>('whisper');
  const [cleaningEnabled, setCleaningEnabled] = useState(true);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [browserFallbackWordCount, setBrowserFallbackWordCount] = useState(0);
  const [useWhisperCount, setUseWhisperCount] = useState(false);

  const transcriberRef = useRef<StandaloneTranscriber | null>(null);
  const speechFallbackRef = useRef<BrowserSpeechFallback | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const volumeIntervalRef = useRef<NodeJS.Timeout>();

  // Switch to Whisper count after 30 seconds
  useEffect(() => {
    if (duration >= 30 && !useWhisperCount) {
      setUseWhisperCount(true);
    }
  }, [duration, useWhisperCount]);

  const startRecording = useCallback(async () => {
    try {
      // Start browser speech recognition as fallback for immediate feedback
      speechFallbackRef.current = new BrowserSpeechFallback(
        (text: string) => {
          setTranscript(prev => {
            // Don't duplicate if it's the same text
            if (prev.includes(text.replace(' [processing...]', ''))) return prev;
            
            const newTranscript = prev + (prev ? ' ' : '') + text;
            
            // Update browser fallback word count
            const wordCount = newTranscript.trim().split(/\s+/).filter(w => w.length > 0).length;
            setBrowserFallbackWordCount(wordCount);
            
            // Apply NHS cleaning if enabled (only for final results)
            if (cleaningEnabled && !text.includes('[processing...]')) {
              const cleaned = cleanTranscript(newTranscript, NHS_DEFAULT_RULES);
              setCleanedTranscript(cleaned.cleaned);
            }
            
            return newTranscript;
          });
        },
        (error: string) => {
          console.log('Browser speech fallback error:', error);
        }
      );

      if (speechFallbackRef.current.isSupported()) {
        speechFallbackRef.current.start();
      }

      transcriberRef.current = new StandaloneTranscriber({
        service: transcriptionService,
        onTranscript: (text: string) => {
          setTranscript(prev => {
            const newTranscript = prev + (prev ? ' ' : '') + text;
            
            // Apply NHS cleaning if enabled
            if (cleaningEnabled) {
              const cleaned = cleanTranscript(newTranscript, NHS_DEFAULT_RULES);
              setCleanedTranscript(cleaned.cleaned);
            }
            
            return newTranscript;
          });
        },
        onTranscribing: (transcribing: boolean) => {
          setIsTranscribing(transcribing);
        },
        onError: (error: string) => {
          showShadcnToast({
            title: "Transcription Error",
            description: error,
            variant: "destructive",
            section: 'meeting_manager'
          });
        },
        onVolumeChange: (vol: number) => {
          setVolume(vol);
        }
      });

      await transcriberRef.current.start();
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      showShadcnToast({
        title: "Recording Started",
        description: `Using ${transcriptionService.charAt(0).toUpperCase() + transcriptionService.slice(1)} with browser speech fallback`,
        section: 'meeting_manager'
      });

    } catch (error) {
      showShadcnToast({
        title: "Recording Failed",
        description: error instanceof Error ? error.message : "Failed to start recording",
        variant: "destructive",
        section: 'meeting_manager'
      });
    }
  }, [transcriptionService, cleaningEnabled]);

  const stopRecording = useCallback(async () => {
    if (transcriberRef.current) {
      await transcriberRef.current.stop();
      transcriberRef.current = null;
    }

    if (speechFallbackRef.current) {
      speechFallbackRef.current.stop();
      speechFallbackRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsRecording(false);
    setIsPaused(false);
    setIsTranscribing(false);
    setVolume(0);

    showShadcnToast({
      title: "Recording Stopped",
      description: "Transcription completed",
      section: 'meeting_manager'
    });
  }, []);

  const pauseRecording = useCallback(async () => {
    if (transcriberRef.current) {
      await transcriberRef.current.pause();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsPaused(true);
    setVolume(0);
  }, []);

  const resumeRecording = useCallback(async () => {
    if (transcriberRef.current) {
      await transcriberRef.current.resume();
    }

    // Resume timer
    timerRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    setIsPaused(false);
  }, []);

  const toggleMute = useCallback(async () => {
    if (transcriberRef.current) {
      await transcriberRef.current.toggleMute();
      setIsMuted(prev => !prev);
    }
  }, []);

  const toggleTranscriptionService = useCallback(() => {
    if (!isRecording) {
      setTranscriptionService(prev => prev === 'whisper' ? 'deepgram' : 'whisper');
    }
  }, [isRecording]);

  const toggleCleaning = useCallback(() => {
    setCleaningEnabled(prev => !prev);
    
    // Re-clean current transcript if enabling
    if (!cleaningEnabled && transcript) {
      const cleaned = cleanTranscript(transcript, NHS_DEFAULT_RULES);
      setCleanedTranscript(cleaned.cleaned);
    }
  }, [cleaningEnabled, transcript]);

  const toggleShowCleaned = useCallback(() => {
    setShowCleaned(prev => !prev);
  }, []);

  const exportTranscript = useCallback(() => {
    const textToExport = showCleaned && cleaningEnabled ? cleanedTranscript : transcript;
    
    if (!textToExport.trim()) {
      showShadcnToast({
        title: "No Content",
        description: "No transcript available to export",
        variant: "destructive",
        section: 'meeting_manager'
      });
      return;
    }

    const blob = new Blob([textToExport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showShadcnToast({
      title: "Transcript Exported",
      description: "File saved to downloads",
      section: 'meeting_manager'
    });
  }, [transcript, cleanedTranscript, showCleaned, cleaningEnabled]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setCleanedTranscript('');
    setDuration(0);
    setBrowserFallbackWordCount(0);
    setUseWhisperCount(false);
    
    showShadcnToast({
      title: "Transcript Cleared",
      description: "All content has been cleared",
      section: 'meeting_manager'
    });
  }, []);

  return {
    isRecording,
    isPaused,
    isMuted,
    transcript,
    cleanedTranscript,
    showCleaned,
    duration,
    volume,
    transcriptionService,
    cleaningEnabled,
    isTranscribing,
    browserFallbackWordCount,
    useWhisperCount,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    toggleMute,
    toggleTranscriptionService,
    toggleCleaning,
    toggleShowCleaned,
    exportTranscript,
    clearTranscript
  };
};