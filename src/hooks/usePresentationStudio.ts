import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { useAuth } from '@/contexts/AuthContext';
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
  customInstructions: '',
};

// Keys for persisted settings (Branding & Slides tabs)
const STORAGE_KEY_PREFIX = 'presentation-studio-settings';
const HISTORY_KEY_PREFIX = 'presentation-studio-history';

// Settings that persist per user (Branding + Slides tabs)
interface PersistedSettings {
  // Branding
  includeBranding: boolean;
  brandingLevel: PresentationStudioSettings['brandingLevel'];
  customPracticeName: string;
  logoImage: string | null;
  logoPlacement: PresentationStudioSettings['logoPlacement'];
  includeFooterDate: boolean;
  includePageNumbers: boolean;
  customFooterText: string;
  colourPalette: PresentationStudioSettings['colourPalette'];
  // Slides
  slideCount: number;
  slideTypes: SlideTypeSelection[];
  complexityLevel: PresentationStudioSettings['complexityLevel'];
  includeSpeakerNotes: boolean;
  generateImages: boolean;
  includeVoiceover: boolean;
  voiceId: string;
}

const getStorageKey = (userId: string) => `${STORAGE_KEY_PREFIX}-${userId}`;
const getHistoryKey = (userId: string) => `${HISTORY_KEY_PREFIX}-${userId}`;

const loadPersistedSettings = (userId: string): Partial<PersistedSettings> | null => {
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load persisted presentation settings:', e);
  }
  return null;
};

const savePersistedSettings = (userId: string, settings: PresentationStudioSettings) => {
  try {
    const toStore: PersistedSettings = {
      // Branding
      includeBranding: settings.includeBranding,
      brandingLevel: settings.brandingLevel,
      customPracticeName: settings.customPracticeName,
      logoImage: settings.logoImage,
      logoPlacement: settings.logoPlacement,
      includeFooterDate: settings.includeFooterDate,
      includePageNumbers: settings.includePageNumbers,
      customFooterText: settings.customFooterText,
      colourPalette: settings.colourPalette,
      // Slides
      slideCount: settings.slideCount,
      slideTypes: settings.slideTypes,
      complexityLevel: settings.complexityLevel,
      includeSpeakerNotes: settings.includeSpeakerNotes,
      generateImages: settings.generateImages,
      includeVoiceover: settings.includeVoiceover,
      voiceId: settings.voiceId,
    };
    localStorage.setItem(getStorageKey(userId), JSON.stringify(toStore));
  } catch (e) {
    console.warn('Failed to save presentation settings:', e);
  }
};

// History persistence — stores metadata + downloadUrl (excludes pptxBase64 to save space)
const loadPersistedHistory = (userId: string): PresentationHistoryItem[] => {
  try {
    const stored = localStorage.getItem(getHistoryKey(userId));
    if (stored) {
      const parsed = JSON.parse(stored) as PresentationHistoryItem[];
      // Rehydrate dates
      return parsed.map(item => ({
        ...item,
        timestamp: new Date(item.timestamp),
        result: {
          ...item.result,
          generatedAt: new Date(item.result.generatedAt),
        },
      }));
    }
  } catch (e) {
    console.warn('Failed to load presentation history:', e);
  }
  return [];
};

const savePersistedHistory = (userId: string, history: PresentationHistoryItem[]) => {
  try {
    // Strip pptxBase64 to avoid exceeding localStorage limits
    const lightweight = history.slice(0, 50).map(item => ({
      ...item,
      result: {
        ...item.result,
        pptxBase64: undefined, // Too large for localStorage
      },
    }));
    localStorage.setItem(getHistoryKey(userId), JSON.stringify(lightweight));
  } catch (e) {
    console.warn('Failed to save presentation history:', e);
  }
};

// Presentation Studio hook with persisted Branding & Slides settings
export function usePresentationStudio() {
  const { user } = useAuth();
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
  const hasLoadedRef = useRef(false);

  // Load persisted settings + history on mount (once per user)
  useEffect(() => {
    if (user?.id && !hasLoadedRef.current) {
      const persisted = loadPersistedSettings(user.id);
      const history = loadPersistedHistory(user.id);
      
      setState(prev => ({
        ...prev,
        settings: persisted ? { ...prev.settings, ...persisted } : prev.settings,
        generationHistory: history.length > 0 ? history : prev.generationHistory,
      }));
      
      if (persisted || history.length > 0) {
        console.log(`📂 Loaded persisted settings${history.length > 0 ? ` + ${history.length} history items` : ''}`);
      }
      hasLoadedRef.current = true;
    }
  }, [user?.id]);

  // Save settings whenever Branding or Slides settings change
  useEffect(() => {
    if (user?.id && hasLoadedRef.current) {
      savePersistedSettings(user.id, state.settings);
    }
  }, [
    user?.id,
    state.settings.includeBranding,
    state.settings.brandingLevel,
    state.settings.customPracticeName,
    state.settings.logoImage,
    state.settings.logoPlacement,
    state.settings.includeFooterDate,
    state.settings.includePageNumbers,
    state.settings.customFooterText,
    state.settings.colourPalette,
    state.settings.slideCount,
    state.settings.slideTypes,
    state.settings.complexityLevel,
    state.settings.includeSpeakerNotes,
    state.settings.generateImages,
    state.settings.includeVoiceover,
    state.settings.voiceId,
  ]);

  // Save history whenever it changes
  useEffect(() => {
    if (user?.id && hasLoadedRef.current && state.generationHistory.length > 0) {
      savePersistedHistory(user.id, state.generationHistory);
    }
  }, [user?.id, state.generationHistory]);

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

  // Update document content (for when extraction completes)
  const updateDocument = useCallback((docId: string, updates: Partial<SupportingDocument>) => {
    setState(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        supportingDocuments: prev.settings.supportingDocuments.map(d => 
          d.id === docId ? { ...d, ...updates } : d
        ),
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
        customInstructions: settings.customInstructions?.trim() || undefined,
      };

      setPhase('generating-content', 30);

      console.log('🎬 Presentation Studio: Generating with settings:', {
        topic: settings.topic,
        type: settings.presentationType,
        slides: settings.slideCount,
        docsCount: settings.supportingDocuments.filter(d => d.selected).length,
      });

      // Phase 1: Start generation — edge function returns immediately with generationId
      const { data: startData, error: startError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
        body: request,
      });

      if (startError) throw startError;
      if (!startData?.generationId) throw new Error(startData?.error || 'Failed to start generation');

      const generationId = startData.generationId;
      console.log(`🎬 Generation started: ${generationId} — polling for completion`);

      // Phase 2: Poll for completion from the client side
      // This avoids the edge function hitting Supabase's ~150s execution limit
      const maxPollDuration = settings.slideCount > 10
        ? 60_000 + settings.slideCount * 10_000  // e.g. 30 slides ≈ 360s
        : 180_000;                                 // ≤10 slides → 3 min
      const pollInterval = 5_000; // 5 seconds between polls
      const pollStart = Date.now();

      let data: any = null;

      while (Date.now() - pollStart < maxPollDuration) {
        await new Promise(r => setTimeout(r, pollInterval));

        // Update progress based on elapsed time
        const elapsed = Date.now() - pollStart;
        const progressPct = Math.min(30 + (elapsed / maxPollDuration) * 55, 85);
        setPhase('generating-content', Math.round(progressPct));

        const { data: pollData, error: pollError } = await supabase.functions.invoke('generate-powerpoint-gamma', {
          body: { action: 'poll', generationId },
        });

        if (pollError) {
          console.warn('Poll request failed, retrying...', pollError);
          continue; // Retry on transient errors
        }

        if (pollData?.status === 'completed') {
          data = pollData;
          break;
        }

        if (pollData?.status === 'failed') {
          throw new Error(pollData.error || 'Gamma generation failed');
        }

        console.log(`⏳ Still generating... (${Math.round(elapsed / 1000)}s elapsed)`);
      }

      if (!data) {
        throw new Error(
          `Presentation generation timed out after ${Math.round(maxPollDuration / 1000)}s. ` +
          `Try reducing the slide count or simplifying supporting materials.`
        );
      }

      setPhase('creating-slides', 60);

      if (!data?.success) {
        throw new Error(data?.error || 'Presentation generation failed');
      }

      // If voiceover requested, run full audio pipeline
      let voiceoverDownloadUrl: string | undefined;
      let voiceoverPptxBase64: string | undefined;
      let hasVoiceover = false;

      if (settings.includeVoiceover) {
        try {
          // Step 1: Generate narration scripts from the topic/content
          setPhase('generating-audio', 75);
          console.log('🎤 Voiceover: Generating narration scripts...');

          const { data: scriptsData, error: scriptsError } = await supabase.functions.invoke('generate-presentation-scripts', {
            body: {
              topic: settings.topic || 'Presentation',
              content: settings.supportingDocuments
                .filter(d => d.selected && d.content)
                .map(d => d.content)
                .join('\n\n') || settings.topic,
              slideCount: settings.slideCount,
            },
          });

          if (scriptsError) throw new Error(scriptsError.message || 'Failed to generate scripts');

          const scripts = scriptsData?.scripts || [];
          console.log(`🎤 Voiceover: Generated ${scripts.length} narration scripts`);

          if (scripts.length > 0) {
            // Step 2: Generate audio for each slide
            const slidesWithAudio: Array<{
              slideNumber: number;
              title: string;
              bullets: string[];
              speakerNotes: string;
              audioBase64?: string;
            }> = [];

            for (let i = 0; i < scripts.length; i++) {
              const script = scripts[i];
              const progressPct = 75 + ((i / scripts.length) * 10); // 75-85%
              setPhase('generating-audio', Math.round(progressPct));

              const slide = {
                slideNumber: script.slideNumber,
                title: script.title,
                bullets: script.narrationScript
                  .split(/[.!?]+/)
                  .map((s: string) => s.trim())
                  .filter((s: string) => s.length > 10)
                  .slice(0, 5),
                speakerNotes: script.narrationScript,
                audioBase64: undefined as string | undefined,
              };

              try {
                console.log(`🎤 Voiceover: Generating audio for slide ${i + 1}/${scripts.length}...`);
                const { data: audioData, error: audioError } = await supabase.functions.invoke('generate-slide-narration', {
                  body: {
                    slideNumber: script.slideNumber,
                    slideContent: script.title,
                    speakerNotes: script.narrationScript,
                    voiceId: settings.voiceId || 'JBFqnCBsd6RMkjVDRZzb',
                  },
                });

                if (!audioError && audioData?.audioBase64) {
                  slide.audioBase64 = audioData.audioBase64;
                  console.log(`🎤 Voiceover: Audio generated for slide ${i + 1}`);
                } else {
                  console.warn(`🎤 Voiceover: No audio for slide ${i + 1}:`, audioError || 'No data');
                }
              } catch (err) {
                console.error(`🎤 Voiceover: Audio error for slide ${i + 1}:`, err);
              }

              slidesWithAudio.push(slide);
            }

            const audioCount = slidesWithAudio.filter(s => s.audioBase64).length;
            console.log(`🎤 Voiceover: Audio generated for ${audioCount}/${scripts.length} slides`);

            // Step 3: Build PPTX with embedded notes and audio
            setPhase('packaging', 90);
            console.log('🎤 Voiceover: Building PPTX with embedded audio...');

            const { data: pptxData, error: pptxError } = await supabase.functions.invoke('generate-pptx-with-audio', {
              body: {
                title: settings.topic || 'Presentation',
                slides: slidesWithAudio,
              },
            });

            if (!pptxError && pptxData?.success && pptxData?.pptxBase64) {
              voiceoverPptxBase64 = pptxData.pptxBase64;
              hasVoiceover = true;
              console.log('🎤 Voiceover: PPTX with audio ready!');
              toast.success(`Voiceover added: ${audioCount} audio clips embedded`);
            } else {
              console.error('🎤 Voiceover: PPTX build failed:', pptxError || pptxData?.error);
              toast.warning('Voiceover packaging failed — downloading slides without audio');
            }
          }
        } catch (voiceoverError) {
          console.error('🎤 Voiceover pipeline failed:', voiceoverError);
          toast.warning('Voiceover generation failed — downloading slides without audio');
        }
      }

      setPhase('packaging', 95);

      const result: GeneratedPresentation = {
        id: `pres-${Date.now()}`,
        title: data.presentation?.title || settings.topic,
        slideCount: data.presentation?.slides?.length || settings.slideCount,
        downloadUrl: hasVoiceover ? undefined : data.downloadUrl,
        pptxBase64: hasVoiceover ? voiceoverPptxBase64 : data.pptxBase64,
        gammaUrl: data.gammaUrl,
        hasVoiceover,
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
        generationHistory: [historyItem, ...prev.generationHistory.slice(0, 49)], // Keep last 50
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
  const downloadPresentation = useCallback(async (withVoiceover: boolean = false, customResult?: GeneratedPresentation) => {
    const result = customResult || state.currentResult;
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
    updateDocument,
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
