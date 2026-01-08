import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getLanguageByCode, ELEVENLABS_LANGUAGES } from '@/constants/elevenLabsLanguages';
import { downloadGPTranslationDOCX } from '@/utils/gpTranslationDocxExport';
import { preprocessTextForTTS } from '@/utils/ttsTextPreprocessor';

// Use any for Web Speech API to avoid type conflicts with global declarations
type WebSpeechRecognition = any;
export interface ConversationEntry {
  id: string;
  speaker: 'gp' | 'patient';
  originalText: string;
  englishText: string;
  translatedText: string;
  languageCode: string;
  timestamp: Date;
  confidence?: number;
  audioPlayed?: boolean;
}

interface UseGPTranslationOptions {
  selectedLanguage: string;
  speakerMode: 'gp' | 'patient';
  autoDetect: boolean;
  volume: number;
  isMuted: boolean;
  onSpeakerDetected?: (speaker: 'gp' | 'patient') => void;
  onError?: (error: string) => void;
}

export const useGPTranslation = (options: UseGPTranslationOptions) => {
  const {
    selectedLanguage,
    speakerMode,
    autoDetect,
    volume,
    isMuted,
    onSpeakerDetected,
    onError
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const audioQueueRef = useRef<{ text: string; languageCode: string }[]>([]);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);

  // Keep refs in sync with values
  useEffect(() => {
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
  }, [volume, isMuted]);

  // Initialize speech recognition
  const initSpeechRecognition = useCallback((): WebSpeechRecognition | null => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      onError?.('Speech recognition is not supported in this browser. Please use Chrome.');
      return null;
    }

    const recognition = new SpeechRecognitionAPI();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
    // Set language based on speaker mode
    recognition.lang = speakerMode === 'gp' ? 'en-GB' : selectedLanguage;
    
    return recognition;
  }, [speakerMode, selectedLanguage, onError]);

  // Translate text using Google Translate API
  const translateText = useCallback(async (text: string, fromLang: string, toLang: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: { text, targetLanguage: toLang, sourceLanguage: fromLang }
      });

      if (error) throw error;
      return data.translatedText || text;
    } catch (err) {
      console.error('Translation error:', err);
      onError?.('Translation failed. Please try again.');
      return text;
    }
  }, [onError]);

  // Generate speech using ElevenLabs
  const generateSpeech = useCallback(async (text: string, languageCode: string): Promise<string | null> => {
    try {
      const langConfig = getLanguageByCode(languageCode) || getLanguageByCode('en');

      const { data, error } = await supabase.functions.invoke('gp-translation-tts', {
        body: {
          text,
          languageCode,
          voiceId: langConfig?.voiceId,
        },
      });

      if (error) throw error;
      return data?.audioContent ?? null;
    } catch (err) {
      console.error('TTS error:', err);
      return null;
    }
  }, []);

  // Play audio from base64
  const playAudioFromBase64 = useCallback(async (base64Audio: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Clean up any previous object URL
        if (audioObjectUrlRef.current) {
          URL.revokeObjectURL(audioObjectUrlRef.current);
          audioObjectUrlRef.current = null;
        }

        // Convert base64 to a blob URL (avoids CSP issues with data: URIs)
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        audioObjectUrlRef.current = url;

        const cleanup = () => {
          if (audioObjectUrlRef.current === url) {
            audioObjectUrlRef.current = null;
          }
          URL.revokeObjectURL(url);
        };

        const audio = new Audio(url);
        audioRef.current = audio;

        const volumeValue = Math.max(0, Math.min(1, isMutedRef.current ? 0 : volumeRef.current));
        audio.volume = volumeValue;

        audio.onended = () => {
          cleanup();
          setIsSpeaking(false);
          resolve();
        };

        audio.onerror = (e) => {
          cleanup();
          console.error('Audio playback error:', e);
          setIsSpeaking(false);
          reject(e);
        };

        setIsSpeaking(true);
        audio.play().catch((e) => {
          cleanup();
          console.error('Audio play() failed:', e);
          setIsSpeaking(false);
          reject(e);
        });
      } catch (err) {
        console.error('Audio setup error:', err);
        setIsSpeaking(false);
        reject(err);
      }
    });
  }, []);

  // Process audio queue
  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;

    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const item = audioQueueRef.current.shift();
      if (item && !isMutedRef.current) {
        const audioContent = await generateSpeech(item.text, item.languageCode);
        if (audioContent) {
          await playAudioFromBase64(audioContent);
        }
      }
    }

    isPlayingRef.current = false;
  }, [generateSpeech, playAudioFromBase64]);

  // Add to audio queue
  const queueAudio = useCallback((text: string, languageCode: string) => {
    audioQueueRef.current.push({ text, languageCode });
    processAudioQueue();
  }, [processAudioQueue]);

  // Process completed speech
  const processCompletedSpeech = useCallback(async (text: string) => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setCurrentTranscript('');

    try {
      let englishText: string;
      let translatedText: string;
      let detectedSpeaker = speakerMode;

      if (speakerMode === 'gp') {
        // GP spoke English -> translate to patient's language
        englishText = text;
        translatedText = await translateText(text, 'en', selectedLanguage);
        // Clean up text for natural TTS delivery
        const cleanedTranslation = preprocessTextForTTS(translatedText);
        queueAudio(cleanedTranslation, selectedLanguage);
      } else {
        // Patient spoke their language -> translate to English
        translatedText = text;
        englishText = await translateText(text, selectedLanguage, 'en');
        // Clean up English text for natural TTS delivery
        const cleanedEnglish = preprocessTextForTTS(englishText);
        // Optionally play English for GP verification (can be toggled)
        // queueAudio(cleanedEnglish, 'en');
      }

      // Auto-detect speaker based on language if enabled
      if (autoDetect) {
        // Simple heuristic: if text contains mostly non-ASCII, likely patient
        const nonAsciiRatio = (text.match(/[^\x00-\x7F]/g) || []).length / text.length;
        if (nonAsciiRatio > 0.3 && speakerMode === 'gp') {
          detectedSpeaker = 'patient';
          onSpeakerDetected?.('patient');
        } else if (nonAsciiRatio < 0.1 && speakerMode === 'patient') {
          detectedSpeaker = 'gp';
          onSpeakerDetected?.('gp');
        }
      }

      const entry: ConversationEntry = {
        id: crypto.randomUUID(),
        speaker: detectedSpeaker,
        originalText: text,
        englishText,
        translatedText,
        languageCode: selectedLanguage,
        timestamp: new Date(),
        confidence: 0.9, // Could be enhanced with actual confidence scores
      };

      setConversation(prev => [...prev, entry]);
    } catch (err) {
      console.error('Processing error:', err);
      onError?.('Failed to process speech. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [speakerMode, selectedLanguage, translateText, queueAudio, autoDetect, onSpeakerDetected, onError]);

  // Start listening
  const startListening = useCallback(async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const recognition = initSpeechRecognition();
      if (!recognition) return;

      // Use a ref to avoid stale-closure issues inside recognition callbacks
      isListeningRef.current = true;

      let finalTranscript = '';
      let silenceTimer: ReturnType<typeof setTimeout> | null = null;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setCurrentTranscript(interimTranscript || finalTranscript);

        // Reset silence timer
        if (silenceTimer) clearTimeout(silenceTimer);

        // If we have final results, wait for silence then process
        if (finalTranscript.trim()) {
          silenceTimer = setTimeout(() => {
            if (finalTranscript.trim()) {
              processCompletedSpeech(finalTranscript.trim());
              finalTranscript = '';
            }
          }, 1500); // 1.5 second silence threshold
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);

        // Benign errors we can safely ignore (Chrome emits these during restarts)
        if (event.error === 'aborted' || event.error === 'no-speech') return;

        // Permission / service errors: stop trying to restart
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          isListeningRef.current = false;
          setIsListening(false);
        }

        onError?.(`Speech recognition error: ${event.error}`);
      };

      recognition.onend = () => {
        // Chrome often ends recognition after an utterance even in continuous mode.
        // If the user hasn't stopped listening, restart after a short delay.
        if (isListeningRef.current && recognitionRef.current === recognition) {
          window.setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // Ignore - may already be restarting
            }
          }, 250);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start listening:', err);
      isListeningRef.current = false;
      onError?.('Could not access microphone. Please check permissions.');
      throw err;
    }
  }, [initSpeechRecognition, processCompletedSpeech, onError]);

  // Stop listening
  const stopListening = useCallback(() => {
    isListeningRef.current = false;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setCurrentTranscript('');
  }, []);

  // Play audio for a specific text
  const playAudio = useCallback(async (text: string, languageCode: string) => {
    if (isMutedRef.current) {
      console.log('Audio muted, skipping playback');
      return;
    }

    try {
      setIsSpeaking(true);
      const audioContent = await generateSpeech(text, languageCode);
      if (audioContent) {
        await playAudioFromBase64(audioContent);
      } else {
        setIsSpeaking(false);
        onError?.('Could not generate audio');
      }
    } catch (err) {
      console.error('Play audio error:', err);
      setIsSpeaking(false);
      onError?.('Audio playback failed. Please check your browser audio permissions.');
    }
  }, [generateSpeech, playAudioFromBase64, onError]);

  // Stop audio
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    audioQueueRef.current = [];
    setIsSpeaking(false);
  }, []);

  // Clear conversation
  const clearConversation = useCallback(() => {
    setConversation([]);
    setCurrentTranscript('');
    stopAudio();
  }, [stopAudio]);

  // Track session start time
  const sessionStartRef = useRef<Date>(new Date());

  // Export conversation as formatted Word document
  const exportConversation = useCallback(async () => {
    if (conversation.length === 0) return;

    const firstEntry = conversation[0];
    const langConfig = ELEVENLABS_LANGUAGES.find(l => l.code === firstEntry.languageCode);
    const gpExchanges = conversation.filter(e => e.speaker === 'gp').length;
    const patientExchanges = conversation.filter(e => e.speaker === 'patient').length;

    const sessionEnd = new Date();
    const sessionDurationSeconds = Math.round((sessionEnd.getTime() - sessionStartRef.current.getTime()) / 1000);

    await downloadGPTranslationDOCX(
      {
        sessionStart: sessionStartRef.current,
        sessionEnd,
        targetLanguageCode: firstEntry.languageCode,
        targetLanguageName: langConfig?.name || firstEntry.languageCode,
        totalExchanges: conversation.length,
        gpExchanges,
        patientExchanges,
        sessionDurationSeconds
      },
      conversation.map(entry => ({
        id: entry.id,
        speaker: entry.speaker,
        englishText: entry.englishText,
        translatedText: entry.translatedText,
        timestamp: entry.timestamp
      }))
    );
  }, [conversation]);

  // Update recognition language when speaker mode changes
  useEffect(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.lang = speakerMode === 'gp' ? 'en-GB' : selectedLanguage;
    }
  }, [speakerMode, selectedLanguage, isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      stopAudio();
    };
  }, [stopListening, stopAudio]);

  return {
    isListening,
    isProcessing,
    isSpeaking,
    conversation,
    currentTranscript,
    startListening,
    stopListening,
    playAudio,
    stopAudio,
    clearConversation,
    exportConversation
  };
};
