import React from 'react'; // Presentation Studio Modal
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Palette, 
  Building2, 
  LayoutGrid, 
  Sparkles,
  Presentation
} from 'lucide-react';
import { usePresentationStudio } from '@/hooks/usePresentationStudio';
import { ContentTab } from './presentation-studio/ContentTab';
import { StyleTab } from './presentation-studio/StyleTab';
import { BrandingTab } from './presentation-studio/BrandingTab';
import { SlidesTab } from './presentation-studio/SlidesTab';
import { GenerateTab } from './presentation-studio/GenerateTab';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PresentationStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PresentationStudioModal: React.FC<PresentationStudioModalProps> = ({
  open,
  onOpenChange,
}) => {
  const {
    settings,
    activeTab,
    isGenerating,
    generationPhase,
    generationProgress,
    currentResult,
    generationHistory,
    error,
    updateSettings,
    setActiveTab,
    addDocument,
    updateDocument,
    removeDocument,
    toggleDocumentSelection,
    toggleSlideType,
    addKeyPoint,
    removeKeyPoint,
    generatePresentation,
    downloadPresentation,
    cancelGeneration,
    resetSettings,
    loadFromHistory,
  } = usePresentationStudio();

  const tabs = [
    { id: 'content' as const, label: 'Content', icon: FileText },
    { id: 'style' as const, label: 'Style', icon: Palette },
    { id: 'branding' as const, label: 'Branding', icon: Building2 },
    { id: 'slides' as const, label: 'Slides', icon: LayoutGrid },
    { id: 'generate' as const, label: 'Generate', icon: Sparkles },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Presentation className="h-5 w-5 text-primary" />
              Presentation Studio
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
            <TabsContent value="content" className="mt-0 data-[state=inactive]:hidden">
              <ContentTab 
                settings={settings} 
                onUpdate={updateSettings}
                onAddDocument={addDocument}
                onUpdateDocument={updateDocument}
                onRemoveDocument={removeDocument}
                onToggleDocument={toggleDocumentSelection}
                onAddKeyPoint={addKeyPoint}
                onRemoveKeyPoint={removeKeyPoint}
              />
            </TabsContent>

            <TabsContent value="style" className="mt-0 data-[state=inactive]:hidden">
              <StyleTab settings={settings} onUpdate={updateSettings} />
            </TabsContent>

            <TabsContent value="branding" className="mt-0 data-[state=inactive]:hidden">
              <BrandingTab settings={settings} onUpdate={updateSettings} />
            </TabsContent>

            <TabsContent value="slides" className="mt-0 data-[state=inactive]:hidden">
              <SlidesTab 
                settings={settings} 
                onUpdate={updateSettings}
                onToggleSlideType={toggleSlideType}
              />
            </TabsContent>

            <TabsContent value="generate" className="mt-0 data-[state=inactive]:hidden">
              <GenerateTab
                settings={settings}
                isGenerating={isGenerating}
                phase={generationPhase}
                progress={generationProgress}
                currentResult={currentResult}
                history={generationHistory}
                error={error}
                onGenerate={generatePresentation}
                onDownload={downloadPresentation}
                onCancel={cancelGeneration}
                onLoadHistory={loadFromHistory}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Quick navigation footer */}
        <div className="border-t p-3 flex items-center justify-between bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {activeTab !== 'generate' ? (
              <span>
                {settings.topic ? '✓ Topic set' : '○ Add topic'}
                {settings.supportingDocuments.length > 0 && ` • ${settings.supportingDocuments.length} doc(s)`}
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
