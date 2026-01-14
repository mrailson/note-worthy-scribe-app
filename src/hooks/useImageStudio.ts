import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import type { 
  ImageStudioSettings, 
  ImageStudioState, 
  ReferenceImage, 
  GenerationHistoryItem,
  ImageStudioRequest 
} from '@/types/imageStudio';
import { 
  CUSTOM_PALETTE_DEFAULTS,
  NHS_PALETTES 
} from '@/utils/colourPalettes';
import type { GeneratedImage } from '@/types/ai4gp';

const DEFAULT_SETTINGS: ImageStudioSettings = {
  // Context & Content
  description: '',
  supportingContent: '',
  keyMessages: [],
  targetAudience: 'patients',
  purpose: 'poster',
  
  // Style & Design
  stylePreset: 'nhs-professional',
  colourPalette: NHS_PALETTES[0], // NHS Classic
  layoutPreference: 'portrait',
  
  // Branding & Logo
  brandingLevel: 'name-contact',
  customBranding: {
    name: true,
    address: false,
    phone: true,
    email: false,
    website: false,
    pcn: false,
  },
  logoPlacement: 'top-right',
  includeLogo: true,
  
  // Reference Images
  referenceImages: [],
  referenceMode: 'style-reference',
  referenceInstructions: '',
};

export function useImageStudio() {
  const { practiceContext } = usePracticeContext();
  
  const [state, setState] = useState<ImageStudioState>({
    settings: DEFAULT_SETTINGS,
    activeTab: 'context',
    isGenerating: false,
    generationProgress: 0,
    currentResult: null,
    generationHistory: [],
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update settings
  const updateSettings = useCallback((updates: Partial<ImageStudioSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
      error: null,
    }));
  }, []);

  // Set active tab
  const setActiveTab = useCallback((tab: ImageStudioState['activeTab']) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  // Add reference image
  const addReferenceImage = useCallback((image: ReferenceImage) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        referenceImages: [...prev.settings.referenceImages, image],
      },
    }));
  }, []);

  // Remove reference image
  const removeReferenceImage = useCallback((imageId: string) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        referenceImages: prev.settings.referenceImages.filter(img => img.id !== imageId),
      },
    }));
  }, []);

  // Load previous result for editing
  const loadPreviousResult = useCallback(() => {
    const lastResult = state.generationHistory[0]?.result;
    if (lastResult) {
      const refImage: ReferenceImage = {
        id: `prev-${Date.now()}`,
        name: 'Previous Result',
        content: lastResult.url,
        type: 'image/png',
        mode: 'update-previous',
      };
      addReferenceImage(refImage);
      setState(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          referenceMode: 'update-previous',
        },
        activeTab: 'reference',
      }));
    }
  }, [state.generationHistory, addReferenceImage]);

  // Generate image
  const generateImage = useCallback(async (imageModel?: string) => {
    const { settings } = state;
    
    if (!settings.description.trim()) {
      toast.error('Please provide a description of the image you want to create');
      return null;
    }

    setState(prev => ({ 
      ...prev, 
      isGenerating: true, 
      generationProgress: 10,
      error: null 
    }));

    abortControllerRef.current = new AbortController();

    try {
      // Build the request
      const request: ImageStudioRequest = {
        prompt: settings.description,
        supportingContent: settings.supportingContent || undefined,
        keyMessages: settings.keyMessages.length > 0 ? settings.keyMessages : undefined,
        targetAudience: settings.targetAudience,
        purpose: settings.purpose,
        stylePreset: settings.stylePreset,
        colourPalette: {
          primary: settings.colourPalette.primary,
          secondary: settings.colourPalette.secondary,
          accent: settings.colourPalette.accent,
          background: settings.colourPalette.background,
          text: settings.colourPalette.text,
        },
        layoutPreference: settings.layoutPreference,
        practiceContext: practiceContext || undefined,
        brandingLevel: settings.brandingLevel,
        customBranding: settings.customBranding,
        logoPlacement: settings.logoPlacement,
        includeLogo: settings.includeLogo,
        referenceImages: settings.referenceImages.length > 0 
          ? settings.referenceImages.map(img => ({
              content: img.content,
              type: img.type,
              mode: img.mode,
              instructions: settings.referenceInstructions || undefined,
            }))
          : undefined,
        imageModel: (imageModel as ImageStudioRequest['imageModel']) || 'google/gemini-2.5-flash-image',
        isStudioRequest: true,
      };

      setState(prev => ({ ...prev, generationProgress: 30 }));

      console.log('🎨 Image Studio: Generating image with settings:', {
        purpose: settings.purpose,
        style: settings.stylePreset,
        hasReferences: settings.referenceImages.length > 0,
        referenceMode: settings.referenceMode,
      });

      const { data, error } = await supabase.functions.invoke('ai4gp-image-generation', {
        body: request,
      });

      setState(prev => ({ ...prev, generationProgress: 80 }));

      if (error) {
        throw error;
      }

      if (!data?.imageUrl) {
        throw new Error('No image was generated');
      }

      const result: GeneratedImage = {
        url: data.imageUrl,
        alt: data.alt || settings.description.substring(0, 100),
        prompt: settings.description,
        requestType: settings.purpose === 'banner' ? 'general' : settings.purpose as GeneratedImage['requestType'],
      };

      // Add to history
      const historyItem: GenerationHistoryItem = {
        id: `gen-${Date.now()}`,
        timestamp: new Date(),
        settings: { ...settings },
        result,
      };

      setState(prev => ({
        ...prev,
        isGenerating: false,
        generationProgress: 100,
        currentResult: result,
        generationHistory: [historyItem, ...prev.generationHistory.slice(0, 19)], // Keep last 20
        activeTab: 'generate',
      }));

      toast.success('Image generated successfully!');
      return result;

    } catch (error) {
      console.error('Image Studio generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
      
      setState(prev => ({
        ...prev,
        isGenerating: false,
        generationProgress: 0,
        error: errorMessage,
      }));
      
      toast.error(errorMessage);
      return null;
    }
  }, [state, practiceContext]);

  // Cancel generation
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState(prev => ({
      ...prev,
      isGenerating: false,
      generationProgress: 0,
    }));
  }, []);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setState(prev => ({
      ...prev,
      settings: DEFAULT_SETTINGS,
      currentResult: null,
      error: null,
    }));
  }, []);

  // Edit current result (reload into reference tab)
  const editCurrentResult = useCallback(() => {
    if (state.currentResult) {
      const refImage: ReferenceImage = {
        id: `edit-${Date.now()}`,
        name: 'Current Result',
        content: state.currentResult.url,
        type: 'image/png',
        mode: 'edit-source',
      };
      
      setState(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          referenceImages: [refImage],
          referenceMode: 'edit-source',
          referenceInstructions: '',
        },
        activeTab: 'reference',
        currentResult: null,
      }));
    }
  }, [state.currentResult]);

  return {
    ...state,
    updateSettings,
    setActiveTab,
    addReferenceImage,
    removeReferenceImage,
    loadPreviousResult,
    generateImage,
    cancelGeneration,
    resetSettings,
    editCurrentResult,
  };
}
