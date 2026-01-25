import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { NHS_PALETTES } from '@/utils/colourPalettes';
import type {
  PresentationStudioSettings,
  PresentationStudioState,
  SupportingDocument,
  SlideTypeSelection,
  GeneratedPresentation,
  PresentationHistoryItem,
  GenerationPhase,
  PresentationStudioRequest,
  SlideTypeId,
  SLIDE_TYPES,
} from '@/types/presentationStudio';

// Default slide type configuration
const DEFAULT_SLIDE_TYPES: SlideTypeSelection[] = [
  { type: 'title', enabled: true, order: 1 },
  { type: 'executive-summary', enabled: true, order: 2 },
  { type: 'key-metrics', enabled: true, order: 3 },
  { type: 'insights', enabled: true, order: 4 },
  { type: 'recommendations', enabled: true, order: 5 },
  { type: 'timeline', enabled: true, order: 6 },
  { type: 'challenges', enabled: false, order: 7 },
  { type: 'questions', enabled: false, order: 8 },
  { type: 'appendix', enabled: false, order: 9 },
];

// Default settings
const DEFAULT_SETTINGS: PresentationStudioSettings = {
  // Content & Sources
  topic: '',
  presentationType: 'executive-overview',
  targetAudience: 'board-members',
  keyPoints: [],
  supportingDocuments: [],
  
  // Style & Design
  templateId: 'nhs-professional',
  colourPalette: NHS_PALETTES[0], // NHS Classic
  fontStyle: 'professional',
  useCustomColours: false,
  
  // Branding & Logo
  includeBranding: true,
  brandingLevel: 'name-contact',
  customPracticeName: '',
  logoImage: null,
  logoPlacement: 'header-right',
  includeFooterDate: true,
  includePageNumbers: true,
  customFooterText: '',
  
  // Slides Configuration
  slideCount: 4,
  slideTypes: DEFAULT_SLIDE_TYPES,
  complexityLevel: 'intermediate',
  generateImages: false,
  includeSpeakerNotes: true,
  includeVoiceover: false,
  voiceId: 'JBFqnCBsd6RMkjVDRZzb', // George - British Male Professional
};

export function usePresentationStudio() {
  const { practiceContext } = usePracticeContext();
  
  const [state, setState] = useState<PresentationStudioState>({
    settings: DEFAULT_SETTINGS,
    activeTab: 'content',
    isGenerating: false,
    generationPhase: 'idle',
    generationProgress: 0,
    currentResult: null,
    generationHistory: [],
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update settings
  const updateSettings = useCallback((updates: Partial<PresentationStudioSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
      error: null,
    }));
  }, []);

  // Set active tab
  const setActiveTab = useCallback((tab: PresentationStudioState['activeTab']) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  // Add supporting document
  const addDocument = useCallback((doc: SupportingDocument) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        supportingDocuments: [...prev.settings.supportingDocuments, doc],
      },
    }));
  }, []);

  // Remove supporting document
  const removeDocument = useCallback((docId: string) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        supportingDocuments: prev.settings.supportingDocuments.filter(d => d.id !== docId),
      },
    }));
  }, []);

  // Toggle document selection
  const toggleDocumentSelection = useCallback((docId: string) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        supportingDocuments: prev.settings.supportingDocuments.map(d => 
          d.id === docId ? { ...d, selected: !d.selected } : d
        ),
      },
    }));
  }, []);

  // Toggle slide type
  const toggleSlideType = useCallback((slideType: SlideTypeId) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        slideTypes: prev.settings.slideTypes.map(st => 
          st.type === slideType ? { ...st, enabled: !st.enabled } : st
        ),
      },
    }));
  }, []);

  // Reorder slide types
  const reorderSlideTypes = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const slideTypes = [...prev.settings.slideTypes];
      const [removed] = slideTypes.splice(fromIndex, 1);
      slideTypes.splice(toIndex, 0, removed);
      // Update order numbers
      const reordered = slideTypes.map((st, idx) => ({ ...st, order: idx + 1 }));
      return {
        ...prev,
        settings: { ...prev.settings, slideTypes: reordered },
      };
    });
  }, []);

  // Add key point
  const addKeyPoint = useCallback((point: string) => {
    if (point.trim()) {
      setState(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          keyPoints: [...prev.settings.keyPoints, point.trim()],
        },
      }));
    }
  }, []);

  // Remove key point
  const removeKeyPoint = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        keyPoints: prev.settings.keyPoints.filter((_, i) => i !== index),
      },
    }));
  }, []);

  // Update generation phase
  const setPhase = (phase: GenerationPhase, progress: number) => {
    setState(prev => ({ ...prev, generationPhase: phase, generationProgress: progress }));
  };

  // Generate presentation
  const generatePresentation = useCallback(async () => {
    const { settings } = state;
    
    if (!settings.topic.trim() && settings.supportingDocuments.length === 0) {
      toast.error('Please provide a topic or upload supporting documents');
      return null;
    }

    setState(prev => ({
      ...prev,
      isGenerating: true,
      generationPhase: 'preparing',
      generationProgress: 5,
      error: null,
    }));

    abortControllerRef.current = new AbortController();

    try {
      // Phase: Analyzing documents
      if (settings.supportingDocuments.length > 0) {
        setPhase('analyzing-documents', 15);
        await new Promise(r => setTimeout(r, 500));
      }

      // Build selected slide types
      const enabledSlideTypes = settings.slideTypes
        .filter(st => st.enabled)
        .sort((a, b) => a.order - b.order)
        .map(st => st.type);

      // Get template name for theme styling
      const getTemplateName = (templateId: string): string => {
        const templates: Record<string, string> = {
          'nhs-professional': 'NHS Professional Blue',
          'modern-minimal': 'Modern Minimal White',
          'executive-dark': 'Executive Dark Theme',
          'clinical-clean': 'Clinical Clean Teal',
          'friendly-warm': 'Friendly Warm Orange',
        };
        return templates[templateId] || templateId;
      };

      // Determine if this is a Gamma theme or local theme
      // For now, all our templates are local - Gamma themes would have IDs like 'gamma-xxx'
      const isGammaTheme = settings.templateId.startsWith('gamma-');
      const themeSource = isGammaTheme ? 'gamma' : 'local';

      // Build request with proper theme settings
      const request: PresentationStudioRequest = {
        topic: settings.topic || `Overview: ${settings.supportingDocuments[0]?.name || 'Presentation'}`,
        presentationType: settings.presentationType,
        targetAudience: settings.targetAudience,
        keyPoints: settings.keyPoints.length > 0 ? settings.keyPoints : undefined,
        slideCount: settings.slideCount,
        complexityLevel: settings.complexityLevel,
        slideTypes: enabledSlideTypes,
        templateId: settings.templateId,
        // Theme settings for Gamma API
        themeId: isGammaTheme ? settings.templateId.replace('gamma-', '') : undefined,
        themeSource,
        // Always send local theme style with colour palette
        localThemeStyle: {
          primaryColor: settings.colourPalette.primary,
          secondaryColor: settings.colourPalette.secondary,
          accentColor: settings.colourPalette.accent,
          themeName: getTemplateName(settings.templateId),
        },
        // Also send legacy colour palette for backwards compatibility
        colourPalette: {
          primary: settings.colourPalette.primary,
          secondary: settings.colourPalette.secondary,
          accent: settings.colourPalette.accent,
        },
        fontStyle: settings.fontStyle,
        generateImages: settings.generateImages,
        includeSpeakerNotes: settings.includeSpeakerNotes,
        includeVoiceover: settings.includeVoiceover,
        voiceId: settings.includeVoiceover ? settings.voiceId : undefined,
        practiceContext: practiceContext || undefined,
        brandingLevel: settings.includeBranding ? settings.brandingLevel : undefined,
        logoPlacement: settings.logoPlacement,
        customFooterText: settings.customFooterText || undefined,
        includeFooterDate: settings.includeFooterDate,
        includePageNumbers: settings.includePageNumbers,
        supportingFiles: settings.supportingDocuments
          .filter(d => d.selected)
          .map(d => ({
            name: d.name,
            content: d.content,
            type: d.type,
          })),
        isStudioRequest: true,
      };

      setPhase('generating-content', 30);

      console.log('🎬 Presentation Studio: Generating with settings:', {
        topic: settings.topic,
        type: settings.presentationType,
        slides: settings.slideCount,
        docsCount: settings.supportingDocuments.filter(d => d.selected).length,
      });

      // Call edge function
      const { data, error } = await supabase.functions.invoke('generate-powerpoint-gamma', {
        body: request,
      });

      if (error) throw error;

      setPhase('creating-slides', 60);

      if (!data?.success) {
        throw new Error(data?.error || 'Presentation generation failed');
      }

      // If voiceover requested, generate audio
      if (settings.includeVoiceover && data.presentation) {
        setPhase('generating-audio', 75);
        // This would call the voiceover generation - for now we skip
        await new Promise(r => setTimeout(r, 500));
      }

      setPhase('packaging', 90);

      const result: GeneratedPresentation = {
        id: `pres-${Date.now()}`,
        title: data.presentation?.title || settings.topic,
        slideCount: data.presentation?.slides?.length || settings.slideCount,
        downloadUrl: data.downloadUrl,
        pptxBase64: data.pptxBase64,
        gammaUrl: data.gammaUrl,
        hasVoiceover: settings.includeVoiceover && !!data.audioGenerated,
        generatedAt: new Date(),
      };

      // Add to history
      const historyItem: PresentationHistoryItem = {
        id: `hist-${Date.now()}`,
        timestamp: new Date(),
        settings: { ...settings },
        result,
      };

      setState(prev => ({
        ...prev,
        isGenerating: false,
        generationPhase: 'complete',
        generationProgress: 100,
        currentResult: result,
        generationHistory: [historyItem, ...prev.generationHistory.slice(0, 9)], // Keep last 10
        activeTab: 'generate',
      }));

      toast.success(`Presentation "${result.title}" generated with ${result.slideCount} slides!`);
      return result;

    } catch (error) {
      console.error('Presentation Studio generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate presentation';
      
      setState(prev => ({
        ...prev,
        isGenerating: false,
        generationPhase: 'error',
        generationProgress: 0,
        error: errorMessage,
      }));
      
      toast.error(errorMessage);
      return null;
    }
  }, [state, practiceContext]);

  // Download presentation
  const downloadPresentation = useCallback(async (withVoiceover: boolean = false) => {
    const result = state.currentResult;
    if (!result) {
      toast.error('No presentation to download');
      return;
    }

    try {
      if (result.downloadUrl) {
        // Direct download from URL
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = `${result.title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50)}.pptx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Presentation downloaded!');
      } else if (result.pptxBase64) {
        // Download from base64
        const byteCharacters = atob(result.pptxBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { 
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
        });
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${result.title.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50)}.pptx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Presentation downloaded!');
      } else {
        toast.error('No download available');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download presentation');
    }
  }, [state.currentResult]);

  // Cancel generation
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState(prev => ({
      ...prev,
      isGenerating: false,
      generationPhase: 'idle',
      generationProgress: 0,
    }));
    toast.info('Generation cancelled');
  }, []);

  // Reset settings
  const resetSettings = useCallback(() => {
    setState(prev => ({
      ...prev,
      settings: DEFAULT_SETTINGS,
      currentResult: null,
      error: null,
      generationPhase: 'idle',
    }));
  }, []);

  // Load from history
  const loadFromHistory = useCallback((historyItem: PresentationHistoryItem) => {
    setState(prev => ({
      ...prev,
      settings: { ...DEFAULT_SETTINGS, ...historyItem.settings },
      currentResult: historyItem.result,
      activeTab: 'generate',
    }));
  }, []);

  return {
    ...state,
    updateSettings,
    setActiveTab,
    addDocument,
    removeDocument,
    toggleDocumentSelection,
    toggleSlideType,
    reorderSlideTypes,
    addKeyPoint,
    removeKeyPoint,
    generatePresentation,
    downloadPresentation,
    cancelGeneration,
    resetSettings,
    loadFromHistory,
  };
}
