import React from 'react';
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
  X
} from 'lucide-react';
import { useImageStudio } from '@/hooks/useImageStudio';
import { ContextTab } from './studio/ContextTab';
import { StyleTab } from './studio/StyleTab';
import { BrandingTab } from './studio/BrandingTab';
import { ReferenceTab } from './studio/ReferenceTab';
import { GenerateTab } from './studio/GenerateTab';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ImageStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageGenerationModel?: 'google/gemini-3-pro-image-preview' | 'google/gemini-2.5-flash-image-preview' | 'openai/gpt-image-1';
}

export const ImageStudioModal: React.FC<ImageStudioModalProps> = ({
  open,
  onOpenChange,
  imageGenerationModel = 'google/gemini-2.5-flash-image-preview',
}) => {
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
  } = useImageStudio();

  const handleGenerate = () => {
    generateImage(imageGenerationModel);
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
            <Button 
              variant="ghost" 
              size="sm"
              onClick={resetSettings}
              className="text-muted-foreground"
            >
              Reset All
            </Button>
          </div>
        </DialogHeader>

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
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Quick navigation footer */}
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
      </DialogContent>
    </Dialog>
  );
};
