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

  const generateInfographic = async (data: MeetingInfographicData): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      // Format meeting content for infographic
      const documentContent = formatMeetingForInfographic(data);
      
      setCurrentPhase('generating');

      // Call the AI image generation edge function with Gemini Pro 3
      // Extended timeout for image generation (90 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      
      const { data: response, error: fnError } = await supabase.functions.invoke('ai4gp-image-generation', {
        body: {
          prompt: `Create a professional, visually appealing meeting summary infographic for: "${data.meetingTitle}". 
          
Design requirements:
- Modern, clean NHS-styled design with professional colour palette
- Clear visual hierarchy with the meeting title prominently displayed
- Use icons and visual elements to represent key statistics
- Display attendee count, action items count, and key decisions
- Include a timeline or flow for action items with deadlines
- Use British English spelling throughout
- Make it suitable for printing on A4 or sharing digitally
- Professional healthcare/business aesthetic`,
          conversationContext: '',
          documentContent: documentContent,
          requestType: 'infographic',
          imageModel: 'google/gemini-3-pro-image-preview',
          practiceContext: {
            brandingLevel: 'none'
          }
        },
      });
      
      clearTimeout(timeoutId);

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
