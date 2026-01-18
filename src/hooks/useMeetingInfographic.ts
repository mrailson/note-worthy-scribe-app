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

    // Key statistics (without attendee count)
    sections.push('\nKEY STATISTICS:');
    sections.push(`• ${data.actionItems.length} Action Items`);
    
    // Count key decisions if present in notes
    const decisionsMatch = data.notesContent.match(/##\s*KEY DECISIONS[:\s]*([\s\S]*?)(?=##|$)/i);
    if (decisionsMatch) {
      const decisions = decisionsMatch[1].trim().split('\n').filter(l => l.trim().match(/^[-•*\d]/));
      sections.push(`• ${decisions.length} Key Decisions`);
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
      
      // Build style instruction based on preset or custom style
      let styleInstruction: string;
      if (options?.customStyle?.trim()) {
        styleInstruction = `Custom visual style requested: "${options.customStyle}". 
Apply this creative direction while maintaining readability and professional presentation of the meeting content.`;
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

      const customPrompt = `Create a visually striking GP Practice meeting summary infographic.

MEETING: "${data.meetingTitle}"

VISUAL STYLE INSTRUCTIONS (APPLY THESE CAREFULLY):
${styleInstruction}

CONTENT TO INCLUDE:
- Meeting title and date prominently displayed
- Key decisions made during the meeting
- ${data.actionItems.length} action items with owners and deadlines
- Main discussion points and outcomes

DESIGN REQUIREMENTS:
- Apply the visual style described above throughout the entire design
- Clear visual hierarchy with sections clearly separated
- Use relevant icons (medical, practice management, team icons as appropriate)
- British English spelling throughout
- A4 portrait format suitable for printing or digital sharing
- Professional healthcare practice aesthetic
- NO attendee counts or participant numbers - focus on content only`;

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
