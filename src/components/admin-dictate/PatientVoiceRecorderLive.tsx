import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, MicOff, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { VoiceWaveform } from '@/components/translation/VoiceWaveform';

interface PatientVoiceRecorderLiveProps {
  onTranscription: (text: string) => void;
  language: string;
  disabled?: boolean;
  phrases: {
    tapToSpeak?: string;
    recording?: string;
    transcribing?: string;
    voiceError?: string;
    listening?: string;
    tapToStop?: string;
  };
  className?: string;
}

// Web Speech API language code mappings
const WEB_SPEECH_LANGUAGES: Record<string, string> = {
  'en': 'en-GB',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'pt': 'pt-PT',
  'it': 'it-IT',
  'nl': 'nl-NL',
  'pl': 'pl-PL',
  'ru': 'ru-RU',
  'ar': 'ar-SA',
  'zh': 'zh-CN',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'hi': 'hi-IN',
  'tr': 'tr-TR',
  'vi': 'vi-VN',
  'th': 'th-TH',
  'ro': 'ro-RO',
  'uk': 'uk-UA',
  'el': 'el-GR',
  'cs': 'cs-CZ',
  'hu': 'hu-HU',
  'sv': 'sv-SE',
  'da': 'da-DK',
  'fi': 'fi-FI',
  'no': 'nb-NO',
  'sk': 'sk-SK',
  'bg': 'bg-BG',
  'hr': 'hr-HR',
  'sl': 'sl-SI',
  'lt': 'lt-LT',
  'lv': 'lv-LV',
  'et': 'et-EE',
  'ms': 'ms-MY',
  'id': 'id-ID',
  'tl': 'fil-PH',
  'fa': 'fa-IR',
  'he': 'he-IL',
  'ur': 'ur-PK',
  'bn': 'bn-IN',
  'pa': 'pa-IN',
  'gu': 'gu-IN',
  'ta': 'ta-IN',
  'te': 'te-IN',
  'mr': 'mr-IN',
  'ne': 'ne-NP',
  'si': 'si-LK',
  'sw': 'sw-KE',
  'am': 'am-ET',
  'so': 'so-SO',
};

/**
 * Hybrid voice recorder component that provides real-time transcription feedback.
 * Uses Web Speech API for supported languages (live preview) with Whisper fallback.
 */
export const PatientVoiceRecorderLive: React.FC<PatientVoiceRecorderLiveProps> = ({
  onTranscription,
  language,
  disabled = false,
  phrases,
  className,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [useWebSpeech, setUseWebSpeech] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const accumulatedTextRef = useRef<string>('');

  // Detect iOS for special handling
  const isIOS = useCallback((): boolean => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  // Check Web Speech API support and language availability
  const isWebSpeechSupported = useCallback((): boolean => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    return !!SpeechRecognition;
  }, []);

  const getWebSpeechLang = useCallback((lang: string): string | null => {
    const normalised = lang.toLowerCase().split(/[-_]/)[0];
    return WEB_SPEECH_LANGUAGES[normalised] || null;
  }, []);

  // Determine if we can use Web Speech for this language
  useEffect(() => {
    const webSpeechLang = getWebSpeechLang(language);
    const canUseWebSpeech = isWebSpeechSupported() && !!webSpeechLang;
    setUseWebSpeech(canUseWebSpeech);
    console.log(`🎤 PatientVoiceRecorderLive: Language ${language} → Web Speech: ${canUseWebSpeech}, iOS: ${isIOS()}`);
  }, [language, isWebSpeechSupported, getWebSpeechLang, isIOS]);

  // Get the best supported MIME type for Whisper fallback
  const getSupportedMimeType = useCallback((): string => {
    const types = [
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }, []);

  // Start Web Speech recognition
  const startWebSpeech = useCallback(async () => {
    setError(null);
    setLiveTranscript('');
    accumulatedTextRef.current = '';

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      const webSpeechLang = getWebSpeechLang(language);
      recognition.lang = webSpeechLang || 'en-GB';
      
      // iOS Safari doesn't support continuous mode - it causes immediate failure
      // Also, interimResults can be problematic on iOS
      const isiOSDevice = isIOS();
      recognition.continuous = !isiOSDevice;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      console.log(`🎤 Starting Web Speech: lang=${recognition.lang}, continuous=${recognition.continuous}, iOS=${isiOSDevice}`);

      recognition.onstart = () => {
        setIsListening(true);
        console.log('🎤 Web Speech started successfully');
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        // Show interim results as live preview
        setLiveTranscript(interimTranscript);

        // When we get final results, accumulate them
        if (finalTranscript) {
          accumulatedTextRef.current += (accumulatedTextRef.current ? ' ' : '') + finalTranscript.trim();
          setLiveTranscript(''); // Clear interim as it's now final
        }
      };

      recognition.onerror = (event: any) => {
        console.error('🎤 Web Speech error:', event.error, event);
        if (event.error === 'not-allowed') {
          setError(phrases.voiceError || 'Microphone permission denied');
          setIsListening(false);
        } else if (event.error === 'network') {
          // iOS Safari often returns network error - fall back to Whisper
          console.log('🎤 Network error on iOS, may need fallback');
          setError(phrases.voiceError || 'Voice recognition unavailable');
          setIsListening(false);
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError(phrases.voiceError || 'Voice recognition error');
        }
      };

      recognition.onend = () => {
        console.log('🎤 Web Speech ended, isListening was:', isListening);
        // On iOS, recognition ends after each phrase - restart if still listening
        if (isiOSDevice && recognitionRef.current && isListening) {
          console.log('🎤 iOS: Restarting recognition');
          try {
            recognition.start();
          } catch (e) {
            console.log('🎤 iOS: Could not restart, user stopped');
            setIsListening(false);
          }
        }
      };

      // Start recognition directly - don't request mic permission separately on iOS
      // as this breaks the user gesture chain
      recognition.start();
      
    } catch (err: any) {
      console.error('🎤 Failed to start Web Speech:', err);
      setError(phrases.voiceError || 'Could not access microphone');
      setIsListening(false);
    }
  }, [language, getWebSpeechLang, phrases.voiceError, isIOS, isListening]);

  // Stop Web Speech and send accumulated text
  const stopWebSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    setIsListening(false);
    
    // Combine any remaining interim with accumulated final
    const finalText = (accumulatedTextRef.current + ' ' + liveTranscript).trim();
    setLiveTranscript('');
    
    if (finalText) {
      console.log('🎤 Web Speech final text:', finalText);
      onTranscription(finalText);
    }
    
    accumulatedTextRef.current = '';
  }, [liveTranscript, onTranscription]);

  // Start MediaRecorder (Whisper fallback)
  const startMediaRecorder = useCallback(async () => {
    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      streamRef.current = stream;
      
      const mimeType = getSupportedMimeType();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🎤 MediaRecorder stopped, processing...');
        await processWhisperRecording();
      };

      mediaRecorder.onerror = () => {
        setError(phrases.voiceError || 'Recording failed');
        stopMediaRecorder();
      };

      mediaRecorder.start(1000);
      setIsListening(true);
      console.log('🎤 MediaRecorder started (Whisper fallback)');
      
    } catch (err: any) {
      console.error('🎤 Failed to start recording:', err);
      setError(phrases.voiceError || 'Could not access microphone');
    }
  }, [getSupportedMimeType, phrases.voiceError]);

  // Stop MediaRecorder
  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsListening(false);
  }, []);

  // Process Whisper recording
  const processWhisperRecording = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const mimeType = audioChunksRef.current[0]?.type || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const { data, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
        body: {
          audio: base64Audio,
          mimeType,
          language,
        },
      });

      if (transcriptionError) {
        throw new Error(transcriptionError.message || 'Transcription failed');
      }

      const transcribedText = data?.text?.trim();
      
      if (transcribedText && transcribedText.length > 0) {
        console.log('🎤 Whisper transcription:', transcribedText);
        onTranscription(transcribedText);
      }
      
    } catch (err: any) {
      console.error('🎤 Whisper processing error:', err);
      setError(phrases.voiceError || 'Failed to transcribe');
    } finally {
      setIsProcessing(false);
      audioChunksRef.current = [];
    }
  }, [language, onTranscription, phrases.voiceError]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isListening) {
      // Stop
      if (useWebSpeech) {
        stopWebSpeech();
      } else {
        stopMediaRecorder();
      }
    } else {
      // Start
      if (useWebSpeech) {
        startWebSpeech();
      } else {
        startMediaRecorder();
      }
    }
  }, [isListening, useWebSpeech, stopWebSpeech, stopMediaRecorder, startWebSpeech, startMediaRecorder]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Check if recording is supported
  const isSupported = isWebSpeechSupported() || typeof MediaRecorder !== 'undefined';

  if (!isSupported) {
    return null;
  }

  const showLivePreview = isListening && useWebSpeech && (liveTranscript || accumulatedTextRef.current);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-stretch gap-2">
        <Button
          type="button"
          size="lg"
          variant={isListening ? 'destructive' : error ? 'outline' : 'outline'}
          className={cn(
            'h-full aspect-square transition-all relative',
            isListening && 'animate-pulse',
            error && 'border-destructive text-destructive'
          )}
          onClick={toggleRecording}
          disabled={disabled || isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isListening ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
        
        {/* Live waveform indicator for Whisper fallback mode */}
        {isListening && !useWebSpeech && (
          <div className="flex items-center px-3 bg-destructive/10 rounded-md">
            <VoiceWaveform isActive={true} className="text-destructive" />
          </div>
        )}
      </div>
      
      {/* Live transcription preview for Web Speech mode */}
      {showLivePreview && (
        <div className="p-2 bg-secondary/50 rounded-lg border border-border/50 animate-in fade-in-0 slide-in-from-bottom-2">
          <p className="text-xs text-muted-foreground mb-1">
            {phrases.listening || 'Listening...'}
          </p>
          <p className="text-sm leading-relaxed">
            {accumulatedTextRef.current && (
              <span className="text-foreground">{accumulatedTextRef.current} </span>
            )}
            {liveTranscript && (
              <span className="text-muted-foreground italic">{liveTranscript}</span>
            )}
          </p>
        </div>
      )}
      
      {/* Status text */}
      {(isListening || isProcessing || error) && !showLivePreview && (
        <span className={cn(
          'text-xs text-center',
          isListening && 'text-destructive',
          isProcessing && 'text-muted-foreground',
          error && 'text-destructive'
        )}>
          {isProcessing 
            ? (phrases.transcribing || 'Transcribing...')
            : isListening 
              ? (useWebSpeech 
                  ? (phrases.tapToStop || 'Tap to stop') 
                  : (phrases.recording || 'Recording...'))
              : error
          }
        </span>
      )}
    </div>
  );
};
