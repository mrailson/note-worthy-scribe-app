import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StylePreviewsCache, GenerationProgress } from './types';
import { getAllStyleKeys } from './styleDefinitions';

export const useStyleGeneration = () => {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  const generateTranscriptHash = async (transcript: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(transcript);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const checkCache = async (meetingId: string, transcript: string): Promise<StylePreviewsCache | null> => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('style_previews, style_previews_generated_at, style_previews_transcript_hash')
        .eq('id', meetingId)
        .single();

      if (error) {
        console.error('Error checking cache:', error);
        return null;
      }

      if (!data?.style_previews || !data?.style_previews_generated_at || !data?.style_previews_transcript_hash) {
        return null;
      }

      // Check if transcript has changed
      const currentHash = await generateTranscriptHash(transcript);
      if (currentHash !== data.style_previews_transcript_hash) {
        console.log('Transcript has changed, cache invalid');
        return null;
      }

      // Check if cache is less than 24 hours old
      const cacheAge = Date.now() - new Date(data.style_previews_generated_at).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge > maxAge) {
        console.log('Cache is too old, will regenerate');
        return null;
      }

      return {
        previews: data.style_previews as Record<string, string>,
        generated_at: data.style_previews_generated_at,
        transcript_hash: data.style_previews_transcript_hash
      };
    } catch (err) {
      console.error('Error in checkCache:', err);
      return null;
    }
  };

  const generatePreviews = useCallback(async (
    meetingId: string,
    transcript: string,
    meetingContext: {
      title: string;
      date?: string;
      attendees?: string[];
      agenda?: string;
    }
  ) => {
    if (!transcript || transcript.length < 50) {
      setError('Transcript is too short to generate style previews');
      toast.error('Transcript is too short');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress({ current: 0, total: 10, currentStyle: 'Initialising...' });

    try {
      // Check cache first
      const cached = await checkCache(meetingId, transcript);
      if (cached) {
        console.log('Using cached previews');
        setPreviews(cached.previews);
        setIsGenerating(false);
        setProgress(null);
        toast.success('Loaded style previews from cache');
        return;
      }

      // Generate new previews
      setProgress({ current: 0, total: 10, currentStyle: 'Generating styles...' });
      
      console.log('Invoking generate-style-previews function...');
      
      const { data, error: functionError } = await supabase.functions.invoke('generate-style-previews', {
        body: {
          meetingId,
          transcript,
          meetingContext
        }
      });

      console.log('Function response:', { data, error: functionError });

      if (functionError) {
        console.error('Function invocation error:', functionError);
        throw new Error(functionError.message || 'Failed to generate style previews');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.success || !data?.previews) {
        throw new Error('Invalid response from style generation service');
      }

      setPreviews(data.previews);
      setProgress({ current: 10, total: 10, currentStyle: 'Complete' });
      
      const generatedCount = Object.keys(data.previews).length;
      if (data.errors && data.errors.length > 0) {
        toast.warning(`Generated ${generatedCount} of 10 styles. Some styles failed.`);
        console.error('Some styles failed:', data.errors);
      } else {
        toast.success(`Successfully generated ${generatedCount} professional note styles`);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate style previews';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Error generating previews:', err);
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  }, []);

  const clearCache = useCallback(async (meetingId: string) => {
    try {
      await supabase
        .from('meetings')
        .update({
          style_previews: null,
          style_previews_generated_at: null,
          style_previews_transcript_hash: null
        })
        .eq('id', meetingId);
      
      setPreviews({});
      toast.success('Cache cleared');
    } catch (err) {
      console.error('Error clearing cache:', err);
      toast.error('Failed to clear cache');
    }
  }, []);

  return {
    previews,
    isGenerating,
    error,
    progress,
    generatePreviews,
    clearCache
  };
};
