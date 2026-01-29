import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type VideoPhase = 'idle' | 'uploading' | 'generating' | 'polling' | 'downloading' | 'complete' | 'error';

interface UseInfographicVideoReturn {
  generateVideo: (imageBase64: string, orientation: 'portrait' | 'landscape', title?: string) => Promise<{ success: boolean; error?: string }>;
  isGenerating: boolean;
  currentPhase: VideoPhase;
  error: string | null;
  reset: () => void;
}

export const useInfographicVideo = (): UseInfographicVideoReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<VideoPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setCurrentPhase('idle');
    setError(null);
  }, []);

  const generateVideo = useCallback(async (
    imageBase64: string,
    orientation: 'portrait' | 'landscape',
    title?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsGenerating(true);
    setCurrentPhase('uploading');
    setError(null);

    try {
      console.log('Starting video generation from infographic...');
      
      // Extract base64 data without the data URL prefix if present
      let cleanBase64 = imageBase64;
      let mimeType = 'image/png';
      
      if (imageBase64.startsWith('data:')) {
        const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          cleanBase64 = matches[2];
        }
      }

      setCurrentPhase('generating');
      
      // Call the edge function with extended timeout
      const { data, error: functionError } = await supabase.functions.invoke('infographic-to-video', {
        body: {
          imageBase64: cleanBase64,
          mimeType,
          orientation,
          durationSeconds: 6,
        },
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to generate video');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Video generation failed');
      }

      const videoUrl = data.videoUrl;
      if (!videoUrl) {
        throw new Error('No video URL returned');
      }

      setCurrentPhase('downloading');
      console.log('Video generated, downloading...');

      // Download the video
      let blob: Blob;
      if (videoUrl.startsWith('data:')) {
        // Base64 video
        const base64Data = videoUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: 'video/mp4' });
      } else {
        // URL - fetch the video
        const response = await fetch(videoUrl);
        if (!response.ok) {
          throw new Error('Failed to download video');
        }
        blob = await response.blob();
      }

      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = title && title !== 'Infographic'
        ? `${title.replace(/[^a-zA-Z0-9]/g, '_')}_video.mp4`
        : `infographic_video_${new Date().toISOString().split('T')[0]}.mp4`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setCurrentPhase('complete');
      toast.success('Video downloaded successfully!');

      return { success: true };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate video';
      console.error('Video generation error:', errorMessage);
      setError(errorMessage);
      setCurrentPhase('error');
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generateVideo,
    isGenerating,
    currentPhase,
    error,
    reset,
  };
};
