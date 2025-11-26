import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UploadedFile } from '@/types/ai4gp';

interface GenerateVideoOptions {
  title: string;
  slides: Array<{ content: string; notes: string }>;
  voiceId: string;
  uploadedFiles?: UploadedFile[];
}

export const useVideoGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateVideo = async (options: GenerateVideoOptions): Promise<string | null> => {
    setIsGenerating(true);
    setProgress(0);

    try {
      // Step 1: Generate narration for each slide (20% progress)
      setProgress(10);
      const narrations: string[] = [];

      for (let i = 0; i < options.slides.length; i++) {
        const slide = options.slides[i];
        const { data, error } = await supabase.functions.invoke('generate-slide-narration', {
          body: {
            slideNumber: i + 1,
            slideContent: slide.content,
            speakerNotes: slide.notes,
            voiceId: options.voiceId
          }
        });

        if (error) throw error;
        narrations.push(data.audioBase64);
        setProgress(10 + ((i + 1) / options.slides.length) * 30);
      }

      // Step 2: Create canvas and render slides (50% progress)
      setProgress(40);
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Step 3: Setup MediaRecorder (60% progress)
      setProgress(60);
      const stream = canvas.captureStream(30); // 30 FPS
      const audioContext = new AudioContext();
      const audioDestination = audioContext.createMediaStreamDestination();
      
      // Combine audio tracks
      for (const narrationBase64 of narrations) {
        const audioBlob = base64ToBlob(narrationBase64, 'audio/mpeg');
        const audioBuffer = await audioBlob.arrayBuffer();
        const decodedAudio = await audioContext.decodeAudioData(audioBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = decodedAudio;
        source.connect(audioDestination);
      }

      // Add audio track to stream
      if (audioDestination.stream.getAudioTracks().length > 0) {
        stream.addTrack(audioDestination.stream.getAudioTracks()[0]);
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // Step 4: Render slides and record (90% progress)
      setProgress(70);
      mediaRecorder.start();

      for (let i = 0; i < options.slides.length; i++) {
        const slide = options.slides[i];
        
        // Clear canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw title
        ctx.fillStyle = '#1a1a1a';
        ctx.font = 'bold 72px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(options.title, canvas.width / 2, 150);

        // Draw slide number
        ctx.font = '36px Arial';
        ctx.fillText(`Slide ${i + 1} of ${options.slides.length}`, canvas.width / 2, 220);

        // Draw content
        ctx.font = '48px Arial';
        ctx.textAlign = 'left';
        const lines = wrapText(ctx, slide.content, 1700);
        lines.forEach((line, idx) => {
          ctx.fillText(line, 100, 350 + idx * 60);
        });

        // Hold frame for duration based on narration length (approx 3 seconds per slide)
        await new Promise(resolve => setTimeout(resolve, 3000));
        setProgress(70 + ((i + 1) / options.slides.length) * 20);
      }

      mediaRecorder.stop();

      // Step 5: Create blob and URL (100% progress)
      await new Promise<void>((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          setProgress(100);
          resolve();
        };
      });

      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      return url;
    } catch (error) {
      console.error('Video generation error:', error);
      throw error;
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return {
    generateVideo,
    isGenerating,
    progress
  };
};

// Helper functions
function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine !== '') {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine.trim() !== '') {
    lines.push(currentLine.trim());
  }

  return lines;
}
