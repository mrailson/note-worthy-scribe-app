import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getLanguageByCode } from '@/constants/elevenLabsLanguages';

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
  const audioQueueRef = useRef<{ text: string; languageCode: string }[]>([]);
  const isPlayingRef = useRef(false);

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
        const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.volume = isMuted ? 0 : volume;
        
        audio.onended = () => {
          setIsSpeaking(false);
          resolve();
        };
        
        audio.onerror = (e) => {
          setIsSpeaking(false);
          reject(e);
        };
        
        setIsSpeaking(true);
        audio.play();
      } catch (err) {
        setIsSpeaking(false);
        reject(err);
      }
    });
  }, [volume, isMuted]);

  // Process audio queue
  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    
    while (audioQueueRef.current.length > 0) {
      const item = audioQueueRef.current.shift();
      if (item && !isMuted) {
        const audioContent = await generateSpeech(item.text, item.languageCode);
        if (audioContent) {
          await playAudioFromBase64(audioContent);
        }
      }
    }
    
    isPlayingRef.current = false;
  }, [generateSpeech, playAudioFromBase64, isMuted]);

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
        // Play translation in patient's language
        queueAudio(translatedText, selectedLanguage);
      } else {
        // Patient spoke their language -> translate to English
        translatedText = text;
        englishText = await translateText(text, selectedLanguage, 'en');
        // Optionally play English for GP verification (can be toggled)
        // queueAudio(englishText, 'en');
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

      let finalTranscript = '';
      let silenceTimer: NodeJS.Timeout | null = null;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
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

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          onError?.(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        // Restart if still supposed to be listening
        if (isListening && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Ignore - might already be running
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start listening:', err);
      onError?.('Could not access microphone. Please check permissions.');
      throw err;
    }
  }, [initSpeechRecognition, isListening, processCompletedSpeech, onError]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setCurrentTranscript('');
  }, []);

  // Play audio for a specific text
  const playAudio = useCallback(async (text: string, languageCode: string) => {
    if (isMuted) return;
    
    const audioContent = await generateSpeech(text, languageCode);
    if (audioContent) {
      await playAudioFromBase64(audioContent);
    }
  }, [generateSpeech, playAudioFromBase64, isMuted]);

  // Stop audio
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
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

  // Export conversation
  const exportConversation = useCallback(async () => {
    const content = conversation.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      return `[${time}] ${entry.speaker.toUpperCase()}:\nEnglish: ${entry.englishText}\nTranslated: ${entry.translatedText}\n`;
    }).join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation-session-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
