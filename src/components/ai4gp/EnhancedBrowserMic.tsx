import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrowserSpeechTranscriber, TranscriptData } from '@/utils/BrowserSpeechTranscriber';

interface EnhancedBrowserMicProps {
  onTranscriptUpdate: (text: string) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export interface EnhancedBrowserMicRef {
  clearTranscript: () => void;
}

type MicState = 'idle' | 'recording' | 'muted';

export const EnhancedBrowserMic = forwardRef<EnhancedBrowserMicRef, EnhancedBrowserMicProps>(({
  onTranscriptUpdate,
  onRecordingStart,
  onRecordingStop,
  disabled = false,
  className = '',
  compact = false
}, ref) => {
  const [micState, setMicState] = useState<MicState>('idle');
  const [audioLevels, setAudioLevels] = useState<number[]>([0.2, 0.3, 0.5, 0.3, 0.2]);
  const [fullTranscript, setFullTranscript] = useState('');
  
  const transcriberRef = useRef<BrowserSpeechTranscriber | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const accumulatedTextRef = useRef('');

  const handleTranscription = useCallback((data: TranscriptData) => {
    if (data.is_final) {
      // Append final text to accumulated ref
      const newAccumulated = accumulatedTextRef.current 
        ? `${accumulatedTextRef.current} ${data.text}` 
        : data.text;
      accumulatedTextRef.current = newAccumulated;
      setFullTranscript(newAccumulated);
      onTranscriptUpdate(newAccumulated);
    } else {
      // For interim: show accumulated + current partial (uses ref to avoid stale closure)
      const previewText = accumulatedTextRef.current 
        ? `${accumulatedTextRef.current} ${data.text}` 
        : data.text;
      onTranscriptUpdate(previewText);
    }
  }, [onTranscriptUpdate]);

  const handleError = useCallback((error: string) => {
    console.error('Browser speech error:', error);
    setMicState('idle');
    
    if (!error.includes('no-speech') && !error.includes('network')) {
      if (error.includes('not-allowed')) {
        alert('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.includes('not supported')) {
        alert('Speech recognition not supported in this browser. Try Chrome or Edge.');
      }
    }
  }, []);

  const handleStatusChange = useCallback((newStatus: string) => {
    console.log('Status:', newStatus);
  }, []);

  const updateAudioLevels = useCallback(() => {
    if (!analyserRef.current || micState !== 'recording') {
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Sample 5 frequency bands for the waveform bars
    const bands = 5;
    const bandSize = Math.floor(dataArray.length / bands);
    const levels: number[] = [];

    for (let i = 0; i < bands; i++) {
      let sum = 0;
      for (let j = 0; j < bandSize; j++) {
        sum += dataArray[i * bandSize + j];
      }
      // Normalise to 0-1 range with minimum height
      const avg = sum / bandSize / 255;
      levels.push(Math.max(0.15, Math.min(1, avg * 2.5 + 0.15)));
    }

    setAudioLevels(levels);
    animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
  }, [micState]);

  const startAudioAnalysis = useCallback(async () => {
    try {
      // Clean up any existing audio context first to prevent memory leaks
      if (audioContextRef.current) {
        try {
          await audioContextRef.current.close();
        } catch {}
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      analyserRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      streamRef.current = stream;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.7;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
    } catch (error) {
      console.error('Error starting audio analysis:', error);
    }
  }, [updateAudioLevels]);

  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevels([0.2, 0.3, 0.5, 0.3, 0.2]);
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled) return;

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser. Please use Chrome or Edge.');
      }

      await startAudioAnalysis();
      
      transcriberRef.current = new BrowserSpeechTranscriber(
        handleTranscription,
        handleError,
        handleStatusChange
      );

      await transcriberRef.current.startTranscription();
      setMicState('recording');
      onRecordingStart?.();
      
    } catch (error: any) {
      console.error('Error starting browser speech recognition:', error);
      handleError(error.message || 'Failed to start speech recognition');
      stopAudioAnalysis();
    }
  }, [disabled, startAudioAnalysis, stopAudioAnalysis, handleTranscription, handleError, handleStatusChange, onRecordingStart]);

  const stopRecording = useCallback(() => {
    if (transcriberRef.current) {
      transcriberRef.current.stopTranscription();
      transcriberRef.current = null;
    }
    
    stopAudioAnalysis();
    setMicState('idle');
    onRecordingStop?.();
  }, [stopAudioAnalysis, onRecordingStop]);

  const toggleMute = useCallback(() => {
    if (micState === 'recording') {
      // Mute: pause the stream tracks AND stop recognition
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      // Pause speech recognition to stop transcribing
      if (transcriberRef.current) {
        transcriberRef.current.pauseTranscription();
      }
      setMicState('muted');
    } else if (micState === 'muted') {
      // Unmute: resume the stream tracks AND restart recognition
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      // Resume speech recognition
      if (transcriberRef.current) {
        transcriberRef.current.resumeTranscription();
      }
      setMicState('recording');
      // Restart audio visualisation
      if (analyserRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
      }
    }
  }, [micState, updateAudioLevels]);

  const handleMainClick = useCallback(() => {
    if (micState === 'idle') {
      startRecording();
    } else {
      toggleMute();
    }
  }, [micState, startRecording, toggleMute]);

  const clearTranscript = useCallback(() => {
    accumulatedTextRef.current = '';
    setFullTranscript('');
    onTranscriptUpdate('');
  }, [onTranscriptUpdate]);

  useImperativeHandle(ref, () => ({
    clearTranscript
  }));

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
      }
      stopAudioAnalysis();
    };
  }, [stopAudioAnalysis]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && micState !== 'idle') {
        stopRecording();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [micState, stopRecording]);

  const renderContent = () => {
    const iconSize = compact ? "w-5 h-5" : "w-12 h-12";
    const waveformHeight = compact ? "h-5" : "h-12";
    const waveformMaxHeight = compact ? 20 : 48;
    const barWidth = compact ? "w-0.5" : "w-1.5";
    
    if (micState === 'idle') {
      return <Mic className={iconSize} />;
    }
    
    if (micState === 'muted') {
      return <MicOff className={iconSize} />;
    }

    // Recording state - show waveform
    return (
      <div className={cn("flex items-center justify-center gap-0.5", waveformHeight)}>
        {audioLevels.map((level, i) => (
          <div
            key={i}
            className={cn(barWidth, "bg-white rounded-full transition-all duration-75")}
            style={{
              height: `${Math.max(compact ? 4 : 8, level * waveformMaxHeight)}px`,
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
    );
  };

  const getButtonStyles = () => {
    if (micState === 'recording') {
      return 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30';
    }
    if (micState === 'muted') {
      return 'bg-amber-500 hover:bg-amber-600 text-white';
    }
    return 'hover:bg-accent';
  };

  const getTooltip = () => {
    if (micState === 'recording') return 'Click to mute';
    if (micState === 'muted') return 'Click to unmute';
    return 'Start voice input';
  };

  const buttonSize = compact ? "h-10 w-10" : "h-20 w-20";
  const stopButtonSize = compact ? "h-4 w-4" : "h-6 w-6";
  const stopIconSize = compact ? "w-2 h-2" : "w-3 h-3";

  return (
    <div className={cn('relative', className)}>
      <Button
        variant={micState === 'idle' ? 'ghost' : 'default'}
        size="sm"
        className={cn(
          "p-0 transition-all duration-200 rounded-lg",
          buttonSize,
          getButtonStyles()
        )}
        onClick={handleMainClick}
        disabled={disabled}
        title={getTooltip()}
        aria-pressed={micState !== 'idle'}
      >
        <div className="flex flex-col items-center justify-center gap-1">
          {renderContent()}
          {/* State label inside button - hide in compact mode */}
          {!compact && micState !== 'idle' && (
            <span className="text-[10px] font-medium opacity-90">
              {micState === 'recording' ? 'Recording' : 'Muted'}
            </span>
          )}
        </div>
      </Button>

      {/* Stop button - shown when recording or muted */}
      {micState !== 'idle' && (
        <Button
          variant="destructive"
          size="sm"
          className={cn("absolute -top-1 -right-1 p-0 rounded-full shadow-md", stopButtonSize)}
          onClick={stopRecording}
          title="Stop recording"
        >
          <X className={stopIconSize} />
        </Button>
      )}
    </div>
  );
});

EnhancedBrowserMic.displayName = "EnhancedBrowserMic";
