import { useState, useRef, useEffect, useCallback } from 'react';
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
  blobUrl?: string;
  error?: string;
}

const anonymiseText = (text: string): string => {
  if (!text) return text;
  let cleaned = text;
  cleaned = cleaned.replace(/\b(Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Professor|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, '[the patient]');
  cleaned = cleaned.replace(/\b(patient|complainant|staff member|nurse|doctor|receptionist|GP)\s*:\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/gi, '$1');
  cleaned = cleaned.replace(/\b\d{3}\s?\d{3}\s?\d{4}\b/g, '[NHS number redacted]');
  cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email redacted]');
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

/**
 * Upload infographic blob to Supabase Storage and persist the public URL
 * in the complaint_audio_overviews table (infographic_url column).
 */
const persistInfographic = async (
  complaintId: string,
  blob: Blob
): Promise<string | null> => {
  try {
    const filePath = `${complaintId}/infographic_${Date.now()}.png`;

    // Remove any old infographic for this complaint
    const { data: existingFiles } = await supabase.storage
      .from('complaint-infographics')
      .list(complaintId);

    if (existingFiles && existingFiles.length > 0) {
      const paths = existingFiles.map(f => `${complaintId}/${f.name}`);
      await supabase.storage.from('complaint-infographics').remove(paths);
    }

    // Upload the new image
    const { error: uploadError } = await supabase.storage
      .from('complaint-infographics')
      .upload(filePath, blob, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error('[Infographic] Storage upload error:', uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('complaint-infographics')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl;
    if (!publicUrl) return null;

    // Upsert the URL into complaint_audio_overviews
    const { data: existing } = await supabase
      .from('complaint_audio_overviews')
      .select('id')
      .eq('complaint_id', complaintId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('complaint_audio_overviews')
        .update({ infographic_url: publicUrl })
        .eq('complaint_id', complaintId);
    } else {
      // Create a new row if none exists (audio may not have been generated yet)
      const { data: userData } = await supabase.auth.getUser();
      await supabase
        .from('complaint_audio_overviews')
        .insert({
          complaint_id: complaintId,
          infographic_url: publicUrl,
          created_by: userData.user?.id || null,
        } as any);
    }

    console.log('[Infographic] Persisted to storage:', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('[Infographic] Persistence error:', err);
    return null;
  }
};

export const useComplaintInfographic = (complaintId?: string) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'preparing' | 'generating' | 'downloading' | 'complete'>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [generatedBlobUrl, setGeneratedBlobUrl] = useState<string | null>(null);
  const [persistedUrl, setPersistedUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  // Load persisted infographic on mount
  useEffect(() => {
    if (!complaintId) return;

    const loadPersisted = async () => {
      const { data } = await supabase
        .from('complaint_audio_overviews')
        .select('infographic_url')
        .eq('complaint_id', complaintId)
        .maybeSingle();

      if (data?.infographic_url) {
        setPersistedUrl(data.infographic_url);
        setGeneratedBlobUrl(data.infographic_url);
      }
    };

    loadPersisted();
  }, [complaintId]);

  const generateInfographic = useCallback(async (data: ComplaintInfographicData): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      const documentContent = formatComplaintForInfographic(data);

      setCurrentPhase('generating');

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Image generation timed out after 120 seconds. Please try again.')), 120000);
      });

      const customPrompt = `Create a HIGH-QUALITY "Learning from Complaints" staff infographic.
This is a ONE-PAGE landscape (16:9) overview designed specifically for staff notice boards and team meetings.

The purpose is to support shared learning and system improvement, not to attribute fault.

TONE RULES (STRICT):
- Frame the content as learning together as a team — calm, supportive, and constructive
- Never criticise or single out individuals; focus on systems, processes, and pressures
- Treat issues as opportunities for reflection and improvement, not failings
- Prefer suggestive, reflective phrasing (e.g. "highlights the importance of…", "offers an opportunity to…")
- Avoid directive or judgemental language (do not use "failed to", "non-compliance", "should have")
- Celebrate what went well alongside what we're improving, with equal weight
- Use language that would feel safe and fair if read by any staff group (reception, admin, clinical)

PRIVACY RULES (CRITICAL — ABSOLUTE REQUIREMENT):
- No patient or staff names, initials, DOBs, NHS numbers, addresses, phone numbers, or emails
- Replace any identifiers with generic references (e.g. "the patient", "the practice", "the team")
- Assume the infographic may be displayed publicly on staff notice boards
- Zero PII tolerance

COMPLAINT REFERENCE: ${data.referenceNumber}
CATEGORY: ${data.category}

CONTENT HIERARCHY & LANGUAGE GUIDANCE:
Use plain, friendly British English, written for staff rather than regulators.

1. HEADER: "Learning from Complaints" — friendly, reassuring title with growth or learning icon
2. CATEGORY BADGE: Simple, non-judgemental (e.g. "Appointments & Access")
3. WHAT HAPPENED:
   - Brief, anonymised overview
   - Neutral and factual
   - Describe events without attributing blame or intent
4. KEY LEARNINGS (Most Prominent Section):
   - Use phrasing such as "What we learned" or "What this highlighted"
   - Focus on system behaviours, communication, or process resilience
   - Avoid language implying error by individuals
5. WHAT WE DID WELL (Green / Positive):
   - Acknowledge responsiveness, review, openness, and professionalism
   - Reinforce good practice and team strengths
6. HOW WE'RE IMPROVING (Growth-Focused):
   - Use exploratory, supportive wording (e.g. "We're exploring…", "We're strengthening…", "We're reviewing…")
   - Emphasise ongoing learning, not completed corrective actions
   - Avoid absolute or compliance-heavy language

DESIGN REQUIREMENTS:
- Landscape 16:9
- NHS-aligned colour palette (blues, teals, greens)
- Warm, approachable visuals (team icons, seedlings, lightbulbs, growth imagery)
- Clean, readable layout suitable for notice boards
- British English throughout
- CQC-inspection-ready tone aligned with Just Culture
- Footer attribution: "Powered by NoteWell AI"

Only use the information supplied via documentContent. Do not infer or invent detail.`;

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

      const blobUrl = window.URL.createObjectURL(blob);
      blobRef.current = blob;
      setGeneratedBlobUrl(blobUrl);

      // Persist to storage in the background
      if (complaintId) {
        persistInfographic(complaintId, blob).then(url => {
          if (url) setPersistedUrl(url);
        });
      }

      setCurrentPhase('complete');

      return { success: true, blobUrl };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('[ComplaintInfographic] Generation error:', err);
      return { success: false, error: errorMessage };
    } finally {
      setIsGenerating(false);
    }
  }, [complaintId]);

  const downloadInfographic = useCallback(async (referenceNumber: string) => {
    if (!generatedBlobUrl) return;
    
    try {
      let downloadUrl = generatedBlobUrl;
      
      // If it's a remote URL (not a blob URL), fetch it and create a blob URL for download
      if (!generatedBlobUrl.startsWith('blob:')) {
        const response = await fetch(generatedBlobUrl);
        if (!response.ok) throw new Error('Failed to fetch infographic');
        const blob = await response.blob();
        downloadUrl = URL.createObjectURL(blob);
      }
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Complaint_Learning_${referenceNumber}_Infographic.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up temporary blob URL if we created one
      if (downloadUrl !== generatedBlobUrl) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      }
    } catch (err) {
      console.error('[Infographic] Download error:', err);
    }
  }, [generatedBlobUrl]);

  return {
    generateInfographic,
    downloadInfographic,
    isGenerating,
    currentPhase,
    error,
    generatedBlobUrl,
    persistedUrl,
  };
};
