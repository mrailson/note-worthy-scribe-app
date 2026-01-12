import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ActionItem {
  id?: string;
  description: string;
  owner?: string;
  deadline?: string;
  status?: string;
  priority?: string;
}

interface MeetingPowerPointData {
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
  downloadUrl?: string;
  gammaUrl?: string;
  error?: string;
}

export const useMeetingPowerPoint = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'preparing' | 'generating' | 'downloading' | 'complete'>('preparing');
  const [error, setError] = useState<string | null>(null);

  const formatMeetingContent = (data: MeetingPowerPointData): string => {
    const sections: string[] = [];

    // Meeting header
    sections.push(`# ${data.meetingTitle}`);
    
    // Meeting details
    const details: string[] = [];
    if (data.meetingDate) details.push(`Date: ${data.meetingDate}`);
    if (data.meetingTime) details.push(`Time: ${data.meetingTime}`);
    if (data.location) details.push(`Location: ${data.location}`);
    if (details.length > 0) {
      sections.push('\n## Meeting Details');
      sections.push(details.join('\n'));
    }

    // Attendees
    if (data.attendees.length > 0) {
      sections.push('\n## Attendees');
      sections.push(data.attendees.join(', '));
    }

    // Main notes content - extract key sections
    if (data.notesContent) {
      // Extract executive summary if present
      const execMatch = data.notesContent.match(/##\s*EXECUTIVE SUMMARY[:\s]*([\s\S]*?)(?=##|$)/i);
      if (execMatch) {
        sections.push('\n## Executive Summary');
        sections.push(execMatch[1].trim());
      }

      // Extract key decisions
      const decisionsMatch = data.notesContent.match(/##\s*KEY DECISIONS[:\s]*([\s\S]*?)(?=##|$)/i);
      if (decisionsMatch) {
        sections.push('\n## Key Decisions');
        sections.push(decisionsMatch[1].trim());
      }

      // Extract discussion summary
      const discussionMatch = data.notesContent.match(/##\s*DISCUSSION SUMMARY[:\s]*([\s\S]*?)(?=##|$)/i);
      if (discussionMatch) {
        sections.push('\n## Discussion Summary');
        // Truncate if too long
        const discussion = discussionMatch[1].trim();
        sections.push(discussion.length > 2000 ? discussion.substring(0, 2000) + '...' : discussion);
      }

      // Extract key points
      const keyPointsMatch = data.notesContent.match(/##\s*KEY POINTS[:\s]*([\s\S]*?)(?=##|$)/i);
      if (keyPointsMatch) {
        sections.push('\n## Key Points');
        sections.push(keyPointsMatch[1].trim());
      }

      // Extract next steps
      const nextStepsMatch = data.notesContent.match(/##\s*NEXT STEPS[:\s]*([\s\S]*?)(?=##|$)/i);
      if (nextStepsMatch) {
        sections.push('\n## Next Steps');
        sections.push(nextStepsMatch[1].trim());
      }
    }

    // Action items
    if (data.actionItems.length > 0) {
      sections.push('\n## Action Items');
      const formattedItems = data.actionItems.map((item, idx) => {
        let actionLine = `${idx + 1}. ${item.description}`;
        if (item.owner) actionLine += ` (Owner: ${item.owner})`;
        if (item.deadline) actionLine += ` - Due: ${item.deadline}`;
        if (item.priority) actionLine += ` [${item.priority}]`;
        return actionLine;
      });
      sections.push(formattedItems.join('\n'));
    }

    return sections.join('\n');
  };

  const generatePowerPoint = async (data: MeetingPowerPointData): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      // Format meeting content
      const supportingContent = formatMeetingContent(data);
      
      setCurrentPhase('generating');

      // Call Gamma API with extended timeout (120 seconds for long generation)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      const { data: response, error: fnError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
        body: {
          topic: `Executive Summary: ${data.meetingTitle}`,
          presentationType: 'Executive Overview',
          slideCount: 8,
          supportingContent,
          customInstructions: 'Focus on key decisions, action items with owners, and next steps. Create a professional executive summary suitable for board presentation. Include metrics and outcomes where available. Keep slides concise and impactful.',
          audience: 'healthcare professionals and NHS executives',
        },
      });
      
      clearTimeout(timeoutId);

      if (fnError) {
        throw new Error(fnError.message || 'Failed to generate presentation');
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Generation failed');
      }

      setCurrentPhase('downloading');

      // Download the file
      if (response.downloadUrl) {
        const downloadResponse = await fetch(response.downloadUrl);
        if (!downloadResponse.ok) {
          throw new Error('Failed to download presentation');
        }
        
        const blob = await downloadResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Clean filename
        const safeTitle = data.meetingTitle
          .replace(/[^a-zA-Z0-9\s-]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);
        link.download = `${safeTitle}_Executive_Summary.pptx`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      setCurrentPhase('complete');
      
      return {
        success: true,
        downloadUrl: response.downloadUrl,
        gammaUrl: response.gammaUrl,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[MeetingPowerPoint] Generation error:', err);
      
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generatePowerPoint,
    isGenerating,
    currentPhase,
    error,
  };
};
