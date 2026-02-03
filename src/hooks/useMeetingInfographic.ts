import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActionItem {
  id?: string;
  description: string;
  owner?: string;
  deadline?: string;
  status?: string;
  priority?: string;
}

interface MeetingInfographicData {
  meetingTitle: string;
  meetingDate?: string;
  meetingTime?: string;
  location?: string;
  attendees: string[];
  notesContent: string;
  actionItems: ActionItem[];
  transcript?: string;
}

interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

interface InfographicOptions {
  style: string;
  customStyle?: string;
}

// GP Practice-focused infographic style presets
const INFOGRAPHIC_STYLES: Record<string, { name: string; prompt: string }> = {
  'practice-professional': {
    name: 'Practice Professional',
    prompt: 'Clean GP practice meeting style with calming blue and green tones, stethoscope and primary care icons, professional medical typography (Calibri/Arial), structured sections for clinical governance, patient safety items, and practice management. Trust-inspiring and NHS-aligned.'
  },
  'clinical-governance': {
    name: 'Clinical Governance',
    prompt: 'Formal clinical governance style using NHS blue (#005EB8) with red/amber/green RAG rating indicators, checklist icons, compliance and audit focused layout, structured risk assessment sections, clear action tracking visual elements, and regulatory compliance theming.'
  },
  'patient-safety': {
    name: 'Patient Safety Focus',
    prompt: 'Patient safety themed design with protective healthcare imagery, amber and green accents on white, shield and safety icons, prominent incident tracking sections, clear escalation pathways visualised, and compassionate professional aesthetic.'
  },
  'team-engagement': {
    name: 'Team Engagement',
    prompt: 'Warm and engaging team-focused style with friendly people icons, collaborative imagery, soft purple and teal colours, celebration of achievements, staff wellbeing focus, and approachable modern design that feels supportive and team-oriented.'
  },
  'qof-targets': {
    name: 'QOF & Targets',
    prompt: 'Data-driven QOF and targets style with progress bars, pie charts, percentage indicators, green for achieved targets, performance dashboard aesthetic, KPI visualisation, and clear metric tracking focused on practice performance outcomes.'
  }
};

export const useMeetingInfographic = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'preparing' | 'generating' | 'downloading' | 'complete'>('preparing');
  const [error, setError] = useState<string | null>(null);

  const formatMeetingForInfographic = (data: MeetingInfographicData): string => {
    const sections: string[] = [];

    // NEW: "What You Missed" header
    sections.push(`WHAT YOU MISSED`);
    sections.push(`─────────────────────────────────`);
    
    // PROMINENT DATE (hero element)
    if (data.meetingDate) {
      sections.push(`\n📅 ${data.meetingDate}`);
    }
    if (data.meetingTime) {
      sections.push(`⏰ ${data.meetingTime}`);
    }
    
    // Meeting Title
    sections.push(`\nMEETING: "${data.meetingTitle}"`);
    
    if (data.location) {
      sections.push(`📍 ${data.location}`);
    }

    // Executive summary as "THE MEETING IN BRIEF"
    const execMatch = data.notesContent.match(/(?:#|##)\s*EXECUTIVE SUMMARY[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
    if (execMatch) {
      sections.push('\n📝 THE MEETING IN BRIEF:');
      const summary = execMatch[1].trim();
      sections.push(summary.length > 400 ? summary.substring(0, 400) + '...' : summary);
    }

    // Extract Key Points from Discussion Summary
    const keyPointsMatch = data.notesContent.match(/(?:#|##)\s*(?:Key Points|KEY POINTS|DISCUSSION SUMMARY)[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
    if (keyPointsMatch) {
      sections.push('\n💡 KEY DISCUSSION POINTS:');
      const keyPoints = keyPointsMatch[1].trim()
        .split('\n')
        .filter(l => l.trim())
        .slice(0, 5);
      sections.push(keyPoints.join('\n'));
    }

    // Key decisions
    const decisionsMatch = data.notesContent.match(/(?:#|##)\s*(?:KEY DECISIONS|DECISIONS)[:\s]*([\s\S]*?)(?=(?:#|##)|$)/i);
    if (decisionsMatch) {
      sections.push('\n✅ DECISIONS MADE:');
      const decisions = decisionsMatch[1].trim()
        .split('\n')
        .filter(l => l.trim())
        .slice(0, 4);
      sections.push(decisions.join('\n'));
    }

    // Action items - now SECONDARY (just a count)
    if (data.actionItems.length > 0) {
      sections.push(`\n📋 ${data.actionItems.length} action item${data.actionItems.length > 1 ? 's' : ''} assigned`);
    }

    return sections.join('\n');
  };

  const generateInfographic = async (
    data: MeetingInfographicData,
    options?: InfographicOptions
  ): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      // Format meeting content for infographic
      const documentContent = formatMeetingForInfographic(data);
      
      // Log options received
      console.log('[useMeetingInfographic] Options received:', options);
      
      // Build style instruction based on preset or custom style
      // Determine if using custom style
      const isCustomStyle = !!options?.customStyle?.trim();
      let styleInstruction: string;
      
      if (isCustomStyle) {
        // For custom styles, give full creative freedom to the user's request
        styleInstruction = `CUSTOM STYLE REQUEST: "${options.customStyle}"
        
IMPORTANT: Apply this custom visual style as the PRIMARY design direction. 
Be creative and interpret the style request fully. The style should be clearly visible throughout the design.
For example, if "Star Wars" is requested, use space themes, sci-fi fonts, dark backgrounds with glowing elements, etc.
If "retro 80s" is requested, use neon colours, grid patterns, synthwave aesthetics, etc.
Maintain readability but prioritise the requested visual style.`;
        console.log('[useMeetingInfographic] Using custom style:', options.customStyle);
      } else {
        const styleData = INFOGRAPHIC_STYLES[options?.style || 'clean-professional'];
        styleInstruction = styleData?.prompt || INFOGRAPHIC_STYLES['clean-professional'].prompt;
        console.log('[useMeetingInfographic] Using preset style:', options?.style || 'clean-professional');
      }
      
      setCurrentPhase('generating');

      // Call the AI image generation edge function with Gemini Pro 3
      // Use Promise.race for timeout since Supabase client doesn't support AbortController
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Image generation timed out after 120 seconds. Please try again.')), 120000);
      });

      // Build design requirements - conditionally include NHS styling only for preset styles
      const designRequirements = isCustomStyle 
        ? `- "WHAT YOU MISSED" banner/badge styling at the top
- Date should be a VISUAL FOCAL POINT (large, perhaps in a date card/badge design)
- Use storytelling layout - help the reader understand what happened
- Visual icons for each section (calendar, lightbulb, checkmark, etc.)
- Apply the custom style throughout ALL visual elements
- British English spelling throughout
- A4 portrait format, suitable for printing or sharing digitally
- NO attendee counts or participant numbers
- Action items should be MINIMAL - just mention count, not full details
- Make the custom style the dominant visual theme`
        : `- "WHAT YOU MISSED" banner/badge styling at the top
- Date should be a VISUAL FOCAL POINT (large, perhaps in a date card/badge design)
- Use storytelling layout - help the reader understand what happened
- Visual icons for each section (calendar, lightbulb, checkmark, etc.)
- Professional GP practice/NHS styling
- British English spelling throughout
- A4 portrait format, suitable for printing or sharing digitally
- NO attendee counts or participant numbers
- Action items should be MINIMAL - just mention count, not full details
- Make it feel like catching up with a colleague, not a task list`;

      const customPrompt = `Create a HIGH QUALITY "WHAT YOU MISSED" meeting overview infographic.

MEETING: "${data.meetingTitle}"

CONCEPT: This is a visual catch-up for people who missed the meeting. 
Focus on WHAT HAPPENED, not just tasks.

VISUAL STYLE INSTRUCTIONS:
${styleInstruction}

CRITICAL CONTENT HIERARCHY (in order of visual prominence):

1. "WHAT YOU MISSED" - Bold header at top
2. DATE AND TIME - Display VERY PROMINENTLY as a HERO ELEMENT (large, styled)
   ${data.meetingDate ? `Date: ${data.meetingDate}` : ''}
   ${data.meetingTime ? `Time: ${data.meetingTime}` : ''}
3. MEETING TITLE - Clear and readable
4. THE MEETING IN BRIEF - Key summary paragraph (what this meeting was about)
5. KEY DISCUSSION POINTS - The main topics and conversations that took place
6. DECISIONS MADE - Important outcomes that were agreed
7. ACTION ITEMS - Small/optional section with just a count or brief mention

DESIGN REQUIREMENTS:
${designRequirements}`;

      const invokePromise = supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: customPrompt,
          conversationContext: '',
          documentContent: documentContent,
          requestType: 'infographic',
          imageModel: 'google/gemini-3-pro-image-preview',
          practiceContext: {
            brandingLevel: 'none'
          }
        },
      });

      const { data: response, error: fnError } = await Promise.race([invokePromise, timeoutPromise]);

      if (fnError) {
        throw new Error(fnError.message || 'Failed to generate infographic');
      }

      // The edge function returns { success, image: { url }, textResponse }
      const imageUrl = response?.image?.url;
      if (!imageUrl) {
        throw new Error(response?.error || response?.textResponse || 'No image generated');
      }

      setCurrentPhase('downloading');

      // Download the image
      
      // Handle both base64 and URL responses
      let blob: Blob;
      if (imageUrl.startsWith('data:')) {
        // Base64 image
        const base64Data = imageUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'image/png' });
      } else {
        // URL - fetch and convert to blob
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error('Failed to download infographic image');
        }
        blob = await imageResponse.blob();
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Clean filename
      const safeTitle = data.meetingTitle
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
      link.download = `${safeTitle}_Summary_Infographic.png`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setCurrentPhase('complete');
      
      return {
        success: true,
        imageUrl: imageUrl,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[MeetingInfographic] Generation error:', err);
      
      return {
        success: false,
        error: errorMessage,
      };
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
