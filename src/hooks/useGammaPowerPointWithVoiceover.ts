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

  const prepareContentForGamma = (content: string, title?: string): { topic: string; supportingContent: string } => {
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^##\s+(.+)$/m);
    const topic = title || titleMatch?.[1]?.slice(0, 100) || 'AI Generated Presentation';
    const supportingContent = stripMarkdown(content);
    return { topic, supportingContent };
  };

  const generateFullPresentation = async (
    content: string, 
    title?: string,
    voiceId: string = 'JBFqnCBsd6RMkjVDRZzb' // George - British Male Professional
  ) => {
    if (!content?.trim()) {
      toast.error('No content to generate presentation from');
      return;
    }

    setIsGenerating(true);
    setCurrentPhase('slides');

    try {
      const { topic, supportingContent } = prepareContentForGamma(content, title);

      // Phase 1: Generate slide structure with scripts using Claude
      console.log('[Voiceover] Phase 1: Generating slide content and scripts...');
      
      const { data: scriptsData, error: scriptsError } = await supabase.functions.invoke('generate-presentation-scripts', {
        body: {
          topic,
          content: supportingContent,
          slideCount: 4
        }
      });

      if (scriptsError) {
        throw new Error(scriptsError.message || 'Failed to generate scripts');
      }

      const scripts: VoiceoverScript[] = scriptsData?.scripts || [];
      
      if (scripts.length === 0) {
        throw new Error('No slide content generated');
      }

      console.log(`[Voiceover] Generated ${scripts.length} slide scripts`);

      // Phase 2: Generate audio for each slide
      setCurrentPhase('audio');
      console.log('[Voiceover] Phase 2: Generating British English voiceover...');

      const slidesWithAudio: SlideWithAudio[] = [];
      
      for (const script of scripts) {
        const slide: SlideWithAudio = {
          slideNumber: script.slideNumber,
          title: script.title,
          bullets: script.narrationScript
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 10)
            .slice(0, 5), // Max 5 bullets per slide
          speakerNotes: script.narrationScript,
        };

        try {
          console.log(`[Voiceover] Generating audio for slide ${script.slideNumber}/${scripts.length}...`);
          
          const { data: audioData, error: audioError } = await supabase.functions.invoke('generate-slide-narration', {
            body: {
              slideNumber: script.slideNumber,
              slideContent: script.title,
              speakerNotes: script.narrationScript,
              voiceId
            }
          });

          if (!audioError && audioData?.audioBase64) {
            slide.audioBase64 = audioData.audioBase64;
            console.log(`[Voiceover] Audio generated for slide ${script.slideNumber}`);
          } else {
            console.warn(`[Voiceover] No audio for slide ${script.slideNumber}:`, audioError || 'No data');
          }
        } catch (err) {
          console.error(`[Voiceover] Audio error for slide ${script.slideNumber}:`, err);
        }

        slidesWithAudio.push(slide);
      }

      const audioCount = slidesWithAudio.filter(s => s.audioBase64).length;
      console.log(`[Voiceover] Audio generated for ${audioCount}/${scripts.length} slides`);

      // Phase 3: Build PPTX with embedded notes and audio
      setCurrentPhase('packaging');
      console.log('[Voiceover] Phase 3: Building PPTX with embedded notes and audio...');

      const { data: pptxData, error: pptxError } = await supabase.functions.invoke('generate-pptx-with-audio', {
        body: {
          title: topic,
          slides: slidesWithAudio
        }
      });

      if (pptxError) {
        throw new Error(pptxError.message || 'Failed to build PPTX');
      }

      if (!pptxData?.success || !pptxData?.pptxBase64) {
        throw new Error(pptxData?.error || 'PPTX generation failed');
      }

      // Download the final PPTX
      downloadBase64AsPptx(pptxData.pptxBase64, topic);
      
      toast.success(`Presentation downloaded with ${scripts.length} slides, speaker notes${audioCount > 0 ? ` and ${audioCount} audio clips` : ''}!`);

    } catch (error) {
      console.error('Full presentation generation failed:', error);
      toast.error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
      setCurrentPhase(null);
    }
  };

  return { 
    generateFullPresentation, 
    isGenerating, 
    currentPhase 
  };
};
