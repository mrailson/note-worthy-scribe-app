import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { BrandingPreference } from '@/components/settings/PresentationBrandingSettings';

interface UserTemplatePreference {
  themeId: string;
  themeName: string;
  source: 'gamma' | 'local';
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

const NHS_THEME_COLORS: Record<string, { primaryColor: string; secondaryColor: string; accentColor: string }> = {
  'nhs-professional': { primaryColor: '#005EB8', secondaryColor: '#003087', accentColor: '#41B6E6' },
  'nhs-modern': { primaryColor: '#003087', secondaryColor: '#005EB8', accentColor: '#00A499' },
  'clinical-clean': { primaryColor: '#2D3748', secondaryColor: '#4A5568', accentColor: '#38A169' },
  'educational-bright': { primaryColor: '#2B6CB0', secondaryColor: '#3182CE', accentColor: '#ED8936' },
  'executive-dark': { primaryColor: '#1A202C', secondaryColor: '#2D3748', accentColor: '#805AD5' },
};

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
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<GenerationPhase>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [persistedData, setPersistedData] = useState<PersistedPowerPoint | null>(null);
  const [templatePreference, setTemplatePreference] = useState<UserTemplatePreference | null>(null);
  const [brandingPreference, setBrandingPreference] = useState<BrandingPreference | null>(null);
  const [complaintPracticeName, setComplaintPracticeName] = useState<string>('');
  const loadedRef = useRef(false);
  const prefsLoadedRef = useRef(false);

  // Load persisted PowerPoint on mount
  useEffect(() => {
    if (!complaintId || loadedRef.current) return;
    loadedRef.current = true;

    const load = async () => {
      const [overviewResult, complaintResult] = await Promise.all([
        supabase
          .from('complaint_audio_overviews')
          .select('powerpoint_download_url, powerpoint_gamma_url, powerpoint_thumbnail_url, powerpoint_slide_count')
          .eq('complaint_id', complaintId!)
          .maybeSingle(),
      supabase
          .from('complaints')
          .select('practice_id')
          .eq('id', complaintId!)
          .maybeSingle(),
      ]);

      if (overviewResult.data?.powerpoint_download_url) {
        setPersistedData({
          downloadUrl: overviewResult.data.powerpoint_download_url,
          gammaUrl: overviewResult.data.powerpoint_gamma_url || undefined,
          thumbnailUrl: overviewResult.data.powerpoint_thumbnail_url || undefined,
          slideCount: overviewResult.data.powerpoint_slide_count || undefined,
        });
      }

      // Look up practice name from practice_details using the complaint's practice_id
      if (complaintResult.data?.practice_id) {
        const { data: practiceDetails } = await supabase
          .from('practice_details')
          .select('practice_name')
          .eq('id', complaintResult.data.practice_id)
          .maybeSingle();
        if (practiceDetails?.practice_name) {
          setComplaintPracticeName(practiceDetails.practice_name);
        }
      }
    };

    load();
  }, [complaintId]);

  // Fetch user's template and branding preferences (same as Ask AI PowerPoint)
  useEffect(() => {
    if (!user || prefsLoadedRef.current) return;
    prefsLoadedRef.current = true;

    const fetchPreferences = async () => {
      try {
        const [templateResult, brandingResult] = await Promise.all([
          supabase
            .from('user_settings')
            .select('setting_value')
            .eq('user_id', user.id)
            .eq('setting_key', 'presentation_template')
            .single(),
          supabase
            .from('user_settings')
            .select('setting_value')
            .eq('user_id', user.id)
            .eq('setting_key', 'presentation_branding')
            .single()
        ]);

        if (templateResult.data?.setting_value) {
          setTemplatePreference(templateResult.data.setting_value as unknown as UserTemplatePreference);
        }
        if (brandingResult.data?.setting_value) {
          setBrandingPreference(brandingResult.data.setting_value as unknown as BrandingPreference);
        }
      } catch (error) {
        console.error('[ComplaintPowerPoint] Error fetching preferences:', error);
      }
    };

    fetchPreferences();
  }, [user]);

  const formatComplaintContent = useCallback((data: ComplaintPowerPointData): string => {
    const sections: string[] = [];
    const practiceName = complaintPracticeName || '';

    // Structured slide-by-slide content guide for Gamma
    sections.push('# Learning Together: Complaint Review');
    sections.push('## A Staff Training Presentation');
    if (practiceName) {
      sections.push(`### ${practiceName}`);
    }
    sections.push('');

    // Slide 1: Title
    sections.push('### SLIDE 1 — Title Slide');
    sections.push(`Learning Together: Complaint Review`);
    if (practiceName) {
      sections.push(`Practice: ${practiceName}`);
    }
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
    if (practiceName) {
      sections.push(`${practiceName}`);
    }
    sections.push('Questions and reflections from the team');
    sections.push('How can we continue to improve together?');
    sections.push('Powered by NoteWell AI');

    return sections.join('\n');
  }, [complaintPracticeName]);

  const generatePowerPoint = useCallback(async (
    data: ComplaintPowerPointData,
    slideCount: number = 6
  ): Promise<GenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setCurrentPhase('preparing');

    try {
      const supportingContent = formatComplaintContent(data);

      const practiceName = complaintPracticeName || '';

      setCurrentPhase('generating');

      // Rich, visually-directive instructions for Gamma
      const practiceNameInstruction = practiceName
        ? `BRANDING: Include the practice name "${practiceName}" on the title slide and final slide. The practice name should appear as a subtitle or header element — professional but prominent.`
        : `BRANDING: No practice name available — keep branding generic.`;

      const customInstructions = [
        // Purpose
        `PURPOSE (CRITICAL): This presentation is for shared learning and system improvement, not to attribute fault, determine liability, or assess individual performance.`,
        // Tone
        `TONE: Warm, supportive PLT training tone focused on learning together as a team. Frame issues as system learning and service resilience, not individual error. Avoid judgemental or directive language. Use reflective phrasing such as "this highlighted…", "this reinforced the importance of…", "this offers an opportunity to…". Celebrate what went well alongside areas for improvement, with equal weight.`,
        // Privacy
        `PRIVACY (CRITICAL): Fully anonymised throughout. No patient or staff names, initials, DOBs, NHS numbers, addresses, phone numbers, or emails. Use only generic terms such as "the patient", "the practice", "the team". Assume slides may be viewed by a wider audience.`,
        // Just Culture safety
        `JUST CULTURE SAFETY RULES (CRITICAL): Apply NHS Just Culture principles throughout. Do not name or single out specific staff groups (e.g. reception, clinicians, admin) — use collective terms such as "teams", "processes", or "appointment management workflows". Frame issues as system design, process resilience, or communication flow — never individual performance. Avoid language that implies fault, blame, or disciplinary judgement.`,
        // Liability-safe language
        `LIABILITY-SAFE LANGUAGE RULES (CRITICAL): Do not state or imply confirmed financial loss, compensation, or harm. Avoid phrases such as: "financial loss", "financial detriment", "delayed treatment", "caused harm". Prefer experience-focused phrasing: "avoidable disruption", "challenges for patients", "impact on continuity of care", "practical consequences for patients".`,
        // System design framing
        `SYSTEM DESIGN FRAMING: Do not describe systems as having "failed". Do not use "critical failure" or "root cause" language. Frame instead as: "limitations in system design", "single-channel reliance", "areas where resilience can be strengthened", "opportunities to improve reliability".`,
        // Mandated phrase preferences
        `MANDATED PHRASE PREFERENCES: Prefer: "This highlighted…", "This reinforced the importance of…", "This offered an opportunity to…", "We're exploring ways to…", "We're strengthening…". Avoid directive language: "must", "should", "required to".`,
        // Practice branding
        practiceNameInstruction,
        // Title slide
        `TITLE SLIDE (CRITICAL): The first slide must use a full-bleed photorealistic background image — never a flat colour. Image theme: modern UK GP practice exterior, welcoming reception area, or collaborative team setting. Overlay title text using a subtle dark gradient for readability. Tone should feel reassuring, professional, and people-centred.`,
        // Design & imagery
        `DESIGN: Executive-quality, modern visuals suitable for NHS settings. Every slide must include a full-bleed photorealistic image rooted in UK General Practice / primary care. Permitted imagery: GP consultation rooms, practice reception and waiting areas, team meetings or collaborative discussions, GPs or staff at desks, community health or primary care environments, practice buildings exterior, warm doctor-patient interactions without identifiable faces. Avoid: hospital ward imagery, doctors in theatre scrubs, emergency or acute-care visuals. Optional: 1–2 conceptual or metaphorical images to reinforce learning or improvement themes.`,
        // Layout
        `LAYOUT: Use a mix of: full-image background slides with text overlay, split image + content layouts, icon-supported grids. All slides must remain clear, readable, and noticeboard-safe.`,
        // Colour scheme
        `COLOUR SCHEME: NHS-inspired palette — deep navy (#003087), NHS blue (#005EB8), teal accents, warm greens for learning and improvement, amber for priority or focus areas.`,
        // Typography
        `TYPOGRAPHY: Clean sans-serif fonts. Bold, high-contrast headings. Maximum 4–5 bullets per slide. Plain British English suitable for all staff groups.`,
        // Content safety
        `CONTENT SAFETY RULES (IMPORTANT): Describe events neutrally, without assigning intent or blame. Avoid definitive clinical or financial harm conclusions. Avoid legalistic or regulatory language (e.g. "failure", "non-compliance", "root cause"). Use system-level language such as "contributing factors", "process variation", "communication gaps". Do not single out specific staff groups (e.g. reception); refer to "teams" or "processes".`,
        // Noticeboard readability check
        `NOTICEBOARD READABILITY CHECK: Before finalising content, internally check: "Would this feel fair, non-threatening, and constructive if read by any staff member on a noticeboard?" If not, soften wording until it clearly reflects shared learning rather than judgement.`,
        // Structure
        `STRUCTURE: Exactly ${slideCount} slides. Recommended flow: Title/context → What Happened (neutral, factual, anonymised) → Key Learnings (system-level, reflective — most prominent) → What We Did Well (strengths and professionalism) → How We're Improving (exploratory, growth-focused, prioritised) → Thank You & Discussion.`,
        // Final slide
        `FINAL SLIDE (CRITICAL): Title: "Thank You & Discussion". Include: practice name (or generic), invitation for reflection and shared ideas, discreet line "Shared to support learning and service improvement — not to attribute fault.", footer "Powered by NoteWell AI", full-bleed photorealistic background image.`,
        // Speaker notes
        `Speaker notes in the hidden notes pane only — never visible on slides. Notes should contain full presenter talking points.`,
        // Input context
        `INPUT CONTEXT: Use only the information provided via supportingContent. Do not infer, embellish, or invent outcomes, actions, or impacts.`,
      ].join(' ');

      // Build request body — match Ask AI PowerPoint settings
      const requestBody: Record<string, unknown> = {
        topic: `Learning Together: Complaint Review — ${data.referenceNumber} (${data.category})`,
        presentationType: 'NHS Staff Training Session',
        slideCount,
        supportingContent,
        customInstructions,
        audience: 'NHS GP practice staff during Protected Learning Time (PLT) sessions',
        fontStyle: 'modern',
        includeSpeakerNotes: true,
      };

      // Include user's template theme preference (same as Ask AI)
      if (templatePreference) {
        requestBody.themeSource = templatePreference.source;
        if (templatePreference.source === 'gamma') {
          requestBody.themeId = templatePreference.themeId;
        } else if (templatePreference.source === 'local') {
          const colors = NHS_THEME_COLORS[templatePreference.themeId];
          if (colors) {
            requestBody.localThemeStyle = {
              primaryColor: colors.primaryColor,
              secondaryColor: colors.secondaryColor,
              accentColor: colors.accentColor,
              themeName: templatePreference.themeName,
            };
          }
        }
      }

      // Include user's branding preference (same as Ask AI)
      if (brandingPreference) {
        requestBody.branding = {
          logoUrl: brandingPreference.logoUrl,
          logoPosition: brandingPreference.logoPosition,
          showCardNumbers: brandingPreference.showCardNumbers,
          cardNumberPosition: brandingPreference.cardNumberPosition,
          dimensions: brandingPreference.dimensions,
        };
      }

      const { data: startResponse, error: startError } = await supabase.functions.invoke(
        'generate-powerpoint-gamma',
        { body: requestBody }
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
      const basePollInterval = 10_000;
      let currentInterval = basePollInterval;
      const maxPendingInterval = 30_000;
      const maxThrottleInterval = 120_000;
      let consecutivePending = 0;
      const maxPollTime = slideCount * 30000;
      const startTime = Date.now();

      const sleepWithJitter = (ms: number) =>
        new Promise(r => setTimeout(r, ms * (0.9 + Math.random() * 0.2)));

      let downloadUrl: string | undefined;
      let gammaUrl: string | undefined;

      while (Date.now() - startTime < maxPollTime) {
        await sleepWithJitter(currentInterval);

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
          const errMsg = pollError.message || '';

          if (errMsg.includes('401') || errMsg.includes('403') ||
              errMsg.includes('Unauthorized') || errMsg.includes('Forbidden')) {
            throw new Error('Session expired or not authorised. Please sign in again.');
          }

          if (errMsg.includes('ThrottlerException') || errMsg.includes('Too Many Requests') || errMsg.includes('429')) {
            console.warn('[ComplaintPowerPoint] Rate limited — backing off');
            currentInterval = Math.min(currentInterval * 2, maxThrottleInterval);
            continue;
          }

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

        if (pollResponse?.status === 'pending') {
          consecutivePending++;
          if (consecutivePending > 3) {
            currentInterval = Math.min(currentInterval + 2_000, maxPendingInterval);
          }
        } else {
          consecutivePending = 0;
          currentInterval = basePollInterval;
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
  }, [complaintId, complaintPracticeName, formatComplaintContent, templatePreference, brandingPreference]);

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
