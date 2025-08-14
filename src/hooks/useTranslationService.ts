import { useState, useRef, useCallback } from "react";
import { AudioQueueItem } from "@/types/gpscribe";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useTranslationService = () => {
  const [translationLanguage, setTranslationLanguage] = useState<string>('none');
  const [isTranslationEnabled, setIsTranslationEnabled] = useState(false);
  const [translations, setTranslations] = useState<any[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = useState(false);
  const [playedTranslations, setPlayedTranslations] = useState<Set<string>>(new Set());

  const audioQueueRef = useRef<AudioQueueItem[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const translateText = useCallback(async (text: string, targetLanguage: string) => {
    if (!text.trim() || targetLanguage === 'none') return null;

    try {
      setIsTranslating(true);
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: { text, targetLanguage }
      });

      if (error) throw error;

      const translationId = Date.now().toString();
      const newTranslation = {
        id: translationId,
        original: text,
        translated: data.translatedText,
        language: targetLanguage,
        timestamp: new Date().toISOString()
      };

      setTranslations(prev => [...prev, newTranslation]);

      if (autoSpeak && !isMuted) {
        addToAudioQueue(data.translatedText, targetLanguage, translationId);
      }

      return newTranslation;
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Translation failed');
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, [autoSpeak, isMuted]);

  const addToAudioQueue = useCallback((text: string, languageCode: string, id: string) => {
    audioQueueRef.current.push({ text, languageCode, id });
    if (!isCurrentlyPlaying) {
      processAudioQueue();
    }
  }, [isCurrentlyPlaying]);

  const processAudioQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0 || isCurrentlyPlaying || isMuted) return;

    setIsCurrentlyPlaying(true);
    const audioItem = audioQueueRef.current.shift();
    
    if (!audioItem) {
      setIsCurrentlyPlaying(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { 
          text: audioItem.text, 
          languageCode: audioItem.languageCode 
        }
      });

      if (error) throw error;

      const audio = new HTMLAudioElement();
      audio.src = data.audioUrl;
      currentAudioRef.current = audio;

      audio.onended = () => {
        setPlayedTranslations(prev => new Set(prev).add(audioItem.id));
        setIsCurrentlyPlaying(false);
        currentAudioRef.current = null;
        processAudioQueue(); // Process next item in queue
      };

      audio.onerror = () => {
        console.error('Audio playback error');
        setIsCurrentlyPlaying(false);
        currentAudioRef.current = null;
        processAudioQueue(); // Continue with next item
      };

      await audio.play();
    } catch (error) {
      console.error('Text-to-speech error:', error);
      setIsCurrentlyPlaying(false);
      processAudioQueue(); // Continue with next item
    }
  }, [isCurrentlyPlaying, isMuted]);

  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    setIsCurrentlyPlaying(false);
  }, []);

  const playTranslation = useCallback(async (translation: any) => {
    if (isMuted) return;

    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { 
          text: translation.translated, 
          languageCode: translation.language 
        }
      });

      if (error) throw error;

      const audio = new HTMLAudioElement();
      audio.src = data.audioUrl;
      
      audio.onended = () => {
        setPlayedTranslations(prev => new Set(prev).add(translation.id));
      };

      await audio.play();
    } catch (error) {
      console.error('Translation playback error:', error);
      toast.error('Failed to play translation');
    }
  }, [isMuted]);

  const clearTranslations = useCallback(() => {
    setTranslations([]);
    setPlayedTranslations(new Set());
    stopAudio();
  }, [stopAudio]);

  return {
    // States
    translationLanguage,
    isTranslationEnabled,
    translations,
    isTranslating,
    autoSpeak,
    isMuted,
    isCurrentlyPlaying,
    playedTranslations,

    // Actions
    setTranslationLanguage,
    setIsTranslationEnabled,
    setAutoSpeak,
    setIsMuted,
    translateText,
    playTranslation,
    clearTranslations,
    stopAudio
  };
};