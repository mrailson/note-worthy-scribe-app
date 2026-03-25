import { useState, useRef, useCallback, useEffect } from 'react';

export type VoicePreset = 'elderly_female' | 'elderly_male' | 'clinician';

interface SpeakOptions {
  voicePreset?: VoicePreset;
  speed?: number;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}

export function useElevenLabsTTS() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stop();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    if (isMountedRef.current) {
      setIsPlaying(false);
      setIsLoading(false);
    }
  }, [cleanup]);

  const speak = useCallback(async (text: string, options: SpeakOptions = {}) => {
    cleanup();
    setIsLoading(true);
    setError(null);
    setIsPlaying(false);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          text,
          voice_preset: options.voicePreset || 'elderly_female',
          speed: options.speed ?? 0.85,
          stability: options.stability ?? 0.6,
          similarity_boost: options.similarityBoost ?? 0.78,
          style: options.style ?? 0.35,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'TTS request failed' }));
        throw new Error(errData.error || `TTS error: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener('ended', () => {
        if (isMountedRef.current) setIsPlaying(false);
      });

      audio.addEventListener('error', () => {
        if (isMountedRef.current) {
          setIsPlaying(false);
          setError('Audio playback failed');
        }
      });

      if (isMountedRef.current) {
        setIsLoading(false);
        setIsPlaying(true);
      }

      await audio.play();
    } catch (err: any) {
      console.error('ElevenLabs TTS error:', err);
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsPlaying(false);
        setError(err.message || 'TTS failed');
      }
    }
  }, [cleanup]);

  return { speak, stop, isLoading, isPlaying, error };
}
