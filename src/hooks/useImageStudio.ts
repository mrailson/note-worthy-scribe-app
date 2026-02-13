import { useState, useCallback, useRef, useEffect } from 'react';
import { safeSetItem } from '@/utils/localStorageManager';
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
import { optimiseImageForUpload, getBase64SizeKB } from '@/utils/imageOptimiser';

// Error codes from edge function
type ErrorCode = 'RATE_LIMIT' | 'CONTENT_MODERATION' | 'PAYMENT_REQUIRED' | 'TIMEOUT' | 'UNKNOWN';

// User-friendly error messages
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  RATE_LIMIT: 'The image service is temporarily busy. Please wait a moment and try again.',
  CONTENT_MODERATION: 'This request was blocked by content filters. Try simplifying your request or removing reference images.',
  PAYMENT_REQUIRED: 'Usage limit reached. Please check your Lovable workspace credits.',
  TIMEOUT: 'Image generation timed out. Try with a simpler request or different model.',
  UNKNOWN: 'Failed to generate image. Please try again.',
};

// Parse error response to extract code
function parseErrorCode(error: any): ErrorCode {
  const message = error?.message || error?.error || String(error);
  const code = error?.code;
  
  if (code === 'RATE_LIMIT' || message.includes('rate limit') || message.includes('429')) {
    return 'RATE_LIMIT';
  }
  if (code === 'CONTENT_MODERATION' || message.includes('moderation') || message.includes('blocked') || message.includes('PROHIBITED')) {
    return 'CONTENT_MODERATION';
  }
  if (code === 'PAYMENT_REQUIRED' || message.includes('payment') || message.includes('credit') || message.includes('402')) {
    return 'PAYMENT_REQUIRED';
  }
  if (message.includes('timeout') || message.includes('timed out') || message.includes('AbortError')) {
    return 'TIMEOUT';
  }
  return 'UNKNOWN';
}

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
    safeSetItem(HISTORY_STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.warn('Failed to save image studio history:', error);
  }
};

const DEFAULT_SETTINGS: ImageStudioSettings = {
  // Context & Content
  description: '',
  supportingContent: '',
  keyMessages: [],
  targetAudience: 'clinical',
  purpose: 'infographic',
  summariseSupportingContent: false,
  
  // Style & Design
  stylePreset: 'nhs-professional',
  colourPalette: NHS_PALETTES[0], // NHS Classic
  layoutPreference: 'landscape', // Default to landscape
  
  // Branding & Logo
  brandingLevel: 'none', // Default to no practice details
  customBranding: {
    name: false,
    address: false,
    phone: false,
    email: false,
    website: false,
    pcn: false,
  },
  customPracticeName: '',
  logoPlacement: 'top-right',
  includeLogo: false,
  logoSource: 'profile',
  customLogoData: null,
  
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

  // Generate image with retry logic and optimisation
  const generateImage = useCallback(async (imageModel?: string) => {
    const { settings } = state;
    
    if (!settings.description.trim()) {
      toast.error('Please provide a description of the image you want to create');
      return null;
    }

    setState(prev => ({ 
      ...prev, 
      isGenerating: true, 
      generationProgress: 5,
      error: null 
    }));

    abortControllerRef.current = new AbortController();

    // Determine if this is an edit request (has reference images)
    const isEditMode = settings.referenceImages.length > 0;
    const selectedModel = (imageModel as ImageStudioRequest['imageModel']) || 'google/gemini-3-pro-image-preview';
    
    // Fallback model for retry
    const fallbackModel = 'google/gemini-2.5-flash-image-preview';

    const attemptGeneration = async (model: string, isRetry = false): Promise<GeneratedImage | null> => {
      try {
        setState(prev => ({ ...prev, generationProgress: 10 }));

        // Process logo for integration (if enabled)
        let logoImageData: ImageStudioRequest['logoImage'] | undefined;
        
        if (settings.includeLogo) {
          const logoUrl = settings.logoSource === 'profile' 
            ? practiceContext?.logoUrl 
            : settings.customLogoData;
            
          if (logoUrl) {
            console.log('🖼️ Processing logo for integration...');
            try {
              let logoContent: string;
              
              // If it's already base64, use directly
              if (logoUrl.startsWith('data:')) {
                logoContent = logoUrl;
              } else {
                // Fetch and convert URL to base64
                console.log('📥 Fetching logo from URL...');
                const response = await fetch(logoUrl);
                const blob = await response.blob();
                logoContent = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
              }
              
              // Optimise logo if needed (target 300KB, 512px max)
              const logoSize = getBase64SizeKB(logoContent);
              console.log(`📊 Logo size: ${logoSize}KB`);
              
              if (logoSize > 300) {
                const optimised = await optimiseImageForUpload(logoContent, {
                  maxSizeKB: 300,
                  maxDimension: 512,
                  quality: 0.85
                });
                logoContent = optimised.optimised;
                console.log(`✅ Logo optimised: ${optimised.originalSizeKB}KB -> ${optimised.finalSizeKB}KB`);
              }
              
              logoImageData = {
                content: logoContent,
                placement: settings.logoPlacement,
              };
              console.log('✅ Logo ready for integration at:', settings.logoPlacement);
            } catch (logoErr) {
              console.warn('⚠️ Failed to process logo, continuing without:', logoErr);
              toast.warning('Could not process logo - generating without logo integration');
            }
          }
        }

        // Optimise reference images before sending (reduces payload size)
        let optimisedReferences: ImageStudioRequest['referenceImages'] | undefined;
        
        if (settings.referenceImages.length > 0) {
          console.log(`🖼️ Optimising ${settings.referenceImages.length} reference image(s)...`);
          const optimisedImages = await Promise.all(
            settings.referenceImages.map(async (img) => {
              const originalSize = getBase64SizeKB(img.content);
              console.log(`📊 Reference image "${img.name}": ${originalSize}KB`);
              
              // Only optimise if over 500KB to reduce edge function payload
              if (originalSize > 500) {
                const result = await optimiseImageForUpload(img.content, {
                  maxSizeKB: 600,
                  maxDimension: 1280,
                  quality: 0.8
                });
                console.log(`✅ Optimised: ${result.originalSizeKB}KB -> ${result.finalSizeKB}KB`);
                return {
                  content: result.optimised,
                  type: 'image/jpeg',
                  mode: img.mode,
                  instructions: settings.referenceInstructions || undefined,
                };
              }
              
              return {
                content: img.content,
                type: img.type,
                mode: img.mode,
                instructions: settings.referenceInstructions || undefined,
              };
            })
          );
          optimisedReferences = optimisedImages;
        }

        setState(prev => ({ ...prev, generationProgress: 25 }));

        // Build the request
        const request: ImageStudioRequest = {
          prompt: settings.description,
          supportingContent: settings.supportingContent || undefined,
          summariseSupportingContent: settings.summariseSupportingContent || undefined,
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
          customPracticeName: settings.customPracticeName || undefined,
          logoPlacement: settings.logoPlacement,
          includeLogo: settings.includeLogo,
          logoImage: logoImageData,
          referenceImages: optimisedReferences,
          imageModel: model as ImageStudioRequest['imageModel'],
          isStudioRequest: true,
        };

        // Log request details for debugging
        const estimatedPayloadSize = JSON.stringify(request).length / 1024;
        console.log('🎨 Image Studio: Generating image with settings:', {
          purpose: settings.purpose,
          style: settings.stylePreset,
          model,
          isRetry,
          isEditMode,
          referenceCount: settings.referenceImages.length,
          referenceMode: settings.referenceMode,
          hasLogoIntegration: !!logoImageData,
          logoPlacement: logoImageData ? settings.logoPlacement : null,
          estimatedPayloadKB: Math.round(estimatedPayloadSize),
        });

        setState(prev => ({ ...prev, generationProgress: 40 }));

        const { data, error } = await supabase.functions.invoke('ai4gp-image-generation', {
          body: request,
        });

        setState(prev => ({ ...prev, generationProgress: 80 }));

        if (error) {
          console.error('🔴 Supabase function error:', error);
          throw { message: error.message, code: 'UNKNOWN' };
        }

        // Check for error in response data (from edge function)
        if (data?.error) {
          console.error('🔴 Edge function returned error:', data.error, data.code);
          throw { message: data.error, code: data.code || 'UNKNOWN' };
        }

        if (!data?.image?.url) {
          console.error('🔴 No image URL in response:', data);
          throw { message: 'No image was generated', code: 'UNKNOWN' };
        }

        console.log('✅ Image generated successfully');

        const result: GeneratedImage = {
          url: data.image.url,
          alt: data.image.alt || settings.description.substring(0, 100),
          prompt: settings.description,
          requestType: data.image.requestType || (settings.purpose === 'banner' ? 'general' : settings.purpose as GeneratedImage['requestType']),
        };

        return result;
      } catch (err) {
        const errorCode = parseErrorCode(err);
        console.error(`🔴 Generation attempt failed (${errorCode}):`, err);
        
        // For edit mode, try fallback model on certain errors
        if (isEditMode && !isRetry && model !== fallbackModel) {
          const retriableErrors: ErrorCode[] = ['TIMEOUT', 'UNKNOWN'];
          if (retriableErrors.includes(errorCode)) {
            console.log(`🔄 Retrying with fallback model: ${fallbackModel}`);
            toast.info('Retrying with alternative model...');
            return attemptGeneration(fallbackModel, true);
          }
        }
        
        throw { message: ERROR_MESSAGES[errorCode], code: errorCode, original: err };
      }
    };

    try {
      const result = await attemptGeneration(selectedModel);
      
      if (result) {
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
          generationHistory: [historyItem, ...prev.generationHistory.slice(0, 19)],
          activeTab: 'generate',
        }));

        toast.success('Image generated successfully!');
        return result;
      }
      
      return null;
    } catch (error: any) {
      console.error('Image Studio generation error:', error);
      const errorMessage = error?.message || ERROR_MESSAGES.UNKNOWN;
      
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

  // Quick edit: streamlined image editing flow
  const quickEdit = useCallback(async (
    imageContent: string,
    editInstructions: string,
    imageModel?: string
  ): Promise<GeneratedImage | null> => {
    if (!imageContent || !editInstructions.trim()) {
      toast.error('Please provide an image and editing instructions');
      return null;
    }

    // Set up state for editing
    setState(prev => ({
      ...prev,
      isGenerating: true,
      generationProgress: 5,
      error: null,
    }));

    const selectedModel = (imageModel as ImageStudioRequest['imageModel']) || 'google/gemini-3-pro-image-preview';
    const fallbackModel = 'google/gemini-2.5-flash-image-preview';

    const attemptEdit = async (model: string, isRetry = false): Promise<GeneratedImage | null> => {
      try {
        setState(prev => ({ ...prev, generationProgress: 15 }));

        // Optimise image before sending
        let optimisedContent = imageContent;
        const originalSize = getBase64SizeKB(imageContent);
        console.log(`📊 Quick edit image: ${originalSize}KB`);
        
        if (originalSize > 500) {
          const result = await optimiseImageForUpload(imageContent, {
            maxSizeKB: 600,
            maxDimension: 1280,
            quality: 0.8
          });
          optimisedContent = result.optimised;
          console.log(`✅ Optimised: ${result.originalSizeKB}KB -> ${result.finalSizeKB}KB`);
        }

        setState(prev => ({ ...prev, generationProgress: 30 }));

        // Build simplified edit request
        const request: ImageStudioRequest = {
          prompt: editInstructions,
          referenceImages: [{
            content: optimisedContent,
            type: 'image/jpeg',
            mode: 'edit-source',
            instructions: editInstructions,
          }],
          imageModel: model as ImageStudioRequest['imageModel'],
          isStudioRequest: true,
        };

        console.log('🎨 Quick Edit: Sending request with model:', model);

        setState(prev => ({ ...prev, generationProgress: 50 }));

        const { data, error } = await supabase.functions.invoke('ai4gp-image-generation', {
          body: request,
        });

        setState(prev => ({ ...prev, generationProgress: 85 }));

        if (error) {
          console.error('🔴 Supabase function error:', error);
          throw { message: error.message, code: 'UNKNOWN' };
        }

        if (data?.error) {
          console.error('🔴 Edge function returned error:', data.error, data.code);
          throw { message: data.error, code: data.code || 'UNKNOWN' };
        }

        if (!data?.image?.url) {
          console.error('🔴 No image URL in response:', data);
          throw { message: 'No image was generated', code: 'UNKNOWN' };
        }

        console.log('✅ Quick edit successful');

        const result: GeneratedImage = {
          url: data.image.url,
          alt: data.image.alt || editInstructions.substring(0, 100),
          prompt: editInstructions,
        };

        return result;
      } catch (err) {
        const errorCode = parseErrorCode(err);
        console.error(`🔴 Quick edit attempt failed (${errorCode}):`, err);

        if (!isRetry && model !== fallbackModel) {
          const retriableErrors: ErrorCode[] = ['TIMEOUT', 'UNKNOWN'];
          if (retriableErrors.includes(errorCode)) {
            console.log(`🔄 Retrying quick edit with fallback model: ${fallbackModel}`);
            toast.info('Retrying with alternative model...');
            return attemptEdit(fallbackModel, true);
          }
        }

        throw { message: ERROR_MESSAGES[errorCode], code: errorCode, original: err };
      }
    };

    try {
      const result = await attemptEdit(selectedModel);

      if (result) {
        // Add to history
        const historyItem: GenerationHistoryItem = {
          id: `edit-${Date.now()}`,
          timestamp: new Date(),
          settings: { description: editInstructions },
          result,
        };

        setState(prev => ({
          ...prev,
          isGenerating: false,
          generationProgress: 100,
          currentResult: result,
          generationHistory: [historyItem, ...prev.generationHistory.slice(0, 19)],
        }));

        toast.success('Image edited successfully!');
        return result;
      }

      return null;
    } catch (error: any) {
      console.error('Quick edit error:', error);
      const errorMessage = error?.message || ERROR_MESSAGES.UNKNOWN;

      setState(prev => ({
        ...prev,
        isGenerating: false,
        generationProgress: 0,
        error: errorMessage,
      }));

      toast.error(errorMessage);
      return null;
    }
  }, []);

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
    quickEdit,
  };
}

// Helper to generate a title from description
function generateImageTitle(description: string): string {
  if (!description) return 'Untitled Image';
  const words = description.trim().split(/\s+/).slice(0, 6);
  return words.join(' ') + (description.split(/\s+/).length > 6 ? '...' : '');
}
