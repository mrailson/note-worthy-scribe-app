import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type GenerationPhase = 'preparing' | 'generating' | 'downloading' | 'complete';

interface ContentInfographicOptions {
  style?: string;
  detailLevel?: string;
  imageModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
  orientation?: 'portrait' | 'landscape';
}

// Style prompt mappings
const STYLE_PROMPTS: Record<string, string> = {
  'clean-minimal': 'Minimalist design with clean lines, ample white space, simple iconography, and a refined monochromatic palette with subtle accent colours',
  'bold-colourful': 'Bold, vibrant colours with striking visual elements, high contrast design, dynamic shapes, and eye-catching graphics',
  'corporate': 'Corporate executive style with formal layout, muted professional colours (navy, grey, burgundy), structured grid, and understated elegance',
  'nhs-clinical': 'NHS-branded clinical style using NHS blue (#005EB8) palette, healthcare iconography, medical professional aesthetic, and accessible design',
  'modern-gradient': 'Modern design with smooth gradients, rounded corners, subtle shadows, glass morphism effects, and contemporary colour transitions',
  'professional': 'Professional business design with balanced layout, clean typography, and appropriate use of colour to highlight key information',
};

const DETAIL_PROMPTS: Record<string, string> = {
  'light': 'Brief overview with only the most essential 3-5 key points. Minimal text, maximum visual impact.',
  'standard': 'Balanced level of detail covering all main topics in a clear, scannable format.',
  'comprehensive': 'Detailed infographic including all key points with full context and supporting information.',
  'executive': 'C-suite focused summary highlighting only strategic outcomes and critical information. Board-ready presentation.',
};

export const useContentInfographic = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<GenerationPhase>('preparing');
  const [error, setError] = useState<string | null>(null);

  const extractKeyPoints = (content: string): string[] => {
    const points: string[] = [];
    
    // Extract bullet points
    const bulletMatches = content.match(/^[\s]*[-•*]\s+(.+)$/gm);
    if (bulletMatches) {
      points.push(...bulletMatches.map(m => m.replace(/^[\s]*[-•*]\s+/, '').trim()));
    }
    
    // Extract numbered items
    const numberedMatches = content.match(/^[\s]*\d+[.)]\s+(.+)$/gm);
    if (numberedMatches) {
      points.push(...numberedMatches.map(m => m.replace(/^[\s]*\d+[.)]\s+/, '').trim()));
    }
    
    // Extract headings as key topics
    const headingMatches = content.match(/^#{1,3}\s+(.+)$/gm);
    if (headingMatches) {
      points.push(...headingMatches.map(m => m.replace(/^#{1,3}\s+/, '').trim()));
    }
    
    return [...new Set(points)].slice(0, 15); // Deduplicate and limit
  };

  const formatContentForInfographic = (content: string, title?: string): string => {
    const sections: string[] = [];
    
    sections.push('INFOGRAPHIC CONTENT SUMMARY');
    if (title) {
      sections.push(`\nTITLE: ${title}`);
    }
    
    // Extract key points
    const keyPoints = extractKeyPoints(content);
    if (keyPoints.length > 0) {
      sections.push('\nKEY POINTS:');
      keyPoints.forEach((point, i) => {
        sections.push(`${i + 1}. ${point}`);
      });
    }
    
    // Add a condensed version of the content
    const condensed = content
      .replace(/#{1,6}\s+/g, '') // Remove markdown headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/`(.+?)`/g, '$1') // Remove code
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links, keep text
      .substring(0, 2000); // Limit length
    
    sections.push('\nCONTENT OVERVIEW:');
    sections.push(condensed);
    
    return sections.join('\n');
  };

  const generateInfographic = async (
    content: string,
    title?: string,
    options: ContentInfographicOptions = {}
  ) => {
    const { 
      style = 'professional', 
      detailLevel = 'standard',
      imageModel = 'google/gemini-2.5-flash-image-preview',
      orientation = 'portrait'
    } = options;
    
    setIsGenerating(true);
    setCurrentPhase('preparing');
    setError(null);
    
    try {
      const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS['professional'];
      const detailPrompt = DETAIL_PROMPTS[detailLevel] || DETAIL_PROMPTS['standard'];
      const documentContent = formatContentForInfographic(content, title);
      
      const orientationPrompt = orientation === 'landscape' 
        ? 'Landscape orientation (16:9 aspect ratio) suitable for presentations and widescreen displays'
        : 'Portrait orientation (9:16 aspect ratio) suitable for A4 printing';

      const imagePrompt = `Create a professional, visually compelling infographic that summarises the following content.

VISUAL STYLE: ${stylePrompt}

DETAIL LEVEL: ${detailPrompt}

CRITICAL REQUIREMENTS:
- ${orientationPrompt}
- Clear visual hierarchy with the main topic prominently displayed
- Use icons and visual elements to represent key points
- Organise information into logical sections with clear flow
- Use British English spelling throughout
- Include a clear title at the top
- Use colour coding to group related information
- Ensure text is readable and well-spaced
- Make it suitable for professional presentations

CONTENT TO VISUALISE:
${documentContent}`;

      setCurrentPhase('generating');
      
      // Call the edge function with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Generation timed out after 120 seconds')), 120000)
      );
      
      const generationPromise = supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: imagePrompt,
          requestType: 'infographic',
          imageModel,
        },
      });
      
      const { data, error: functionError } = await Promise.race([
        generationPromise,
        timeoutPromise.then(() => ({ data: null, error: { message: 'Timeout' } }))
      ]) as any;
      
      if (functionError) {
        throw new Error(functionError.message || 'Failed to generate infographic');
      }
      
      // Edge function returns { success, image: { url }, textResponse }
      const imageUrl = data?.image?.url || data?.imageUrl;
      
      if (!imageUrl) {
        throw new Error('No image was generated');
      }
      
      setCurrentPhase('downloading');
      
      // Handle both base64 and URL responses
      let blob: Blob;
      if (imageUrl.startsWith('data:')) {
        // Base64 response
        const base64Data = imageUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: 'image/png' });
      } else {
        // URL response - fetch the image
        const imageResponse = await fetch(imageUrl);
        blob = await imageResponse.blob();
      }
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = title 
        ? `${title.replace(/[^a-zA-Z0-9]/g, '_')}_infographic.png`
        : `content_infographic_${new Date().toISOString().split('T')[0]}.png`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setCurrentPhase('complete');
      toast.success('Infographic downloaded successfully!');
      
      return { success: true, imageUrl };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate infographic';
      setError(errorMessage);
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateInfographic,
    isGenerating,
    currentPhase,
    error,
  };
};
