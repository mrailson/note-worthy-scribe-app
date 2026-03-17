import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { userNameCorrections } from '@/utils/UserNameCorrections';
import { sanitizeGeneratedContent } from '@/utils/sanitizeGeneratedContent';

type GenerationPhase = 'preparing' | 'generating' | 'downloading' | 'complete';

interface ContentInfographicOptions {
  style?: string;
  detailLevel?: string;
  imageModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
  orientation?: 'portrait' | 'landscape';
  practiceName?: string;
  spellingCorrections?: { incorrect: string; correct: string }[];
  logoUrl?: string;
}

// Style prompt mappings
const STYLE_PROMPTS: Record<string, string> = {
  'clean-minimal': 'Minimalist design with clean lines, ample white space, simple iconography, and a refined monochromatic palette with subtle accent colours',
  'bold-colourful': 'Bold, vibrant colours with striking visual elements, high contrast design, dynamic shapes, and eye-catching graphics',
  'corporate': 'Corporate executive style with formal layout, muted professional colours (navy, grey, burgundy), structured grid, and understated elegance',
  'nhs-clinical': 'NHS-branded clinical style using NHS blue (#005EB8) palette, healthcare iconography, medical professional aesthetic, and accessible design',
  'modern-gradient': 'Modern design with smooth gradients, rounded corners, subtle shadows, glass morphism effects, and contemporary colour transitions',
  'professional': 'Professional business design with balanced layout, clean typography, and appropriate use of colour to highlight key information',
  // Meeting Manager / Export Studio infographic styles
  'practice-professional': 'Professional GP practice style with NHS blue (#003087) accents, clean structured layout, formal headings, and practice branding area at top',
  'clinical-governance': 'Clinical governance themed with structured audit-style layout, evidence-based design using greens and navy, compliance-focused iconography',
  'patient-safety': 'Patient safety focused with red/amber alert colour palette, clear risk indicators, incident-reporting style layout with priority markers',
  'team-engagement': 'Staff engagement and team-focused design with warm colours, collaborative imagery, people-centred layout with team achievement highlights',
  'qof-targets': 'QOF and targets dashboard style with data visualisation elements, progress indicators, KPI-focused layout with green/amber/red status markers',
  'board-pack': 'Board pack executive style with formal dark navy header, gold accents, structured governance layout suitable for board-level presentation',
  'icb-submission': 'ICB submission format with NHS England branding palette, formal structured sections, commissioner-facing professional layout',
  'neighbourhood': 'Neighbourhood team style with community-focused warm palette, collaborative design elements, PCN/neighbourhood branding with local identity',
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

  const generateInfographic = useCallback(async (
    content: string,
    title?: string,
    options: ContentInfographicOptions = {}
  ) => {
    const { 
      style = 'professional', 
      detailLevel = 'standard',
      imageModel = 'google/gemini-3-pro-image-preview',
      orientation = 'landscape',
      practiceName,
      spellingCorrections,
    } = options;
    
    setIsGenerating(true);
    setCurrentPhase('preparing');
    setError(null);
    
    try {
      const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS['professional'];
      const detailPrompt = DETAIL_PROMPTS[detailLevel] || DETAIL_PROMPTS['standard'];

      // --- Content quality hardening (mirrors Quick Guide pipeline) ---

      // 1. Apply user name corrections to source content before AI sees it
      if (!userNameCorrections.isLoaded()) {
        await userNameCorrections.loadCorrections();
      }
      let cleanedContent = userNameCorrections.applyCorrections(content);

      // 2. Remove consecutive duplicate words
      cleanedContent = cleanedContent.replace(/\b(\w+)([,;.]?\s+)\1\b/gi, '$1$2');

      // 2b. Sanitise content — strip hex codes, CSS, directives, etc.
      const { html: sanitisedContent, warnings } = sanitizeGeneratedContent(cleanedContent);
      cleanedContent = sanitisedContent;
      if (warnings.length > 0) {
        console.log('🧹 Infographic: sanitised source content:', warnings);
      }

      const documentContent = formatContentForInfographic(cleanedContent, title);

      // 3. Build user spelling corrections block for the prompt
      let userCorrectionsBlock = '';
      if (spellingCorrections && spellingCorrections.length > 0) {
        userCorrectionsBlock = `\n\nMANDATORY USER SPELLING CORRECTIONS:\n${spellingCorrections.map(c => `- Always spell "${c.correct}" (NOT "${c.incorrect}")`).join('\n')}\n`;
      }

      // 4. Build practice context for branding (matching Meeting Manager pattern)
      const practiceCtx: Record<string, any> = {
        brandingLevel: options.logoUrl ? 'logo-only' : 'none',
      };
      if (options.logoUrl) {
        practiceCtx.logoUrl = options.logoUrl;
        practiceCtx.includeLogo = true;
        practiceCtx.logoPlacement = 'top-right';
      }
      if (practiceName && practiceName.trim()) {
        practiceCtx.practiceName = practiceName;
        practiceCtx.brandingLevel = options.logoUrl ? 'name-and-logo' : 'name-only';
      }
      
      const orientationPrompt = orientation === 'portrait'
        ? 'Portrait orientation (9:16 aspect ratio) suitable for A4 printing'
        : 'Landscape orientation (16:9 aspect ratio) suitable for presentations and widescreen displays';

      const imagePrompt = `Create a professional, visually compelling infographic that summarises the following content.

VISUAL STYLE: ${stylePrompt}

DETAIL LEVEL: ${detailPrompt}

CRITICAL TEXT LENGTH RULES:
- Every text block must be SHORT. Maximum 20 words per sentence. Maximum 2 sentences per section.
- Use bullet points with 8-12 words each rather than full paragraphs
- Headings should be 3-6 words maximum
- Never render a sentence longer than 20 words
- NEVER duplicate a section or repeat information

CRITICAL REQUIREMENTS:
- ${orientationPrompt}
- Clear visual hierarchy with the main topic prominently displayed
- Use icons and visual elements to represent key points
- Organise information into logical sections with clear flow
- Include a clear title at the top
- Use colour coding to group related information
- Ensure text is readable and well-spaced
- Make it suitable for professional presentations

BRITISH ENGLISH SPELLING RULES (MANDATORY):
- Use British English throughout: "organisation" not "organization", "summarise" not "summarize"
- "colour" not "color", "programme" not "program", "centre" not "centre"
- Date format: "11 March 2026" (never "March 11, 2026")
- Any American English spelling in the output is a CRITICAL ERROR

NEVER render prompt instructions, template variables, or formatting directives as visible text:
- Never show "[Number]", "[Text]", or any square-bracket placeholders
- Never show colour hex codes like "#EF4444" or "#005EB8"
- Never show instruction-style labels or examples from the prompt
${userCorrectionsBlock}`;

      setCurrentPhase('generating');
      
      // Call the edge function with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Generation timed out after 120 seconds')), 120000)
      );
      
      const generationPromise = supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: imagePrompt,
          documentContent: documentContent,
          requestType: 'infographic',
          imageModel,
          practiceContext: practiceCtx,
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
      
      // Create a viewable URL (no auto-download)
      const url = URL.createObjectURL(blob);
      
      setCurrentPhase('complete');
      toast.success('Infographic ready!');
      
      return { success: true, imageUrl };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate infographic';
      setError(errorMessage);
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generateInfographic,
    isGenerating,
    currentPhase,
    error,
  };
};
