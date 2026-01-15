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
  detailLevel: string;
  focusArea: string;
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

// Detail level prompt mappings
const DETAIL_PROMPTS: Record<string, string> = {
  'light': 'Brief overview with only the most essential 3-5 key points, ideal for a quick one-glance reference. Minimal text, maximum visual impact.',
  'standard': 'Balanced level of detail covering all main topics, key decisions, and primary action items in a clear, scannable format.',
  'comprehensive': 'Detailed infographic including all discussion points, decisions made, action items with full context, and supporting information.',
  'key-points': 'Focus exclusively on bullet points, key decisions, and action items presented as a clear checklist without narrative explanations.',
  'executive': 'C-suite focused summary highlighting only strategic outcomes, high-level decisions, and critical next steps. Board-ready presentation.',
};

// Focus area prompt mappings
const FOCUS_PROMPTS: Record<string, string> = {
  'balanced': 'Equal emphasis across all meeting elements including discussions, decisions, and action items.',
  'actions': 'Emphasise action items prominently with clear owner names, deadline dates, priority indicators, and status tracking visuals.',
  'decisions': 'Highlight key decisions made during the meeting with supporting context, rationale, and implications visualised clearly.',
  'timeline': 'Show meeting flow and action item timeline with visual chronology, due dates on a timeline, and milestone markers.',
  'attendees': 'Emphasise participant contributions, action item ownership distribution, and role-based responsibilities with people-focused visuals.',
  'next-steps': 'Focus on forward-looking elements: next steps, follow-up actions, future meeting dates, and pending items requiring attention.',
};

export const useMeetingInfographic = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'preparing' | 'generating' | 'downloading' | 'complete'>('preparing');
  const [error, setError] = useState<string | null>(null);

  const formatMeetingForInfographic = (data: MeetingInfographicData): string => {
    const sections: string[] = [];

    // Title and basic info
    sections.push(`MEETING SUMMARY INFOGRAPHIC`);
    sections.push(`\nTITLE: ${data.meetingTitle}`);
    
    // Meeting metadata
    const metadata: string[] = [];
    if (data.meetingDate) metadata.push(`DATE: ${data.meetingDate}`);
    if (data.meetingTime) metadata.push(`TIME: ${data.meetingTime}`);
    if (data.location) metadata.push(`LOCATION: ${data.location}`);
    if (metadata.length > 0) {
      sections.push(metadata.join(' | '));
    }

    // Key statistics
    sections.push('\nKEY STATISTICS:');
    sections.push(`• ${data.attendees.length} Attendees`);
    sections.push(`• ${data.actionItems.length} Action Items`);
    
    // Count key decisions if present in notes
    const decisionsMatch = data.notesContent.match(/##\s*KEY DECISIONS[:\s]*([\s\S]*?)(?=##|$)/i);
    if (decisionsMatch) {
      const decisions = decisionsMatch[1].trim().split('\n').filter(l => l.trim().match(/^[-•*\d]/));
      sections.push(`• ${decisions.length} Key Decisions`);
    }

    // Attendees list
    if (data.attendees.length > 0) {
      sections.push('\nATTENDEES:');
      sections.push(data.attendees.slice(0, 10).join(', '));
      if (data.attendees.length > 10) {
        sections.push(`... and ${data.attendees.length - 10} more`);
      }
    }

    // Executive summary
    const execMatch = data.notesContent.match(/##\s*EXECUTIVE SUMMARY[:\s]*([\s\S]*?)(?=##|$)/i);
    if (execMatch) {
      sections.push('\nEXECUTIVE SUMMARY:');
      const summary = execMatch[1].trim();
      sections.push(summary.length > 500 ? summary.substring(0, 500) + '...' : summary);
    }

    // Key decisions
    if (decisionsMatch) {
      sections.push('\nKEY DECISIONS:');
      const decisions = decisionsMatch[1].trim().split('\n')
        .filter(l => l.trim())
        .slice(0, 5);
      sections.push(decisions.join('\n'));
    }

    // Action items
    if (data.actionItems.length > 0) {
      sections.push('\nACTION ITEMS:');
      const topItems = data.actionItems.slice(0, 6);
      topItems.forEach((item, idx) => {
        let line = `${idx + 1}. ${item.description}`;
        if (item.owner) line += ` (${item.owner})`;
        if (item.deadline) line += ` - Due: ${item.deadline}`;
        sections.push(line);
      });
      if (data.actionItems.length > 6) {
        sections.push(`... and ${data.actionItems.length - 6} more action items`);
      }
    }

    // Next steps
    const nextStepsMatch = data.notesContent.match(/##\s*NEXT STEPS[:\s]*([\s\S]*?)(?=##|$)/i);
    if (nextStepsMatch) {
      sections.push('\nNEXT STEPS:');
      const nextSteps = nextStepsMatch[1].trim();
      sections.push(nextSteps.length > 300 ? nextSteps.substring(0, 300) + '...' : nextSteps);
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
      
      // Build dynamic prompt based on options
      const stylePrompt = options?.style ? STYLE_PROMPTS[options.style] || STYLE_PROMPTS['professional'] : STYLE_PROMPTS['professional'];
      const detailPrompt = options?.detailLevel ? DETAIL_PROMPTS[options.detailLevel] || DETAIL_PROMPTS['standard'] : DETAIL_PROMPTS['standard'];
      const focusPrompt = options?.focusArea ? FOCUS_PROMPTS[options.focusArea] || FOCUS_PROMPTS['balanced'] : FOCUS_PROMPTS['balanced'];
      
      // Log the prompts being used
      console.log('[useMeetingInfographic] Style prompt:', stylePrompt);
      console.log('[useMeetingInfographic] Detail prompt:', detailPrompt);
      console.log('[useMeetingInfographic] Focus prompt:', focusPrompt);
      
      setCurrentPhase('generating');

      // Call the AI image generation edge function with Gemini Pro 3
      // Use Promise.race for timeout since Supabase client doesn't support AbortController
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Image generation timed out after 120 seconds. Please try again.')), 120000);
      });

      const customPrompt = `Create a professional, visually appealing meeting summary infographic for: "${data.meetingTitle}".

VISUAL STYLE: ${stylePrompt}

DETAIL LEVEL: ${detailPrompt}

CONTENT FOCUS: ${focusPrompt}

Additional requirements:
- Clear visual hierarchy with the meeting title prominently displayed
- Use icons and visual elements to represent key statistics
- Display attendee count (${data.attendees.length}), action items count (${data.actionItems.length}), and key decisions
- Use British English spelling throughout
- Make it suitable for printing on A4 or sharing digitally
- Ensure excellent readability and professional appearance`;

      const invokePromise = supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: customPrompt,
          conversationContext: '',
          documentContent: documentContent,
          requestType: 'infographic',
          imageModel: 'google/gemini-2.5-flash-image-preview',
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
