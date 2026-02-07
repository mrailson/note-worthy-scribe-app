import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ComplaintPowerPointData {
  referenceNumber: string;
  category: string;
  receivedDate: string;
  outcomeType?: string;
  complaintOverview: string;
  keyLearnings: Array<{
    learning: string;
    category: string;
    impact: string;
  }>;
  practiceStrengths: string[];
  improvementSuggestions: Array<{
    suggestion: string;
    rationale: string;
    priority: string;
  }>;
  outcomeRationale?: string;
}

interface GenerationResult {
  success: boolean;
  downloadUrl?: string;
  gammaUrl?: string;
  error?: string;
}

type GenerationPhase = 'preparing' | 'generating' | 'polling' | 'downloading' | 'complete';

/**
 * Strip patient/staff names and other PII from text before sending to Gamma.
 * Mirrors the anonymisation logic from useComplaintInfographic.
 */
const anonymiseText = (text: string): string => {
  if (!text) return text;
  let cleaned = text;
  // Remove title + name patterns (e.g. "Mr. James Robert Williams", "Dr Smith")
  cleaned = cleaned.replace(/\b(Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Professor|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, '[a member of the team/patient]');
  // Remove "Patient: Name" or "Staff: Name" label patterns
  cleaned = cleaned.replace(/\b(patient|complainant|staff member|nurse|doctor|receptionist|GP)\s*:\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/gi, '$1');
  // Remove NHS numbers (XXX XXX XXXX)
  cleaned = cleaned.replace(/\b\d{3}\s?\d{3}\s?\d{4}\b/g, '[NHS number redacted]');
  // Remove email addresses
  cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email redacted]');
  // Remove phone numbers
  cleaned = cleaned.replace(/\b(?:(?:\+44\s?|0)(?:\d\s?){9,10})\b/g, '[phone redacted]');
  return cleaned;
};

export const useComplaintPowerPoint = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<GenerationPhase>('preparing');
  const [error, setError] = useState<string | null>(null);

  const formatComplaintContent = (data: ComplaintPowerPointData): string => {
    const sections: string[] = [];

    sections.push('# Learning from Complaints — Staff Training');
    sections.push('');
    sections.push(`**Reference:** ${data.referenceNumber}`);
    sections.push(`**Category:** ${data.category}`);
    sections.push(`**Received:** ${data.receivedDate}`);

    if (data.outcomeType) {
      const formattedOutcome = data.outcomeType
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      sections.push(`**Outcome:** ${formattedOutcome}`);
    }

    // Anonymised overview
    const anonymisedOverview = anonymiseText(data.complaintOverview);
    sections.push('');
    sections.push('## What Happened');
    sections.push(anonymisedOverview);

    // Key learnings
    if (data.keyLearnings.length > 0) {
      sections.push('');
      sections.push('## Key Learnings for the Team');
      data.keyLearnings.forEach((l, i) => {
        sections.push(`${i + 1}. ${anonymiseText(l.learning)} (${l.category} — ${l.impact} impact)`);
      });
    }

    // Strengths
    if (data.practiceStrengths.length > 0) {
      sections.push('');
      sections.push('## What We Did Well');
      data.practiceStrengths.forEach(s => {
        sections.push(`• ${anonymiseText(s)}`);
      });
    }

    // Improvements
    if (data.improvementSuggestions.length > 0) {
      sections.push('');
      sections.push('## How We\'re Improving');
      data.improvementSuggestions.forEach((s, i) => {
        sections.push(`${i + 1}. ${anonymiseText(s.suggestion)} [${s.priority} priority]`);
        sections.push(`   ${anonymiseText(s.rationale)}`);
      });
    }

    // Outcome rationale
    if (data.outcomeRationale) {
      sections.push('');
      sections.push('## Outcome Summary');
      sections.push(anonymiseText(data.outcomeRationale));
    }

    return sections.join('\n');
  };

  const generatePowerPoint = async (
    data: ComplaintPowerPointData,
    slideCount: number = 7
  ): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      const supportingContent = formatComplaintContent(data);

      setCurrentPhase('generating');

      const customInstructions = `IMPORTANT TONE AND CONTENT RULES:
- This presentation is for Protected Learning Time (PLT) sessions and staff training
- The tone must be friendly, supportive, and encouraging — "learning together as a team"
- NEVER blame individuals or make anyone feel small
- Frame everything as collective learning and growth
- Use phrases like "What we learned", "How we're growing together", "Our team improvements"
- Celebrate what went well alongside areas for improvement

PRIVACY RULES (CRITICAL — ABSOLUTE REQUIREMENT):
- You MUST NOT include ANY patient names, staff names, clinician names, or any person's name
- You MUST NOT include dates of birth, NHS numbers, addresses, phone numbers, or email addresses
- Replace any person-specific references with "the patient", "a team member", "a colleague"
- Keep everything fully anonymised — this will be shown to all staff

DESIGN REQUIREMENTS:
- Professional NHS-aligned design with calming blues, teals, and greens
- Warm and approachable — not clinical or cold
- Include photorealistic images on every slide
- Use growth/learning imagery (seedlings, lightbulbs, team collaboration)
- British English spelling throughout
- Create exactly ${slideCount} slides
- Include detailed speaker notes in the notes pane for the presenter
- Add "Powered by NoteWell AI" attribution on the final slide

SLIDE STRUCTURE GUIDANCE:
1. Title slide — "Learning Together: Complaint Review" with reference number and category
2. What happened — Brief anonymised overview
3-${slideCount - 2}. Key learnings, strengths, and improvement actions (distributed across slides)
${slideCount - 1}. Action plan — What we're doing differently
${slideCount}. Summary and "Powered by NoteWell AI" attribution`;

      // Step 1: Start Gamma generation (returns generationId immediately)
      const { data: startResponse, error: startError } = await supabase.functions.invoke(
        'generate-powerpoint-gamma',
        {
          body: {
            topic: `Learning Together: Complaint Review — ${data.referenceNumber} (${data.category})`,
            presentationType: 'Training Session',
            slideCount,
            supportingContent,
            customInstructions,
            audience: 'NHS staff during Protected Learning Time (PLT) sessions',
          },
        }
      );

      if (startError) {
        throw new Error(startError.message || 'Failed to start PowerPoint generation');
      }

      if (!startResponse?.success || !startResponse?.generationId) {
        throw new Error(startResponse?.error || 'Generation failed to start');
      }

      const generationId = startResponse.generationId;
      console.log('[ComplaintPowerPoint] Generation started, ID:', generationId);

      // Step 2: Poll for completion
      setCurrentPhase('polling');
      const pollInterval = 5000; // 5 seconds
      const maxPollTime = slideCount * 30000; // 30s per slide max
      const startTime = Date.now();

      let downloadUrl: string | undefined;
      let gammaUrl: string | undefined;

      while (Date.now() - startTime < maxPollTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        const { data: pollResponse, error: pollError } = await supabase.functions.invoke(
          'generate-powerpoint-gamma',
          {
            body: {
              action: 'poll',
              generationId,
            },
          }
        );

        if (pollError) {
          console.error('[ComplaintPowerPoint] Poll error:', pollError);
          continue; // Retry on transient errors
        }

        console.log('[ComplaintPowerPoint] Poll status:', pollResponse?.status);

        if (pollResponse?.status === 'completed') {
          downloadUrl = pollResponse.downloadUrl;
          gammaUrl = pollResponse.gammaUrl;
          break;
        }

        if (pollResponse?.status === 'failed') {
          throw new Error(pollResponse?.error || 'Gamma generation failed');
        }

        // status === 'pending' → keep polling
      }

      if (!downloadUrl) {
        throw new Error('PowerPoint generation timed out. Please try again.');
      }

      setCurrentPhase('downloading');

      // Trigger download
      const safeRef = data.referenceNumber
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = `Staff_Training_${safeRef}.pptx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Staff training PowerPoint ready!', {
        description: 'If the download does not start automatically, your browser may have blocked it.',
      });

      setCurrentPhase('complete');

      return {
        success: true,
        downloadUrl,
        gammaUrl,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[ComplaintPowerPoint] Generation error:', err);
      return { success: false, error: errorMessage };
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
