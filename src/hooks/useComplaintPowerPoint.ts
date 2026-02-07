import { useState, useEffect, useCallback, useRef } from 'react';
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

interface PersistedPowerPoint {
  downloadUrl: string;
  gammaUrl?: string;
  thumbnailUrl?: string;
  slideCount?: number;
}

type GenerationPhase = 'preparing' | 'generating' | 'polling' | 'downloading' | 'complete';

const anonymiseText = (text: string): string => {
  if (!text) return text;
  let cleaned = text;
  cleaned = cleaned.replace(/\b(Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Professor|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g, '[a member of the team/patient]');
  cleaned = cleaned.replace(/\b(patient|complainant|staff member|nurse|doctor|receptionist|GP)\s*:\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/gi, '$1');
  cleaned = cleaned.replace(/\b\d{3}\s?\d{3}\s?\d{4}\b/g, '[NHS number redacted]');
  cleaned = cleaned.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email redacted]');
  cleaned = cleaned.replace(/\b(?:(?:\+44\s?|0)(?:\d\s?){9,10})\b/g, '[phone redacted]');
  return cleaned;
};

/**
 * Generate a canvas-based thumbnail for the title slide.
 */
const generateTitleSlideThumbnail = (
  referenceNumber: string,
  category: string,
  slideCount: number
): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 640, 360);
    gradient.addColorStop(0, '#1e3a5f');
    gradient.addColorStop(1, '#2d5f8a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 360);

    // Subtle accent bar at top
    const topBar = ctx.createLinearGradient(0, 0, 640, 0);
    topBar.addColorStop(0, '#f59e0b');
    topBar.addColorStop(1, '#f97316');
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, 640, 6);

    // Presentation icon (simplified)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(520, 280, 80, 0, Math.PI * 2);
    ctx.fill();

    // Title text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Learning Together:', 40, 100);

    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Complaint Review', 40, 132);

    // Reference
    ctx.fillStyle = '#f59e0b';
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(referenceNumber, 40, 172);

    // Category badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    const categoryText = category;
    const catMetrics = ctx.measureText(categoryText);
    ctx.roundRect(40, 188, catMetrics.width + 20, 28, 4);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(categoryText, 50, 207);

    // Slide count
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`${slideCount} slides • Staff Training Presentation`, 40, 260);

    // Footer
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Powered by NoteWell AI', 40, 330);

    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/png');
  });
};

/**
 * Persist PowerPoint metadata and thumbnail to Supabase.
 */
const persistPowerPoint = async (
  complaintId: string,
  downloadUrl: string,
  gammaUrl: string | undefined,
  slideCount: number,
  referenceNumber: string,
  category: string,
): Promise<string | null> => {
  try {
    // Generate thumbnail
    const thumbnailBlob = await generateTitleSlideThumbnail(referenceNumber, category, slideCount);
    const filePath = `${complaintId}/powerpoint_thumb_${Date.now()}.png`;

    // Remove old thumbnails
    const { data: existingFiles } = await supabase.storage
      .from('complaint-infographics')
      .list(complaintId, { search: 'powerpoint_thumb' });

    if (existingFiles && existingFiles.length > 0) {
      const paths = existingFiles.map(f => `${complaintId}/${f.name}`);
      await supabase.storage.from('complaint-infographics').remove(paths);
    }

    // Upload thumbnail
    const { error: uploadError } = await supabase.storage
      .from('complaint-infographics')
      .upload(filePath, thumbnailBlob, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      console.error('[PowerPoint] Thumbnail upload error:', uploadError);
    }

    const { data: publicUrlData } = supabase.storage
      .from('complaint-infographics')
      .getPublicUrl(filePath);

    const thumbnailUrl = publicUrlData?.publicUrl || null;

    // Upsert into complaint_audio_overviews
    const { data: existing } = await supabase
      .from('complaint_audio_overviews')
      .select('id')
      .eq('complaint_id', complaintId)
      .maybeSingle();

    const pptData = {
      powerpoint_download_url: downloadUrl,
      powerpoint_gamma_url: gammaUrl || null,
      powerpoint_thumbnail_url: thumbnailUrl,
      powerpoint_slide_count: slideCount,
    };

    if (existing) {
      await supabase
        .from('complaint_audio_overviews')
        .update(pptData as any)
        .eq('complaint_id', complaintId);
    } else {
      const { data: userData } = await supabase.auth.getUser();
      await supabase
        .from('complaint_audio_overviews')
        .insert({
          complaint_id: complaintId,
          created_by: userData.user?.id || null,
          ...pptData,
        } as any);
    }

    console.log('[PowerPoint] Persisted successfully');
    return thumbnailUrl;
  } catch (err) {
    console.error('[PowerPoint] Persistence error:', err);
    return null;
  }
};

export const useComplaintPowerPoint = (complaintId?: string) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<GenerationPhase>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [persistedData, setPersistedData] = useState<PersistedPowerPoint | null>(null);
  const loadedRef = useRef(false);

  // Load persisted PowerPoint on mount
  useEffect(() => {
    if (!complaintId || loadedRef.current) return;
    loadedRef.current = true;

    const load = async () => {
      const { data } = await supabase
        .from('complaint_audio_overviews')
        .select('powerpoint_download_url, powerpoint_gamma_url, powerpoint_thumbnail_url, powerpoint_slide_count')
        .eq('complaint_id', complaintId)
        .maybeSingle();

      if (data?.powerpoint_download_url) {
        setPersistedData({
          downloadUrl: data.powerpoint_download_url,
          gammaUrl: data.powerpoint_gamma_url || undefined,
          thumbnailUrl: data.powerpoint_thumbnail_url || undefined,
          slideCount: data.powerpoint_slide_count || undefined,
        });
      }
    };

    load();
  }, [complaintId]);

  const formatComplaintContent = useCallback((data: ComplaintPowerPointData): string => {
    const sections: string[] = [];

    // Structured slide-by-slide content guide for Gamma
    sections.push('# Learning Together: Complaint Review');
    sections.push('## A Staff Training Presentation');
    sections.push('');

    // Slide 1: Title
    sections.push('### SLIDE 1 — Title Slide');
    sections.push(`Learning Together: Complaint Review`);
    sections.push(`Reference: ${data.referenceNumber} | Category: ${data.category}`);
    sections.push(`Date Received: ${data.receivedDate}`);
    sections.push('Continuous improvement through shared learning');
    sections.push('');

    // Slide 2: What happened
    const anonymisedOverview = anonymiseText(data.complaintOverview);
    sections.push('### SLIDE 2 — What Happened');
    sections.push('A summary of the complaint for team awareness:');
    sections.push(anonymisedOverview.length > 500
      ? anonymisedOverview.substring(0, 500) + '...'
      : anonymisedOverview);

    if (data.outcomeType) {
      const formattedOutcome = data.outcomeType
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      sections.push(`Outcome: ${formattedOutcome}`);
    }
    sections.push('');

    // Slides 3+: Key learnings (one per slide if enough slides)
    if (data.keyLearnings.length > 0) {
      sections.push('### KEY LEARNINGS — One learning per slide');
      data.keyLearnings.forEach((l, i) => {
        sections.push(`**Learning ${i + 1}: ${anonymiseText(l.learning)}**`);
        sections.push(`Category: ${l.category} | Impact: ${l.impact}`);
        sections.push('');
      });
    }

    // What we did well
    if (data.practiceStrengths.length > 0) {
      sections.push('### SLIDE — What We Did Well');
      sections.push('Celebrating our team strengths:');
      data.practiceStrengths.forEach(s => {
        sections.push(`✓ ${anonymiseText(s)}`);
      });
      sections.push('');
    }

    // How we're improving
    if (data.improvementSuggestions.length > 0) {
      sections.push('### SLIDE — How We Are Improving');
      sections.push('Actions and improvements underway:');
      data.improvementSuggestions.forEach((s, i) => {
        sections.push(`${i + 1}. **${anonymiseText(s.suggestion)}** [${s.priority} priority]`);
        sections.push(`   ${anonymiseText(s.rationale)}`);
      });
      sections.push('');
    }

    // Outcome summary
    if (data.outcomeRationale) {
      sections.push('### SLIDE — Outcome & Next Steps');
      sections.push(anonymiseText(data.outcomeRationale));
      sections.push('');
    }

    // Closing
    sections.push('### FINAL SLIDE — Thank You & Discussion');
    sections.push('Questions and reflections from the team');
    sections.push('How can we continue to improve together?');
    sections.push('Powered by NoteWell AI');

    return sections.join('\n');
  }, []);

  const generatePowerPoint = useCallback(async (
    data: ComplaintPowerPointData,
    slideCount: number = 7
  ): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      const supportingContent = formatComplaintContent(data);

      // Fetch practice logo URL for branding
      let practiceLogoUrl: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: practiceRows } = await supabase
            .from('practice_details')
            .select('practice_logo_url')
            .eq('user_id', user.id)
            .not('practice_logo_url', 'is', null)
            .not('practice_logo_url', 'eq', '')
            .limit(1);

          const validLogo = practiceRows?.find(r =>
            r.practice_logo_url?.startsWith('https://')
          );
          if (validLogo?.practice_logo_url) {
            practiceLogoUrl = validLogo.practice_logo_url;
            console.log('[ComplaintPowerPoint] Found practice logo:', practiceLogoUrl);
          }
        }
      } catch (logoErr) {
        console.warn('[ComplaintPowerPoint] Could not fetch practice logo:', logoErr);
      }

      setCurrentPhase('generating');

      // Rich, visually-directive instructions for Gamma
      const customInstructions = [
        // Tone & privacy
        `TONE: Warm, supportive PLT staff training — "learning together as a team". Never blame individuals. Celebrate what went well alongside improvements.`,
        `PRIVACY (CRITICAL): Fully anonymised — no patient/staff names, NHS numbers, emails, phone numbers. Use "the patient" or "a team member".`,
        // Visual quality
        `DESIGN: Executive-quality presentation with bold, modern visuals. Use full-bleed photorealistic hero images on every slide — healthcare settings, teamwork, growth metaphors (e.g. seedlings, lightbulbs, handshakes, stethoscopes, team huddles). Images must be large and impactful, not small thumbnails.`,
        `LAYOUT: Mix layouts — full-image backgrounds with text overlay, split-screen image+content, icon grids for key points. Avoid plain text-only slides. Every slide should be visually engaging.`,
        `COLOUR SCHEME: Professional NHS-inspired palette — deep navy (#003087), NHS blue (#005EB8), teal accents, warm greens for positives, amber for action items. White/light backgrounds for readability.`,
        `TYPOGRAPHY: Clean sans-serif headings (bold, large). Concise bullet points — max 4-5 per slide. Let the imagery do the heavy lifting.`,
        // Structure
        `Exactly ${slideCount} slides. British English throughout.`,
        `Speaker notes in the hidden notes pane only — never visible on slides. Notes should contain full presenter talking points.`,
        `Final slide: "Thank You & Discussion" with "Powered by NoteWell AI" attribution.`,
        practiceLogoUrl ? `Practice logo at top-right of every slide: ${practiceLogoUrl}` : '',
      ].filter(Boolean).join(' ');

      const { data: startResponse, error: startError } = await supabase.functions.invoke(
        'generate-powerpoint-gamma',
        {
          body: {
            topic: `Learning Together: Complaint Review — ${data.referenceNumber} (${data.category})`,
            presentationType: 'NHS Staff Training Session',
            slideCount,
            supportingContent,
            customInstructions,
            audience: 'NHS GP practice staff during Protected Learning Time (PLT) sessions',
            fontStyle: 'modern',
            ...(practiceLogoUrl ? {
              branding: {
                logoUrl: practiceLogoUrl,
                logoPosition: 'topRight',
                showCardNumbers: true,
                cardNumberPosition: 'bottomRight',
              },
            } : {}),
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

      // Poll for completion
      setCurrentPhase('polling');
      const pollInterval = 5000;
      const maxPollTime = slideCount * 30000;
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
          continue;
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

      // Persist in background
      if (complaintId) {
        persistPowerPoint(
          complaintId,
          downloadUrl,
          gammaUrl,
          slideCount,
          data.referenceNumber,
          data.category,
        ).then((thumbnailUrl) => {
          setPersistedData({
            downloadUrl: downloadUrl!,
            gammaUrl,
            thumbnailUrl: thumbnailUrl || undefined,
            slideCount,
          });
        });
      }

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
  }, [complaintId, formatComplaintContent]);

  const downloadPersistedPowerPoint = useCallback((referenceNumber: string) => {
    if (!persistedData?.downloadUrl) return;
    const safeRef = referenceNumber
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    const link = document.createElement('a');
    link.href = persistedData.downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = `Staff_Training_${safeRef}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [persistedData]);

  return {
    generatePowerPoint,
    downloadPersistedPowerPoint,
    isGenerating,
    currentPhase,
    error,
    persistedData,
  };
};
