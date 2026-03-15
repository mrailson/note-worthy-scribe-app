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

interface PowerPointOptions {
  style: string;
  content: string;
  slideCount: number;
  imageMode?: string;
  speakerNotes?: boolean;
  includeLogo?: boolean;
  logoData?: {
    name: string;
    imageUrl?: string | null;
  } | null;
}

// Style prompt mappings
const STYLE_PROMPTS: Record<string, string> = {
  'executive-board': 'Executive board presentation with formal layout, strategic focus, and C-suite appropriate design. Use muted professional colours and authoritative typography.',
  'team-update': 'Collaborative team update style with accessible design, clear action items, and inclusive layout. Friendly but professional aesthetic.',
  'nhs-clinical': 'NHS-branded presentation using official NHS blue (#005EB8), NHS England design guidelines, healthcare iconography, and clinical professional aesthetic.',
  'modern-minimal': 'Modern minimalist design with ample white space, clean sans-serif typography, subtle accent colours, and contemporary feel.',
  'training': 'Educational training presentation with step-by-step structure, clear learning objectives, visual aids, and instructional design principles.',
  'stakeholder': 'External stakeholder report style suitable for sharing outside the organisation. Professional, polished, and comprehensive.',
  'quick': 'Rapid overview style optimised for brief presentations. High-impact slides with minimal text and strong visual hierarchy.',
  'comprehensive': 'Comprehensive meeting pack with detailed content, appendices, and thorough documentation of all discussion points.',
  'data-driven': 'Data-focused presentation emphasising charts, graphs, metrics visualisations, and quantitative outcomes.',
  'professional': 'Professional business presentation with balanced design, clear structure, and appropriate visual elements.',
};

// Content focus prompt mappings
const CONTENT_PROMPTS: Record<string, string> = {
  'standard': 'Balanced coverage including executive summary, key decisions, action items, and next steps.',
  'actions': 'Primary focus on action items with clear owner assignments, deadline tracking, priority indicators, and accountability visualisation.',
  'decisions': 'Emphasis on key decisions made, including context, rationale, implications, and related outcomes.',
  'metrics': 'Focus on KPIs, progress metrics, trend analysis, outcomes achieved, and quantitative results.',
  'discussion': 'Comprehensive discussion summary capturing all major topics, viewpoints expressed, and consensus reached.',
  'next-steps': 'Forward-looking content focusing on upcoming actions, follow-up requirements, future meeting dates, and pending items.',
  'highlights': 'Key highlights only for quick consumption - most important decisions, critical actions, and essential next steps.',
  'comprehensive': 'Complete meeting coverage including all sections, detailed notes, and full context for each topic.',
  'all': 'All available content organised logically including summary, discussions, decisions, actions, and next steps.',
  'visualisations': 'Content structured for visual presentation with charts, timelines, progress bars, and infographic elements.',
};

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

  const generatePowerPoint = async (
    data: MeetingPowerPointData,
    options?: PowerPointOptions
  ): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      // Format meeting content
      const supportingContent = formatMeetingContent(data);
      
      // Log options received
      console.log('[useMeetingPowerPoint] Options received:', options);
      
      // Build dynamic prompts based on options
      const stylePrompt = options?.style ? STYLE_PROMPTS[options.style] || STYLE_PROMPTS['professional'] : STYLE_PROMPTS['professional'];
      const contentPrompt = options?.content ? CONTENT_PROMPTS[options.content] || CONTENT_PROMPTS['standard'] : CONTENT_PROMPTS['standard'];
      const slideCount = options?.slideCount || 8;
      
      console.log('[useMeetingPowerPoint] Style prompt:', stylePrompt);
      console.log('[useMeetingPowerPoint] Content prompt:', contentPrompt);
      console.log('[useMeetingPowerPoint] Slide count:', slideCount);
      
      setCurrentPhase('generating');

      // Build custom instructions

      const customInstructions = `PRESENTATION STYLE: ${stylePrompt}

CONTENT FOCUS: ${contentPrompt}

Create exactly ${slideCount} slides. Focus on key decisions, action items with owners, and next steps. Create a professional executive summary suitable for board presentation. Include metrics and outcomes where available. Keep slides concise and impactful. Use British English spelling throughout.`;

      // Map imageMode to Gamma imageOptions — default to noImages
      const imageSource = options?.imageMode || 'noImages';
      console.log('[useMeetingPowerPoint] Image mode:', imageSource);

      // Speaker notes — default to true
      const includeSpeakerNotes = options?.speakerNotes !== false;
      console.log('[useMeetingPowerPoint] Speaker notes:', includeSpeakerNotes);

      // Logo branding
      const logoData = options?.includeLogo ? options.logoData : null;
      console.log('[useMeetingPowerPoint] Include logo:', options?.includeLogo, 'Logo data:', logoData?.name, 'hasImage:', !!logoData?.imageUrl);

      // Build branding parameter if logo has an image URL
      const branding = logoData?.imageUrl
        ? { logo: { src: logoData.imageUrl } }
        : undefined;

      // Append logo instruction to inputText if logo is on but no image
      let logoInstruction = '';
      if (options?.includeLogo && logoData?.name && !logoData?.imageUrl) {
        logoInstruction = `\n\nInclude the organisation name '${logoData.name}' on the title slide.`;
      }

      const { data: startData, error: startError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
        body: {
          topic: `Executive Summary: ${data.meetingTitle}`,
          presentationType: options?.style === 'training' ? 'Training Session' : 
                           options?.style === 'stakeholder' ? 'Stakeholder Report' :
                           options?.style === 'quick' ? 'Quick Overview' : 'Executive Overview',
          slideCount: slideCount,
          supportingContent: supportingContent + logoInstruction,
          customInstructions,
          audience: 'healthcare professionals and NHS executives',
          useStockLibraryImages: imageSource !== 'noImages',
          includeSpeakerNotes,
          branding,
          imageOptions: {
            source: imageSource,
          },
        },
      });

      if (startError) {
        throw new Error(startError.message || 'Failed to generate presentation');
      }

      let response = startData;

      // If we got a direct result (legacy path), use it
      if (response?.success && response?.downloadUrl) {
        // Already complete
      } else if (response?.generationId) {
        // Poll for completion
        const generationId = response.generationId;
        console.log(`[MeetingPowerPoint] Generation started: ${generationId} — polling...`);

        const maxPollDuration = slideCount > 10
          ? 60_000 + slideCount * 10_000
          : 180_000;
        const basePollInterval = 10_000;
        let currentInterval = basePollInterval;
        const pollStart = Date.now();

        const sleepWithJitter = (ms: number) =>
          new Promise(r => setTimeout(r, ms * (0.9 + Math.random() * 0.2)));

        response = null;

        while (Date.now() - pollStart < maxPollDuration) {
          await sleepWithJitter(currentInterval);

          const { data: pollData, error: pollError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
            body: { action: 'poll', generationId },
          });

          if (pollError) {
            const errMsg = pollError.message || '';
            if (errMsg.includes('ThrottlerException') || errMsg.includes('429')) {
              console.warn('[MeetingPowerPoint] Rate limited — backing off');
              currentInterval = Math.min(currentInterval * 2, 120_000);
              continue;
            }
            console.warn('[MeetingPowerPoint] Poll failed, retrying...', pollError);
            continue;
          }

          if (pollData?.status === 'completed') {
            response = pollData;
            break;
          }

          if (pollData?.status === 'failed') {
            throw new Error(pollData.error || 'Gamma generation failed');
          }

          console.log(`[MeetingPowerPoint] Still generating... (${Math.round((Date.now() - pollStart) / 1000)}s elapsed)`);
        }

        if (!response) {
          throw new Error(`Generation timed out after ${Math.round(maxPollDuration / 1000)}s`);
        }
      } else if (!response?.success) {
        throw new Error(response?.error || 'Generation failed');
      }

      setCurrentPhase('downloading');

      // Download the file
      if (response.downloadUrl) {
        const safeTitle = data.meetingTitle
          .replace(/[^a-zA-Z0-9\s-]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 50);

        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = `${safeTitle}_Executive_Summary.pptx`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success('PowerPoint ready', {
          description: 'If the download does not start automatically, your browser may have blocked it—try again or use the Gamma link.',
        });
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
