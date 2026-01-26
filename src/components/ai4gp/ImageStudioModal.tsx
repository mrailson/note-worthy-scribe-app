import React, { useState, useEffect } from 'react';
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
  Plus
} from 'lucide-react';
import { useImageStudio } from '@/hooks/useImageStudio';
import { useImageGallery } from '@/hooks/useImageGallery';
import { ContextTab } from './studio/ContextTab';
import { StyleTab } from './studio/StyleTab';
import { BrandingTab } from './studio/BrandingTab';
import { ReferenceTab } from './studio/ReferenceTab';
import { GenerateTab } from './studio/GenerateTab';
import { EditImagePanel } from './studio/EditImagePanel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageGalleryModal } from './ImageGalleryModal';
import { cn } from '@/lib/utils';

interface ImageStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageGenerationModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
  initialEditImage?: { url: string; name: string } | null;
}

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  open,
  onOpenChange,
  imageGenerationModel = 'google/gemini-2.5-flash-image-preview',
  initialEditImage,
}) => {
  const [showGallery, setShowGallery] = useState(false);
  const [studioMode, setStudioMode] = useState<'create' | 'edit'>('create');
  
  const { fetchImages } = useImageGallery();

  // When initialEditImage is provided, switch to edit mode
  useEffect(() => {
    if (initialEditImage && open) {
      setStudioMode('edit');
    }
  }, [initialEditImage, open]);
  
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

  const handleGenerate = () => {
    generateImage(imageGenerationModel);
  };

  const handleQuickEdit = async (imageContent: string, instructions: string) => {
    return quickEdit(imageContent, instructions, imageGenerationModel);
  };

  const tabs = [
    { id: 'context' as const, label: 'Context', icon: MessageSquare },
    { id: 'style' as const, label: 'Style', icon: Palette },
    { id: 'branding' as const, label: 'Branding', icon: Building2 },
    { id: 'reference' as const, label: 'Reference', icon: ImageIcon },
    { id: 'generate' as const, label: 'Generate', icon: Sparkles },
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
              initialImage={initialEditImage}
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
              <TabsContent value="context" className="mt-0 data-[state=inactive]:hidden">
                <ContextTab settings={settings} onUpdate={updateSettings} />
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
                  descriptionProvided={!!settings.description.trim()}
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
                <Button onClick={() => setActiveTab('generate')}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Go to Generate
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
      
      {/* Image Gallery Modal */}
      <ImageGalleryModal
        open={showGallery}
        onOpenChange={setShowGallery}
      />
    </Dialog>
  );
};
