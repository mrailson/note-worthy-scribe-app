import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  MessageSquare, 
  Palette, 
  Building2, 
  Image as ImageIcon, 
  Sparkles,
  Images,
  PenLine,
  Plus,
  Loader2,
  Library,
  Lightbulb,
  X
} from 'lucide-react';
import { useImageStudio } from '@/hooks/useImageStudio';
import { useImageGallery } from '@/hooks/useImageGallery';
import { useStockImages } from '@/hooks/useStockImages';
import { ContextTab } from './studio/ContextTab';
import { StyleTab } from './studio/StyleTab';
import { BrandingTab } from './studio/BrandingTab';
import { ReferenceTab } from './studio/ReferenceTab';
import { GenerateTab } from './studio/GenerateTab';
import { EditImagePanel } from './studio/EditImagePanel';
import { StockImageLibrary } from './studio/StockImageLibrary';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// Lazy load ImageGalleryModal to break circular dependency
const ImageGalleryModal = lazy(() => import('./ImageGalleryModal').then(m => ({ default: m.ImageGalleryModal })));

// Onboarding key for localStorage
const ONBOARDING_KEY = 'image_studio_onboarded';

interface ImageStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageGenerationModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
  initialEditImage?: { url: string; name: string } | null;
  initialMode?: 'create' | 'edit' | 'stock';
  initialDescription?: string;
}

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  open,
  onOpenChange,
  imageGenerationModel = 'google/gemini-2.5-flash-image-preview',
  initialEditImage,
  initialMode,
  initialDescription,
}) => {
  const [showGallery, setShowGallery] = useState(false);
  const [studioMode, setStudioMode] = useState<'create' | 'edit' | 'stock'>(initialMode || 'create');
  const [pendingEditImage, setPendingEditImage] = useState<{ url: string; name: string } | null>(null);
  const [hasUploadedFiles, setHasUploadedFiles] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDING_KEY);
    } catch { return true; }
  });
  
  const { fetchImages } = useImageGallery();
  const { allImages: stockImages, isAdmin, replaceStockImage, isReplacing } = useStockImages({ enabled: false });

  // When initialEditImage is provided, switch to edit mode
  useEffect(() => {
    if (initialEditImage && open) {
      setStudioMode('edit');
    } else if (initialMode && open) {
      setStudioMode(initialMode);
    }
  }, [initialEditImage, initialMode, open]);


  // Clear pending edit image when modal closes
  useEffect(() => {
    if (!open) {
      setPendingEditImage(null);
    }
  }, [open]);
  
  const {
    settings,
    activeTab,
    isGenerating,
    generationProgress,
    currentResult,
    generationHistory,
    error,
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
  } = useImageStudio();

  // When initialDescription is provided, pre-fill the description
  useEffect(() => {
    if (initialDescription && open) {
      updateSettings({ description: initialDescription });
    }
  }, [initialDescription, open, updateSettings]);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try { localStorage.setItem(ONBOARDING_KEY, 'true'); } catch {}
  };

  const handleGenerate = () => {
    generateImage(imageGenerationModel);
  };

  const handleQuickEdit = async (imageContent: string, instructions: string, referenceImage?: string) => {
    // Always use Gemini 3 Pro for edits — most powerful and accurate
    return quickEdit(imageContent, instructions, 'google/gemini-3-pro-image-preview', referenceImage);
  };

  const tabs = [
    { id: 'context' as const, label: 'Content', icon: MessageSquare, step: 1 },
    { id: 'style' as const, label: 'Style', icon: Palette, step: 2 },
    { id: 'branding' as const, label: 'Branding', icon: Building2, step: 3 },
    { id: 'reference' as const, label: 'Reference', icon: ImageIcon, step: 4 },
    { id: 'generate' as const, label: 'Generate', icon: Sparkles, step: 5 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Image Studio
            </DialogTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowGallery(true)}
              >
                <Images className="h-4 w-4 mr-2" />
                My Gallery
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={resetSettings}
                className="text-muted-foreground"
              >
                Reset All
              </Button>
            </div>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex gap-2 mt-3">
            <Button
              variant={studioMode === 'create' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStudioMode('create')}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </Button>
            <Button
              variant={studioMode === 'edit' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStudioMode('edit')}
              className="flex-1"
            >
              <PenLine className="h-4 w-4 mr-2" />
              Edit Image
            </Button>
            <Button
              variant={studioMode === 'stock' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStudioMode('stock')}
              className="flex-1"
            >
              <Library className="h-4 w-4 mr-2" />
              Stock Library
            </Button>
          </div>
        </DialogHeader>

        {/* Edit Mode - Simplified Panel */}
        {studioMode === 'edit' && (
          <div className="flex-1 overflow-y-auto p-4">
            <EditImagePanel
              onQuickEdit={handleQuickEdit}
              onSaveToGallery={saveToGallery}
              onGallerySaved={fetchImages}
              isGenerating={isGenerating}
              progress={generationProgress}
              initialImage={pendingEditImage || initialEditImage}
              isAdmin={isAdmin}
              stockImages={stockImages}
              onReplaceStockImage={(image, newImageDataUrl) => replaceStockImage({ image, newImageDataUrl })}
              isReplacing={isReplacing}
            />
          </div>
        )}

        {/* Stock Library Mode */}
        {studioMode === 'stock' && (
          <div className="flex-1 overflow-y-auto p-4">
            <StockImageLibrary
              onUseInStudio={(url, name) => {
                setPendingEditImage({ url, name });
                setStudioMode('edit');
              }}
            />
          </div>
        )}

        {/* Create Mode - Full Tabs */}
        {studioMode === 'create' && (
          <Tabs 
            value={activeTab} 
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="flex-1 flex flex-col min-h-0 overflow-hidden"
          >
            <TabsList className="grid grid-cols-5 mx-4 mt-2 flex-shrink-0">
              {tabs.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id} className="gap-1.5 text-xs sm:text-sm">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-y-auto min-h-0 p-4">
              {/* First-time onboarding guide */}
              {showOnboarding && activeTab === 'context' && (
                <div className="mb-4 p-4 rounded-lg border border-primary/20 bg-primary/5 relative">
                  <button
                    onClick={dismissOnboarding}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                    aria-label="Dismiss guide"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Welcome to Image Studio!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Create professional posters, patient notices, and staff communications in 4 simple steps:
                      </p>
                      <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                        <li><strong>Context</strong> — Describe what you want and who it's for</li>
                        <li><strong>Style</strong> — Choose colours, layout, and visual tone</li>
                        <li><strong>Branding</strong> — Add your practice logo and colours</li>
                        <li><strong>Generate</strong> — Review and create your image</li>
                      </ol>
                      <p className="text-xs text-muted-foreground italic">
                        Try it: Click "Staff Poster" or "Patient Notice" above for a quick-start template.
                      </p>
                      <Button variant="outline" size="sm" onClick={dismissOnboarding} className="mt-1 h-7 text-xs">
                        Got it
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <TabsContent value="context" className="mt-0 data-[state=inactive]:hidden">
                <ContextTab settings={settings} onUpdate={updateSettings} onFilesChange={setHasUploadedFiles} />
              </TabsContent>

              <TabsContent value="style" className="mt-0 data-[state=inactive]:hidden">
                <StyleTab settings={settings} onUpdate={updateSettings} />
              </TabsContent>

              <TabsContent value="branding" className="mt-0 data-[state=inactive]:hidden">
                <BrandingTab settings={settings} onUpdate={updateSettings} />
              </TabsContent>

              <TabsContent value="reference" className="mt-0 data-[state=inactive]:hidden">
                <ReferenceTab 
                  settings={settings} 
                  onUpdate={updateSettings}
                  onAddReference={addReferenceImage}
                  onRemoveReference={removeReferenceImage}
                  onLoadPrevious={loadPreviousResult}
                  hasPreviousResult={generationHistory.length > 0}
                />
              </TabsContent>

              <TabsContent value="generate" className="mt-0 data-[state=inactive]:hidden">
                <GenerateTab
                  isGenerating={isGenerating}
                  progress={generationProgress}
                  currentResult={currentResult}
                  history={generationHistory}
                  error={error}
                  onGenerate={handleGenerate}
                  onCancel={cancelGeneration}
                  onEditResult={editCurrentResult}
                  onSelectHistoryItem={selectHistoryItem}
                  descriptionProvided={!!settings.description.trim() || !!settings.supportingContent?.trim() || hasUploadedFiles}
                  onSaveToGallery={saveToGallery}
                  onGallerySaved={fetchImages}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}

        {/* Quick navigation footer - only in create mode */}
        {studioMode === 'create' && (
          <div className="border-t p-3 flex items-center justify-between bg-muted/30">
            <div className="text-sm text-muted-foreground">
              {activeTab !== 'generate' ? (
                <span>
                  {settings.description ? '✓ Description set' : '○ Add description'}
                  {settings.referenceImages.length > 0 && ` • ${settings.referenceImages.length} reference(s)`}
                </span>
              ) : (
                <span>Ready to generate</span>
              )}
            </div>
            <div className="flex gap-2">
              {activeTab !== 'generate' && (
                <Button 
                  onClick={() => {
                    setActiveTab('generate');
                    handleGenerate();
                  }}
                  disabled={!settings.description.trim() && !settings.supportingContent?.trim() && !hasUploadedFiles && settings.referenceImages.length === 0}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
      
      {/* Image Gallery Modal - wrapped in Suspense for lazy loading */}
      <Suspense fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <ImageGalleryModal
          open={showGallery}
          onOpenChange={setShowGallery}
          onEditImage={(imageData) => {
            setPendingEditImage(imageData);
            setShowGallery(false);
            setStudioMode('edit');
          }}
        />
      </Suspense>
    </Dialog>
  );
};
