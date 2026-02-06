import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { stripMarkdown } from '@/utils/stripMarkdown';
import { useAuth } from '@/contexts/AuthContext';
import type { BrandingPreference } from '@/components/settings/PresentationBrandingSettings';

interface UserTemplatePreference {
  themeId: string;
  themeName: string;
  source: 'gamma' | 'local';
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

interface GenerationResult {
  success: boolean;
  downloadUrl?: string;
  gammaUrl?: string;
  title?: string;
  error?: string;
}

const NHS_THEME_COLORS: Record<string, { primaryColor: string; secondaryColor: string; accentColor: string }> = {
  'nhs-professional': { primaryColor: '#005EB8', secondaryColor: '#003087', accentColor: '#41B6E6' },
  'nhs-modern': { primaryColor: '#003087', secondaryColor: '#005EB8', accentColor: '#00A499' },
  'clinical-clean': { primaryColor: '#2D3748', secondaryColor: '#4A5568', accentColor: '#38A169' },
  'educational-bright': { primaryColor: '#2B6CB0', secondaryColor: '#3182CE', accentColor: '#ED8936' },
  'executive-dark': { primaryColor: '#1A202C', secondaryColor: '#2D3748', accentColor: '#805AD5' },
};

export const useGammaPowerPoint = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [templatePreference, setTemplatePreference] = useState<UserTemplatePreference | null>(null);
  const [brandingPreference, setBrandingPreference] = useState<BrandingPreference | null>(null);

  // Fetch user's preferences on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!user) return;

      try {
        // Fetch both template and branding preferences in parallel
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
        console.error('Error fetching preferences:', error);
      }
    };

    fetchPreferences();
  }, [user]);

  // Convert base64 to Blob
  const base64ToBlob = (base64: string, contentType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  };

  // Upload presentation to Supabase Storage and return public URL
  const uploadToStorage = async (base64: string, title: string): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const blob = base64ToBlob(base64, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50).trim();
      const fileName = `${user.id}/presentations/${Date.now()}-${sanitizedTitle}.pptx`;
      
      const { data, error } = await supabase.storage
        .from('ai4pm-assets')
        .upload(fileName, blob, {
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          upsert: false
        });

      if (error) {
        console.error('Storage upload error:', error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('ai4pm-assets')
        .getPublicUrl(fileName);

      return urlData?.publicUrl || null;
    } catch (error) {
      console.error('Error uploading to storage:', error);
      return null;
    }
  };

  const downloadFromUrl = (url: string, title: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50)}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadBase64AsPptx = (base64: string, title: string) => {
    const blob = base64ToBlob(base64, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50)}.pptx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const prepareContentForGamma = (content: string, title?: string): { topic: string; supportingContent: string } => {
    // Extract topic from first heading or use provided title
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^##\s+(.+)$/m);
    const topic = title || titleMatch?.[1]?.slice(0, 100) || 'AI Generated Presentation';
    
    // Clean markdown for supporting content
    const supportingContent = stripMarkdown(content);
    
    return { topic, supportingContent };
  };

  const generateWithGamma = async (content: string, title?: string, storeInCloud = true, slideCount = 4): Promise<GenerationResult> => {
    if (!content?.trim()) {
      toast.error('No content to generate presentation from');
      return { success: false, error: 'No content provided' };
    }

    // Clamp slide count between 4 and 10
    const validSlideCount = Math.min(10, Math.max(4, slideCount));

    setIsGenerating(true);

    try {
      const { topic, supportingContent } = prepareContentForGamma(content, title);

      const requestBody: Record<string, unknown> = {
        topic,
        supportingContent,
        slideCount: validSlideCount,
        presentationType: 'Professional Healthcare Presentation',
        audience: 'healthcare professionals',
        includeSpeakerNotes: true,
      };

      // Include theme settings
      if (templatePreference) {
        requestBody.themeSource = templatePreference.source;
        
        if (templatePreference.source === 'gamma') {
          // Gamma theme - pass the theme ID directly
          requestBody.themeId = templatePreference.themeId;
        } else if (templatePreference.source === 'local') {
          // Local theme - pass styling instructions
          const colors = NHS_THEME_COLORS[templatePreference.themeId];
          if (colors) {
            requestBody.localThemeStyle = {
              primaryColor: colors.primaryColor,
              secondaryColor: colors.secondaryColor,
              accentColor: colors.accentColor,
              themeName: templatePreference.themeName
            };
          }
        }
      }

      // Include branding options if set
      if (brandingPreference) {
        requestBody.branding = {
          logoUrl: brandingPreference.logoUrl,
          logoPosition: brandingPreference.logoPosition,
          showCardNumbers: brandingPreference.showCardNumbers,
          cardNumberPosition: brandingPreference.cardNumberPosition,
          dimensions: brandingPreference.dimensions
        };
      }

      console.log('[Gamma Hook] Request body:', requestBody);

      // Phase 1: Start generation — edge function returns immediately with generationId
      const { data: startData, error: startError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
        body: requestBody
      });

      if (startError) {
        throw new Error(startError.message || 'Edge function error');
      }

      // If the edge function returned a final result directly (legacy path), use it
      if (startData?.success && (startData?.downloadUrl || startData?.pptxBase64)) {
        // Direct result — no polling needed
        const data = startData;
        const presentationTitle = data.title || topic;

        if (data.downloadUrl) {
          console.log('[Gamma Hook] Using direct download URL from Gamma');
          downloadFromUrl(data.downloadUrl, presentationTitle);
          toast.success('Professional presentation downloaded!');
          return { success: true, downloadUrl: data.downloadUrl, gammaUrl: data.gammaUrl, title: presentationTitle };
        }
        if (data.pptxBase64) {
          console.log('[Gamma Hook] Using legacy base64 response');
          if (storeInCloud && user) {
            const cloudUrl = await uploadToStorage(data.pptxBase64, presentationTitle);
            if (cloudUrl) {
              downloadFromUrl(cloudUrl, presentationTitle);
              toast.success('Professional presentation downloaded!');
              return { success: true, downloadUrl: cloudUrl, title: presentationTitle };
            }
          }
          downloadBase64AsPptx(data.pptxBase64, presentationTitle);
          toast.success('Professional presentation downloaded!');
          return { success: true, title: presentationTitle };
        }
      }

      // Phase 2: Start-and-poll — edge function returned a generationId
      if (!startData?.generationId) {
        throw new Error(startData?.error || 'Failed to start Gamma generation');
      }

      const generationId = startData.generationId;
      console.log(`[Gamma Hook] Generation started: ${generationId} — polling for completion`);

      // Poll for completion (scale timeout with slide count)
      const maxPollDuration = validSlideCount > 10
        ? 60_000 + validSlideCount * 10_000
        : 180_000; // 3 minutes for ≤10 slides
      const pollInterval = 5_000;
      const pollStart = Date.now();

      let data: any = null;

      while (Date.now() - pollStart < maxPollDuration) {
        await new Promise(r => setTimeout(r, pollInterval));

        const { data: pollData, error: pollError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
          body: { action: 'poll', generationId },
        });

        if (pollError) {
          console.warn('[Gamma Hook] Poll request failed, retrying...', pollError);
          continue;
        }

        if (pollData?.status === 'completed') {
          data = pollData;
          break;
        }

        if (pollData?.status === 'failed') {
          throw new Error(pollData.error || 'Gamma generation failed');
        }

        console.log(`[Gamma Hook] Still generating... (${Math.round((Date.now() - pollStart) / 1000)}s elapsed)`);
      }

      if (!data) {
        throw new Error(`Presentation generation timed out after ${Math.round(maxPollDuration / 1000)}s`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Generation failed');
      }

      const presentationTitle = data.title || topic;

      if (data.downloadUrl) {
        console.log('[Gamma Hook] Using direct download URL from Gamma');
        downloadFromUrl(data.downloadUrl, presentationTitle);
        toast.success('Professional presentation downloaded!');
        return { success: true, downloadUrl: data.downloadUrl, gammaUrl: data.gammaUrl, title: presentationTitle };
      }

      if (data.pptxBase64) {
        console.log('[Gamma Hook] Using legacy base64 response');
        if (storeInCloud && user) {
          const cloudUrl = await uploadToStorage(data.pptxBase64, presentationTitle);
          if (cloudUrl) {
            downloadFromUrl(cloudUrl, presentationTitle);
            toast.success('Professional presentation downloaded!');
            return { success: true, downloadUrl: cloudUrl, title: presentationTitle };
          }
        }
        downloadBase64AsPptx(data.pptxBase64, presentationTitle);
        toast.success('Professional presentation downloaded!');
        return { success: true, title: presentationTitle };
      }

      throw new Error('No download URL or file data received from Gamma');
    } catch (error) {
      console.error('Gamma generation failed:', error);
      toast.error('Gamma generation failed, using local generator...');
      
      // Fallback to local generation
      try {
        const { generatePowerPoint } = await import('@/utils/documentGenerators');
        await generatePowerPoint(content, title);
        toast.success('Presentation downloaded (local fallback)');
        return { success: true, title: title || 'Presentation' };
      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError);
        toast.error('Failed to generate presentation');
        return { success: false, error: 'Generation failed' };
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return { 
    generateWithGamma, 
    isGenerating, 
    templatePreference, 
    brandingPreference,
    uploadToStorage,
    downloadFromUrl 
  };
};
