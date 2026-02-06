import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { stripMarkdown } from '@/utils/stripMarkdown';

export type VoiceoverPhase = 'slides' | 'scripts' | 'audio' | 'packaging' | null;

interface VoiceoverScript {
  slideNumber: number;
  title: string;
  narrationScript: string;
  estimatedDuration: number;
}

interface SlideWithAudio {
  slideNumber: number;
  title: string;
  bullets: string[];
  speakerNotes: string;
  audioBase64?: string;
}

export const useGammaPowerPointWithVoiceover = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<VoiceoverPhase>(null);

  const downloadBase64AsPptx = (base64: string, title: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { 
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50)}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadFromUrl = (url: string, title: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = `${title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50)}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const prepareContentForGamma = (content: string, title?: string): { topic: string; supportingContent: string } => {
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^##\s+(.+)$/m);
    const topic = title || titleMatch?.[1]?.slice(0, 100) || 'AI Generated Presentation';
    const supportingContent = stripMarkdown(content);
    return { topic, supportingContent };
  };

  /**
   * Generate a Gamma presentation FIRST, then add voiceover audio on top.
   * This ensures the high-quality Gamma slides are always used as the base,
   * with voiceover audio embedded alongside speaker notes.
   */
  const generateWithGammaAndVoiceover = async (
    content: string, 
    title?: string,
    voiceId: string = 'JBFqnCBsd6RMkjVDRZzb', // George - British Male Professional
    slideCount: number = 4
  ) => {
    if (!content?.trim()) {
      toast.error('No content to generate presentation from');
      return;
    }

    // Clamp slide count between 4 and 30 (Presentation Studio supports up to 30)
    const validSlideCount = Math.min(30, Math.max(4, slideCount));

    setIsGenerating(true);
    setCurrentPhase('slides');

    try {
      const { topic, supportingContent } = prepareContentForGamma(content, title);

      // ─── Phase 1: Generate via Gamma (start-and-poll) ───
      console.log('[Voiceover+Gamma] Phase 1: Starting Gamma generation...');

      const { data: startData, error: startError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
        body: {
          topic,
          supportingContent,
          slideCount: validSlideCount,
          presentationType: 'Professional Healthcare Presentation',
          audience: 'healthcare professionals',
          includeSpeakerNotes: true,
        },
      });

      if (startError) throw new Error(startError.message || 'Edge function error');

      let gammaData: any = null;

      // Handle direct result (legacy path)
      if (startData?.success && (startData?.downloadUrl || startData?.pptxBase64)) {
        gammaData = startData;
      } else if (startData?.generationId) {
        // Poll for completion
        const generationId = startData.generationId;
        console.log(`[Voiceover+Gamma] Generation started: ${generationId} — polling...`);

        const maxPollDuration = validSlideCount > 10
          ? 60_000 + validSlideCount * 10_000
          : 180_000; // 3 minutes for ≤10 slides
        const pollInterval = 5_000;
        const pollStart = Date.now();

        while (Date.now() - pollStart < maxPollDuration) {
          await new Promise(r => setTimeout(r, pollInterval));

          const { data: pollData, error: pollError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
            body: { action: 'poll', generationId },
          });

          if (pollError) {
            console.warn('[Voiceover+Gamma] Poll failed, retrying...', pollError);
            continue;
          }

          if (pollData?.status === 'completed') {
            gammaData = pollData;
            break;
          }

          if (pollData?.status === 'failed') {
            throw new Error(pollData.error || 'Gamma generation failed');
          }
        }
      } else {
        throw new Error(startData?.error || 'Failed to start Gamma generation');
      }

      if (!gammaData?.success) {
        throw new Error('Gamma generation failed — no result received');
      }

      // Download the Gamma PPTX first (user gets the high-quality version immediately)
      const gammaTitle = gammaData.title || topic;
      if (gammaData.downloadUrl) {
        downloadFromUrl(gammaData.downloadUrl, gammaTitle);
      } else if (gammaData.pptxBase64) {
        downloadBase64AsPptx(gammaData.pptxBase64, gammaTitle);
      }
      console.log('[Voiceover+Gamma] Gamma PPTX downloaded');

      // ─── Phase 2: Generate narration scripts ───
      setCurrentPhase('scripts');
      console.log('[Voiceover+Gamma] Phase 2: Generating narration scripts...');
      
      const { data: scriptsData, error: scriptsError } = await supabase.functions.invoke('generate-presentation-scripts', {
        body: {
          topic,
          content: supportingContent,
          slideCount: validSlideCount,
        },
      });

      if (scriptsError) {
        throw new Error(scriptsError.message || 'Failed to generate scripts');
      }

      const scripts: VoiceoverScript[] = scriptsData?.scripts || [];
      
      if (scripts.length === 0) {
        throw new Error('No slide content generated for voiceover');
      }

      console.log(`[Voiceover+Gamma] Generated ${scripts.length} narration scripts`);

      // ─── Phase 3: Generate audio for each slide ───
      setCurrentPhase('audio');
      console.log('[Voiceover+Gamma] Phase 3: Generating British English voiceover...');

      const slidesWithAudio: SlideWithAudio[] = [];
      
      for (const script of scripts) {
        const slide: SlideWithAudio = {
          slideNumber: script.slideNumber,
          title: script.title,
          bullets: script.narrationScript
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 10)
            .slice(0, 5),
          speakerNotes: script.narrationScript,
        };

        try {
          console.log(`[Voiceover+Gamma] Generating audio for slide ${script.slideNumber}/${scripts.length}...`);
          
          const { data: audioData, error: audioError } = await supabase.functions.invoke('generate-slide-narration', {
            body: {
              slideNumber: script.slideNumber,
              slideContent: script.title,
              speakerNotes: script.narrationScript,
              voiceId,
            },
          });

          if (!audioError && audioData?.audioBase64) {
            slide.audioBase64 = audioData.audioBase64;
            console.log(`[Voiceover+Gamma] Audio generated for slide ${script.slideNumber}`);
          } else {
            console.warn(`[Voiceover+Gamma] No audio for slide ${script.slideNumber}:`, audioError || 'No data');
          }
        } catch (err) {
          console.error(`[Voiceover+Gamma] Audio error for slide ${script.slideNumber}:`, err);
        }

        slidesWithAudio.push(slide);
      }

      const audioCount = slidesWithAudio.filter(s => s.audioBase64).length;
      console.log(`[Voiceover+Gamma] Audio generated for ${audioCount}/${scripts.length} slides`);

      // ─── Phase 4: Build PPTX with embedded notes and audio ───
      setCurrentPhase('packaging');
      console.log('[Voiceover+Gamma] Phase 4: Building PPTX with embedded audio...');

      const { data: pptxData, error: pptxError } = await supabase.functions.invoke('generate-pptx-with-audio', {
        body: {
          title: topic,
          slides: slidesWithAudio,
        },
      });

      if (pptxError) {
        throw new Error(pptxError.message || 'Failed to build PPTX with audio');
      }

      if (!pptxData?.success || !pptxData?.pptxBase64) {
        throw new Error(pptxData?.error || 'PPTX with audio generation failed');
      }

      // Download the voiceover PPTX as a separate file
      downloadBase64AsPptx(pptxData.pptxBase64, `${topic} (with voiceover)`);
      
      toast.success(`Presentation downloaded with ${scripts.length} slides, speaker notes${audioCount > 0 ? ` and ${audioCount} audio clips` : ''}!`);

    } catch (error) {
      console.error('[Voiceover+Gamma] Full presentation generation failed:', error);
      toast.error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
      setCurrentPhase(null);
    }
  };

  return { 
    generateWithGammaAndVoiceover, 
    isGenerating, 
    currentPhase 
  };
};