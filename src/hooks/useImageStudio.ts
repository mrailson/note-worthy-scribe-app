import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useAuth } from '@/contexts/AuthContext';
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

const HISTORY_STORAGE_KEY = 'image-studio-history';
const MAX_HISTORY_ITEMS = 20;

// Helper to load history from localStorage
const loadHistoryFromStorage = (): GenerationHistoryItem[] => {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    // Convert date strings back to Date objects
    return parsed.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp),
    }));
  } catch (error) {
    console.warn('Failed to load image studio history:', error);
    return [];
  }
};

// Helper to save history to localStorage
const saveHistoryToStorage = (history: GenerationHistoryItem[]) => {
  try {
    // Only store the last MAX_HISTORY_ITEMS
    const toStore = history.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.warn('Failed to save image studio history:', error);
  }
};

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
  brandingLevel: 'name-only',
  customBranding: {
    name: true,
    address: false,
    phone: false,
    email: false,
    website: false,
    pcn: false,
  },
  logoPlacement: 'top-right',
  includeLogo: false,
  
  // Reference Images
  referenceImages: [],
  referenceMode: 'style-reference',
  referenceInstructions: '',
};

export function useImageStudio() {
  const { user } = useAuth();
  const { practiceContext } = usePracticeContext();
  
  const [state, setState] = useState<ImageStudioState>(() => ({
    settings: DEFAULT_SETTINGS,
    activeTab: 'context',
    isGenerating: false,
    generationProgress: 0,
    currentResult: null,
    generationHistory: loadHistoryFromStorage(), // Load persisted history on init
    error: null,
  }));
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (state.generationHistory.length > 0) {
      saveHistoryToStorage(state.generationHistory);
    }
  }, [state.generationHistory]);

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
        imageModel: (imageModel as ImageStudioRequest['imageModel']) || 'google/gemini-3-pro-image-preview',
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

      // Check for error in response data (from edge function)
      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.image?.url) {
        throw new Error('No image was generated');
      }

      const result: GeneratedImage = {
        url: data.image.url,
        alt: data.image.alt || settings.description.substring(0, 100),
        prompt: settings.description,
        requestType: data.image.requestType || (settings.purpose === 'banner' ? 'general' : settings.purpose as GeneratedImage['requestType']),
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

  // Select a history item to view/edit
  const selectHistoryItem = useCallback((item: GenerationHistoryItem) => {
    setState(prev => ({
      ...prev,
      currentResult: item.result,
      activeTab: 'generate',
    }));
  }, []);

  // Save current result to gallery database
  const saveToGallery = useCallback(async (result: GeneratedImage): Promise<string | null> => {
    if (!user?.id || !result?.url) return null;

    try {
      const { data, error } = await supabase
        .from('user_generated_images')
        .insert({
          user_id: user.id,
          image_url: result.url,
          prompt: result.prompt || state.settings.description,
          detailed_prompt: JSON.stringify(state.settings),
          alt_text: result.alt,
          image_settings: JSON.parse(JSON.stringify({
            purpose: state.settings.purpose,
            style: state.settings.stylePreset,
            layout: state.settings.layoutPreference,
          })),
          source: 'image-studio',
          title: generateImageTitle(state.settings.description),
          is_favourite: false,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (err) {
      console.error('Failed to save image to gallery:', err);
      toast.error('Failed to save image to gallery');
      return null;
    }
  }, [user?.id, state.settings]);

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
    selectHistoryItem,
    saveToGallery,
  };
}

// Helper to generate a title from description
function generateImageTitle(description: string): string {
  if (!description) return 'Untitled Image';
  const words = description.trim().split(/\s+/).slice(0, 6);
  return words.join(' ') + (description.split(/\s+/).length > 6 ? '...' : '');
}
