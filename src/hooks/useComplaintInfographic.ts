import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ComplaintInfographicData {
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
}

interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export const useComplaintInfographic = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'preparing' | 'generating' | 'downloading' | 'complete'>('preparing');
  const [error, setError] = useState<string | null>(null);

  /**
   * Strip patient/staff names and other PII from text before sending to AI.
   * Replaces common name patterns (Mr/Mrs/Dr/Ms/Miss + Name) and standalone
   * capitalised proper-noun sequences that follow identifiers.
   */
  const anonymiseText = (text: string): string => {
    if (!text) return text;
    let cleaned = text;
    // Remove title + name patterns (e.g. "Mr. James Robert Williams", "Dr Smith")
    cleaned = cleaned.replace(/\b(Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Professor|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, '[the patient]');
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

  const formatComplaintForInfographic = (data: ComplaintInfographicData): string => {
    const sections: string[] = [];

    sections.push(`LEARNING FROM COMPLAINTS`);
    sections.push(`─────────────────────────────────`);
    sections.push(`\n📋 Reference: ${data.referenceNumber}`);
    sections.push(`📂 Category: ${data.category}`);
    sections.push(`📅 Received: ${data.receivedDate}`);

    if (data.outcomeType) {
      const formattedOutcome = data.outcomeType
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      sections.push(`📊 Outcome: ${formattedOutcome}`);
    }

    // Anonymise the overview before including
    const anonymisedOverview = anonymiseText(data.complaintOverview);
    sections.push(`\n📝 WHAT HAPPENED:`);
    sections.push(anonymisedOverview.length > 300 
      ? anonymisedOverview.substring(0, 300) + '...' 
      : anonymisedOverview);

    if (data.keyLearnings.length > 0) {
      sections.push(`\n💡 KEY LEARNINGS:`);
      data.keyLearnings.slice(0, 5).forEach((l, i) => {
        sections.push(`${i + 1}. ${anonymiseText(l.learning)} (${l.category})`);
      });
    }

    if (data.practiceStrengths.length > 0) {
      sections.push(`\n✅ WHAT WE DID WELL:`);
      data.practiceStrengths.slice(0, 4).forEach(s => {
        sections.push(`• ${anonymiseText(s)}`);
      });
    }

    if (data.improvementSuggestions.length > 0) {
      sections.push(`\n🌱 HOW WE'RE IMPROVING:`);
      data.improvementSuggestions.slice(0, 4).forEach((s, i) => {
        sections.push(`${i + 1}. ${anonymiseText(s.suggestion)}`);
      });
    }

    return sections.join('\n');
  };

  const generateInfographic = async (data: ComplaintInfographicData): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      const documentContent = formatComplaintForInfographic(data);

      setCurrentPhase('generating');

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Image generation timed out after 120 seconds. Please try again.')), 120000);
      });

      const customPrompt = `Create a HIGH QUALITY "Learning from Complaints" staff infographic. This is a ONE-PAGE landscape overview designed for staff notice boards or team meetings.

IMPORTANT TONE RULES:
- This infographic is about LEARNING TOGETHER as a team
- It must be friendly, supportive, and encouraging
- It must NEVER blame individuals or make anyone feel small
- Frame everything as collective learning and growth
- Use phrases like "What we learned", "How we're growing", "Our improvements"
- Celebrate what went well alongside areas for improvement

PRIVACY RULES (CRITICAL — ABSOLUTE REQUIREMENT):
- You MUST NOT include ANY patient names, staff names, clinician names, or any person's name anywhere in the infographic
- You MUST NOT include dates of birth, NHS numbers, addresses, phone numbers, or email addresses
- If the source content contains names (e.g. "Mr. James Williams"), you MUST replace them with generic references like "the patient" or "a staff member"
- If a name appears in the "What Happened" section, rewrite the sentence to remove it entirely
- Keep everything fully anonymised and focused ONLY on the learning
- This infographic may be displayed publicly on staff notice boards — zero PII tolerance

COMPLAINT REFERENCE: ${data.referenceNumber}
CATEGORY: ${data.category}

CONTENT HIERARCHY (in order of visual prominence):
1. "Learning from Complaints" - Friendly header with a growth/learning icon
2. CATEGORY BADGE - What type of complaint this was
3. WHAT HAPPENED - Brief anonymised overview (no patient/staff details)
4. KEY LEARNINGS - The main takeaways for the team (most prominent section)
5. WHAT WE DID WELL - Celebrate positive aspects (green/positive styling)
6. HOW WE'RE IMPROVING - Specific actions being taken (growth-focused)

DESIGN REQUIREMENTS:
- Landscape orientation (16:9 aspect ratio)
- Professional NHS-aligned colour scheme (calming blues, teals, greens)
- Warm and approachable feel - not clinical or cold
- Growth/learning imagery (seedlings, lightbulbs, team icons)
- Clear sections with visual hierarchy
- British English spelling throughout
- No patient or staff identifiers anywhere
- Professional enough for CQC inspection viewing
- Include a small "Powered by NoteWell AI" attribution`;

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

      const imageUrl = response?.image?.url;
      if (!imageUrl) {
        throw new Error(response?.error || response?.textResponse || 'No image generated');
      }

      setCurrentPhase('downloading');

      let blob: Blob;
      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'image/png' });
      } else {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error('Failed to download infographic image');
        }
        blob = await imageResponse.blob();
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Complaint_Learning_${data.referenceNumber}_Infographic.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setCurrentPhase('complete');

      return { success: true, imageUrl };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[ComplaintInfographic] Generation error:', err);
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
