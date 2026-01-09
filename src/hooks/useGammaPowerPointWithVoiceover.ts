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

interface SlideAudio {
  slideNumber: number;
  audioBase64: string;
  duration: number;
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

  const downloadAudioZip = async (audioFiles: SlideAudio[], title: string) => {
    // Create individual audio files and package them
    // For now, we'll download them as individual files with a simple approach
    const safeTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 30);
    
    for (const audio of audioFiles) {
      const byteCharacters = atob(audio.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeTitle}_Slide_${String(audio.slideNumber).padStart(2, '0')}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Small delay between downloads to prevent browser blocking
      await new Promise(resolve => setTimeout(resolve, 200));
    }
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

      // Phase 1: Generate PPTX with speaker notes via Gamma
      console.log('[Voiceover] Phase 1: Generating slides with speaker notes...');
      
      const { data: pptxData, error: pptxError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
        body: {
          topic,
          supportingContent,
          slideCount: 10,
          presentationType: 'Professional Healthcare Presentation',
          audience: 'healthcare professionals',
          includeDetailedNotes: true
        }
      });

      if (pptxError) {
        throw new Error(pptxError.message || 'Failed to generate presentation');
      }

      if (!pptxData?.success) {
        throw new Error(pptxData?.error || 'Presentation generation failed');
      }

      const slideCount = pptxData.slideCount || 10;

      // Phase 2: Generate narration scripts using Claude
      setCurrentPhase('scripts');
      console.log('[Voiceover] Phase 2: Generating narration scripts...');

      const { data: scriptsData, error: scriptsError } = await supabase.functions.invoke('generate-presentation-scripts', {
        body: {
          topic,
          content: supportingContent,
          slideCount
        }
      });

      if (scriptsError) {
        console.error('Script generation error:', scriptsError);
        // Continue without scripts - just download PPTX
        toast.warning('Could not generate voiceover scripts, downloading presentation only...');
        downloadBase64AsPptx(pptxData.pptxBase64, pptxData.title || topic);
        return;
      }

      const scripts: VoiceoverScript[] = scriptsData?.scripts || [];
      
      if (scripts.length === 0) {
        console.warn('No scripts generated, downloading presentation only...');
        toast.warning('No scripts generated, downloading presentation only...');
        downloadBase64AsPptx(pptxData.pptxBase64, pptxData.title || topic);
        return;
      }

      // Phase 3: Generate audio for each slide
      setCurrentPhase('audio');
      console.log('[Voiceover] Phase 3: Generating British English voiceover...');

      const audioFiles: SlideAudio[] = [];
      let successCount = 0;
      let failCount = 0;
      
      for (const script of scripts) {
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

          if (audioError) {
            console.error(`[Voiceover] Audio generation error for slide ${script.slideNumber}:`, audioError);
            failCount++;
            toast.error(`Failed to generate audio for slide ${script.slideNumber}`);
            continue;
          }

          if (audioData?.error) {
            console.error(`[Voiceover] Audio error response for slide ${script.slideNumber}:`, audioData.error);
            failCount++;
            continue;
          }

          if (audioData?.audioBase64) {
            audioFiles.push({
              slideNumber: script.slideNumber,
              audioBase64: audioData.audioBase64,
              duration: audioData.duration || 30
            });
            successCount++;
            console.log(`[Voiceover] Audio generated for slide ${script.slideNumber} (${successCount}/${scripts.length})`);
          } else {
            console.warn(`[Voiceover] No audio data for slide ${script.slideNumber}:`, audioData);
            failCount++;
          }
        } catch (err) {
          console.error(`[Voiceover] Failed to generate audio for slide ${script.slideNumber}:`, err);
          failCount++;
        }
      }
      
      console.log(`[Voiceover] Audio generation complete: ${successCount} success, ${failCount} failed`);

      // Phase 4: Package and download
      setCurrentPhase('packaging');
      console.log('[Voiceover] Phase 4: Packaging downloads...');

      // Download PPTX first
      downloadBase64AsPptx(pptxData.pptxBase64, pptxData.title || topic);

      // Then download audio files
      if (audioFiles.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause between downloads
        await downloadAudioZip(audioFiles, pptxData.title || topic);
        toast.success(`Presentation and ${audioFiles.length} audio files downloaded!`);
      } else {
        toast.success('Presentation downloaded! (Audio generation was skipped)');
      }

    } catch (error) {
      console.error('Full presentation generation failed:', error);
      toast.error('Generation failed. Trying basic PowerPoint...');
      
      // Fallback to basic Gamma generation
      try {
        const { topic, supportingContent } = prepareContentForGamma(content, title);
        const { data } = await supabase.functions.invoke('generate-powerpoint-gamma', {
          body: {
            topic,
            supportingContent,
            slideCount: 10,
            presentationType: 'Professional Healthcare Presentation'
          }
        });
        
        if (data?.success && data?.pptxBase64) {
          downloadBase64AsPptx(data.pptxBase64, data.title || topic);
          toast.success('Basic presentation downloaded (without voiceover)');
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        toast.error('Failed to generate presentation');
      }
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
