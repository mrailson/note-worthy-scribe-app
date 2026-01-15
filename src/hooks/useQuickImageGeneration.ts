import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import type { GeneratedImage } from '@/types/ai4gp';
import { toast } from 'sonner';

export type LayoutOption = 'portrait' | 'landscape' | 'square';
export type PurposeOption = 'poster' | 'social' | 'leaflet' | 'waiting-room' | 'general';

export interface QuickImageSettings {
  description: string;
  layout: LayoutOption;
  purpose: PurposeOption;
  includePracticeName: boolean;
  includeLogoSpace: boolean;
  keyMessages: string[];
}

interface QuickImageState {
  settings: QuickImageSettings;
  isGenerating: boolean;
  generationProgress: number;
  currentResult: GeneratedImage | null;
  error: string | null;
}

const defaultSettings: QuickImageSettings = {
  description: '',
  layout: 'portrait',
  purpose: 'poster',
  includePracticeName: true,
  includeLogoSpace: false,
  keyMessages: [],
};

// Map layout to aspect ratio for the generation request
const layoutToAspectRatio: Record<LayoutOption, string> = {
  portrait: '3:4',
  landscape: '16:9',
  square: '1:1',
};

// Map purpose to the full purpose type ID
const purposeToTypeId: Record<PurposeOption, string> = {
  poster: 'poster',
  social: 'social-media',
  leaflet: 'leaflet',
  'waiting-room': 'waiting-room',
  general: 'general',
};

export function useQuickImageGeneration() {
  const { practiceContext } = usePracticeContext();
  
  const [state, setState] = useState<QuickImageState>({
    settings: {
      ...defaultSettings,
      includePracticeName: !!practiceContext?.practiceName,
    },
    isGenerating: false,
    generationProgress: 0,
    currentResult: null,
    error: null,
  });

  const updateSettings = useCallback((updates: Partial<QuickImageSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setState(prev => ({
      ...prev,
      settings: {
        ...defaultSettings,
        includePracticeName: !!practiceContext?.practiceName,
      },
      currentResult: null,
      error: null,
    }));
  }, [practiceContext?.practiceName]);

  const generateImage = useCallback(async (
    imageModel: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1' = 'google/gemini-2.5-flash-image-preview'
  ) => {
    const { settings } = state;
    
    if (!settings.description.trim()) {
      toast.error('Please describe what you want to create');
      return null;
    }

    setState(prev => ({
      ...prev,
      isGenerating: true,
      generationProgress: 0,
      error: null,
    }));

    // Simulate progress
    const progressInterval = setInterval(() => {
      setState(prev => {
        if (prev.generationProgress >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return { ...prev, generationProgress: prev.generationProgress + 10 };
      });
    }, 500);

    try {
      // Build the request payload
      const requestPayload = {
        prompt: settings.description,
        layoutPreference: settings.layout,
        purpose: purposeToTypeId[settings.purpose],
        keyMessages: settings.keyMessages.length > 0 ? settings.keyMessages : undefined,
        
        // Style defaults - NHS Professional
        stylePreset: 'nhs-professional',
        colourPalette: {
          primary: '#005EB8',
          secondary: '#41B6E6',
          accent: '#FFB81C',
          background: '#FFFFFF',
          text: '#231F20',
        },
        
        // Branding from practice context
        practiceContext: practiceContext ? {
          practiceName: settings.includePracticeName ? practiceContext.practiceName : undefined,
          practiceAddress: practiceContext.practiceAddress,
          practicePhone: practiceContext.practicePhone,
          practiceEmail: practiceContext.practiceEmail,
          practiceWebsite: practiceContext.practiceWebsite,
          logoUrl: settings.includeLogoSpace ? practiceContext.logoUrl : undefined,
        } : undefined,
        
        brandingLevel: settings.includePracticeName ? 'name-only' : 'none',
        includeLogo: settings.includeLogoSpace && !!practiceContext?.logoUrl,
        logoPlacement: 'bottom-right',
        
        // Model selection
        imageModel,
      };

      console.log('Quick image generation request:', requestPayload);

      const { data, error } = await supabase.functions.invoke('ai4gp-image-generation', {
        body: requestPayload,
      });

      clearInterval(progressInterval);

      if (error) {
        console.error('Quick image generation error:', error);
        throw new Error(error.message || 'Failed to generate image');
      }

      if (!data?.success || !data?.imageUrl) {
        throw new Error(data?.error || 'No image was generated');
      }

      const result: GeneratedImage = {
        url: data.imageUrl,
        alt: `Generated ${settings.purpose} image: ${settings.description.slice(0, 50)}`,
        prompt: settings.description,
        requestType: settings.purpose === 'social' ? 'social' : settings.purpose === 'leaflet' ? 'leaflet' : settings.purpose === 'waiting-room' ? 'waiting-room' : 'poster',
      };

      setState(prev => ({
        ...prev,
        isGenerating: false,
        generationProgress: 100,
        currentResult: result,
      }));

      toast.success('Image generated successfully!');
      return result;

    } catch (error) {
      clearInterval(progressInterval);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
      
      console.error('Quick image generation failed:', error);
      
      setState(prev => ({
        ...prev,
        isGenerating: false,
        generationProgress: 0,
        error: errorMessage,
      }));

      toast.error(errorMessage);
      return null;
    }
  }, [state.settings, practiceContext]);

  const clearResult = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentResult: null,
      generationProgress: 0,
    }));
  }, []);

  return {
    settings: state.settings,
    isGenerating: state.isGenerating,
    generationProgress: state.generationProgress,
    currentResult: state.currentResult,
    error: state.error,
    practiceContext,
    updateSettings,
    resetSettings,
    generateImage,
    clearResult,
  };
}
