import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getLanguageByCode, ELEVENLABS_LANGUAGES } from '@/constants/elevenLabsLanguages';
import { downloadGPTranslationDOCX } from '@/utils/gpTranslationDocxExport';
import { preprocessTextForTTS } from '@/utils/ttsTextPreprocessor';

// Use any for Web Speech API to avoid type conflicts with global declarations
type WebSpeechRecognition = any;

const SPEECH_RECOGNITION_LOCALES: Record<string, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-PT',
  de: 'de-DE',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  ro: 'ro-RO',
  ar: 'ar-SA',
  hi: 'hi-IN',
  ur: 'ur-PK',
  pa: 'pa-IN',
  gu: 'gu-IN',
  bn: 'bn-BD',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  ne: 'ne-NP',
  tr: 'tr-TR',
  fa: 'fa-IR',
  he: 'he-IL',
  sv: 'sv-SE',
  no: 'no-NO',
  da: 'da-DK',
  fi: 'fi-FI',
  ru: 'ru-RU',
  uk: 'uk-UA',
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  vi: 'vi-VN',
  th: 'th-TH',
  id: 'id-ID',
  ms: 'ms-MY',
  tl: 'fil-PH',
  bg: 'bg-BG',
  hr: 'hr-HR',
  cs: 'cs-CZ',
  el: 'el-GR',
  hu: 'hu-HU',
  sk: 'sk-SK',
  sl: 'sl-SI',
  et: 'et-EE',
  lv: 'lv-LV',
  lt: 'lt-LT',
  sw: 'sw-KE',
  am: 'am-ET',
  so: 'so-SO',
  ti: 'ti-ER',
  yo: 'yo-NG',
  ig: 'ig-NG',
  ha: 'ha-NG',
  ku: 'ku-TR',
  ps: 'ps-AF',
};

const toSpeechRecognitionLocale = (languageCode: string) =>
  SPEECH_RECOGNITION_LOCALES[languageCode] ?? languageCode;

// ──────────────────────────────────────────────────────────────
// FIX 2 — Dynamic silence thresholds per language group.
// Non-English speakers routinely pause 4-6s mid-sentence while
// searching for words or code-switching. English (GP) can be
// shorter because staff tend to speak in short, direct phrases.
// ──────────────────────────────────────────────────────────────
const GP_SILENCE_MS = 3000;       // English — staff speak concisely
const PATIENT_SILENCE_MS = 5000;  // Non-English — allow longer thinking pauses

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
  silenceThreshold?: number; // override — if not supplied, uses dynamic GP/patient defaults
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
    silenceThreshold,          // optional manual override
    onSpeakerDetected,
    onError
  } = options;

  // FIX 2 — Pick the right silence threshold based on who is speaking
  const effectiveSilence = silenceThreshold ?? (speakerMode === 'gp' ? GP_SILENCE_MS : PATIENT_SILENCE_MS);

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');

  // FIX 3 — Expose pending (finalised but not-yet-sent) text so the UI can show it
  const [pendingTranscript, setPendingTranscript] = useState('');
  
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const audioQueueRef = useRef<{ text: string; languageCode: string }[]>([]);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const silenceThresholdRef = useRef(effectiveSilence);
  const isPlayingRef = useRef(false);
  const isListeningRef = useRef(false);
  const startListeningRef = useRef<() => Promise<void>>();
  const pendingTranscriptRef = useRef<string>('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync with values
  useEffect(() => {
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
    silenceThresholdRef.current = effectiveSilence;
  }, [volume, isMuted, effectiveSilence]);

  // ── Helper: clear the silence timer safely ──
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

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
    recognition.lang = speakerMode === 'gp' ? 'en-GB' : toSpeechRecognitionLocale(selectedLanguage);
    
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

  // Translate and let Google auto-detect the source language
  const translateTextAutoDetect = useCallback(
    async (text: string, toLang: string): Promise<{ translatedText: string; detectedSourceLanguage?: string }> => {
      try {
        const { data, error } = await supabase.functions.invoke('translate-text', {
          body: { text, targetLanguage: toLang },
        });

        if (error) throw error;

        return {
          translatedText: data.translatedText || text,
          detectedSourceLanguage: data.sourceLanguage,
        };
      } catch (err) {
        console.error('Auto-detect translation error:', err);
        onError?.('Translation failed. Please try again.');
        return { translatedText: text };
      }
    },
    [onError]
  );

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
    setPendingTranscript('');   // FIX 3 — clear pending display

    try {
      let englishText: string;
      let translatedText: string;
      let detectedSpeaker: 'gp' | 'patient' = speakerMode;

      if (autoDetect) {
        // Detect source language by translating to English WITHOUT providing a source.
        const autoEnglish = await translateTextAutoDetect(text, 'en');
        const detectedLang = autoEnglish.detectedSourceLanguage?.toLowerCase();

        if (detectedLang === 'en') {
          detectedSpeaker = 'gp';
        } else if (detectedLang) {
          detectedSpeaker = 'patient';
        }

        if (detectedSpeaker !== speakerMode) {
          onSpeakerDetected?.(detectedSpeaker);
        }

        if (detectedSpeaker === 'gp') {
          // GP spoke English -> translate to patient's language
          englishText = text;
          translatedText = await translateText(text, 'en', selectedLanguage);
          const cleanedTranslation = preprocessTextForTTS(translatedText, selectedLanguage);
          queueAudio(cleanedTranslation, selectedLanguage);
        } else {
          // Patient spoke (detected) -> translate to English
          translatedText = text;
          englishText = autoEnglish.translatedText || text;
        }
      } else if (speakerMode === 'gp') {
        // GP spoke English -> translate to patient's language
        englishText = text;
        translatedText = await translateText(text, 'en', selectedLanguage);
        const cleanedTranslation = preprocessTextForTTS(translatedText, selectedLanguage);
        queueAudio(cleanedTranslation, selectedLanguage);
      } else {
        // Patient spoke their language -> translate to English
        translatedText = text;
        englishText = await translateText(text, selectedLanguage, 'en');
      }

      const entry: ConversationEntry = {
        id: crypto.randomUUID(),
        speaker: detectedSpeaker,
        originalText: text,
        englishText,
        translatedText,
        languageCode: selectedLanguage,
        timestamp: new Date(),
        confidence: 0.9,
      };

      setConversation(prev => [...prev, entry]);
    } catch (err) {
      console.error('Processing error:', err);
      onError?.('Failed to process speech. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [speakerMode, selectedLanguage, translateText, translateTextAutoDetect, queueAudio, autoDetect, onSpeakerDetected, onError]);

  // Start listening
  const startListening = useCallback(async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          noiseSuppression: true,
          echoCancellation: true,
        },
      });

      const recognition = initSpeechRecognition();
      if (!recognition) return;

      // Use a ref to avoid stale-closure issues inside recognition callbacks
      isListeningRef.current = true;
      pendingTranscriptRef.current = '';
      setPendingTranscript('');   // FIX 3

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        console.log('Speech recognition started with language:', recognition.lang);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            pendingTranscriptRef.current += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Show both the finalised buffer AND the current interim text
        // so the receptionist can see the full sentence building up
        const displayText = (pendingTranscriptRef.current + interimTranscript).trim();
        setCurrentTranscript(displayText);

        // FIX 3 — Keep the pending state in sync so the UI can show it
        if (pendingTranscriptRef.current.trim()) {
          setPendingTranscript(pendingTranscriptRef.current.trim());
        }

        // Reset silence timer on EVERY result (interim or final)
        clearSilenceTimer();

        // If we have final results, start the silence countdown.
        // It will only fire if no further onresult events arrive.
        if (pendingTranscriptRef.current.trim()) {
          silenceTimerRef.current = setTimeout(() => {
            if (pendingTranscriptRef.current.trim()) {
              processCompletedSpeech(pendingTranscriptRef.current.trim());
              pendingTranscriptRef.current = '';
              setCurrentTranscript('');
              setPendingTranscript('');   // FIX 3
            }
          }, silenceThresholdRef.current);
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
          // ──────────────────────────────────────────────────────
          // FIX 1 — Reset the silence timer on auto-restart.
          // The restart itself proves the speaker hasn't finished,
          // so the countdown should begin fresh.
          // ──────────────────────────────────────────────────────
          clearSilenceTimer();

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
  }, [initSpeechRecognition, processCompletedSpeech, clearSilenceTimer, onError]);

  // Keep ref in sync so the effect below can call the latest version without re-running
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // ──────────────────────────────────────────────────────────────
  // FIX 4 — Flush pending buffer on speaker switch.
  // When speaker mode changes during an active session:
  //   • Process any buffered text under the PREVIOUS speaker
  //   • Then restart recognition with the new language
  // This prevents cross-attribution of speech.
  // ──────────────────────────────────────────────────────────────
  const prevSpeakerModeRef = useRef(speakerMode);

  useEffect(() => {
    if (!isListeningRef.current || !recognitionRef.current) {
      prevSpeakerModeRef.current = speakerMode;
      return;
    }

    const hadPendingText = pendingTranscriptRef.current.trim();
    const previousMode = prevSpeakerModeRef.current;
    prevSpeakerModeRef.current = speakerMode;

    // If there's buffered text from the previous speaker, process it first
    if (hadPendingText) {
      clearSilenceTimer();
      console.log(`Speaker switched ${previousMode} → ${speakerMode}, flushing pending: "${hadPendingText}"`);
      processCompletedSpeech(hadPendingText);
      pendingTranscriptRef.current = '';
      setCurrentTranscript('');
      setPendingTranscript('');
    }

    // Restart recognition with the new language
    console.log('Speaker mode or language changed, restarting recognition...');
    recognitionRef.current.onend = null; // prevent auto-restart loop
    recognitionRef.current.stop();
    recognitionRef.current = null;
    startListeningRef.current?.();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakerMode, selectedLanguage]);

  // Stop listening
  const stopListening = useCallback(() => {
    isListeningRef.current = false;

    clearSilenceTimer();
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setCurrentTranscript('');
    setPendingTranscript('');   // FIX 3
    pendingTranscriptRef.current = '';
  }, [clearSilenceTimer]);

  // Manual send - immediately process any pending transcript
  const manualSend = useCallback(() => {
    clearSilenceTimer();
    
    if (pendingTranscriptRef.current.trim()) {
      processCompletedSpeech(pendingTranscriptRef.current.trim());
      pendingTranscriptRef.current = '';
      setCurrentTranscript('');
      setPendingTranscript('');   // FIX 3
    }
  }, [processCompletedSpeech, clearSilenceTimer]);

  // Play audio for a specific text
  const playAudio = useCallback(async (text: string, languageCode: string) => {
    if (isMutedRef.current) {
      console.log('Audio muted, skipping playback');
      return;
    }

    // Stop any currently playing audio before starting new playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    audioQueueRef.current = [];

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
    setPendingTranscript('');   // FIX 3
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
      recognitionRef.current.lang = speakerMode === 'gp' ? 'en-GB' : toSpeechRecognitionLocale(selectedLanguage);
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
    pendingTranscript,    // FIX 3 — NEW: expose so the UI can show buffered text
    startListening,
    stopListening,
    manualSend,
    playAudio,
    stopAudio,
    clearConversation,
    exportConversation
  };
};
