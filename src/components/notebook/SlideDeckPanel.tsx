import { useState } from 'react';
import { PowerPointGenerator } from '@/components/PowerPointGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Presentation, FileText, Sparkles, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { UploadedFile } from '@/types/ai4gp';
import type { PresentationContent, GenerationMetadata } from '@/types/presentation';
import { PRESENTATION_TEMPLATES } from '@/utils/presentationTemplates';

interface SlideDeckPanelProps {
  uploadedFiles: UploadedFile[];
}

const BRITISH_VOICES = [
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'British Female - Friendly' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'British Male - Professional' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'British Female - Clear' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'British Male - Authoritative' },
];

const SLIDE_COUNT_OPTIONS = [
  { value: 6, label: '6 Slides', description: 'Quick overview' },
  { value: 10, label: '10 Slides', description: 'Standard depth' },
  { value: 15, label: '15 Slides', description: 'Comprehensive' },
];

const PRESENTATION_TYPES = [
  { value: 'Executive Overview', label: 'Executive Overview', description: 'High-level strategic summary' },
  { value: 'Training Materials', label: 'Training Materials', description: 'Staff training content' },
  { value: 'Clinical Guidelines', label: 'Clinical Guidelines', description: 'Medical protocols' },
  { value: 'Patient Education', label: 'Patient Education', description: 'Patient-friendly materials' },
  { value: 'Research Presentation', label: 'Research Presentation', description: 'Academic findings' },
  { value: 'PCN Board Meetings', label: 'PCN Board Meeting', description: 'Governance meetings' },
  { value: 'Practice Partnership Meetings', label: 'Practice Partnership', description: 'Operational meetings' },
  { value: 'Neighbourhood Meetings', label: 'Neighbourhood Meeting', description: 'Community collaboration' },
  { value: 'Custom Topic', label: 'Custom Topic', description: 'General healthcare' }
];

export const SlideDeckPanel = ({ uploadedFiles }: SlideDeckPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [slideCount, setSlideCount] = useState(6);
  const [selectedVoice, setSelectedVoice] = useState(BRITISH_VOICES[0].id);
  const [selectedTemplate, setSelectedTemplate] = useState('nhs-branded-background');
  const [presentationType, setPresentationType] = useState('Executive Overview');
  const [preloadedContent, setPreloadedContent] = useState<{
    presentation: PresentationContent;
    metadata: GenerationMetadata;
    slideImages?: { [key: number]: string };
    voiceId?: string;
  } | undefined>(undefined);

  const handleQuickGenerate = async () => {
    if (uploadedFiles.length === 0) {
      toast.error('Please upload documents first');
      return;
    }

    setIsGenerating(true);
    try {
      // Extract topic from first document
      const firstDoc = uploadedFiles[0];
      const autoTopic = firstDoc.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

      // Generate presentation
      const { data, error } = await supabase.functions.invoke('generate-powerpoint', {
        body: {
          topic: autoTopic,
          presentationType,
          slideCount,
          complexityLevel: 'intermediate',
          templateId: selectedTemplate,
          supportingFiles: uploadedFiles.map(file => ({
            name: file.name,
            content: file.content,
            type: file.type
          }))
        }
      });

      if (error) throw error;

      if (data?.success && data?.presentation && data?.metadata) {
        toast.success('Presentation structure generated!');
        
        // Generate AI images for slides with imageDescription
        const slidesWithImages = data.presentation.slides
          .map((slide: any, index: number) => ({ slide, index }))
          .filter(({ slide }: any) => slide.imageDescription);
        
        const slideImages: { [key: number]: string } = {};
        
        if (slidesWithImages.length > 0) {
          toast.info(`Generating ${slidesWithImages.length} slide images...`);
          
          // Generate images sequentially to avoid overwhelming the API
          for (let i = 0; i < slidesWithImages.length; i++) {
            const { slide, index } = slidesWithImages[i];
            
            try {
              toast.loading(`Generating image ${i + 1}/${slidesWithImages.length}...`, {
                id: 'image-gen-progress'
              });
              
              const { data: imageData, error: imageError } = await supabase.functions.invoke(
                'generate-slide-images',
                {
                  body: {
                    imageDescription: slide.imageDescription,
                    slideTitle: slide.title
                  }
                }
              );
              
              if (!imageError && imageData?.success && imageData?.imageUrl) {
                slideImages[index] = imageData.imageUrl;
              } else {
                console.warn(`Failed to generate image for slide ${index}:`, imageError);
              }
            } catch (err) {
              console.warn(`Error generating image for slide ${index}:`, err);
            }
          }
          
          toast.dismiss('image-gen-progress');
          toast.success(`Generated ${Object.keys(slideImages).length} images!`);
        }
        
        // Set preloaded content with generated images
        setPreloadedContent({
          presentation: data.presentation,
          metadata: data.metadata,
          slideImages,
          voiceId: selectedVoice
        });
        setIsOpen(true);
      } else {
        throw new Error(data?.error || 'Failed to generate presentation');
      }
    } catch (error: any) {
      console.error('Error generating executive overview:', error);
      toast.error(error.message || 'Failed to generate executive overview');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    // Clear preloaded content when modal closes
    if (!open) {
      setPreloadedContent(undefined);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5" />
            Create Executive Overview
          </CardTitle>
          <CardDescription>
            Generate professional PowerPoint presentations with AI-generated images from your documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {uploadedFiles.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-lg">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No documents uploaded</p>
              <p className="text-sm text-muted-foreground">
                Please upload documents first to generate an executive overview
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Quick Executive Overview</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically generates slides with key insights, metrics, and AI-generated images from your {uploadedFiles.length} document{uploadedFiles.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="slideCount" className="text-xs">Slide Count</Label>
                      <Select value={slideCount.toString()} onValueChange={(v) => setSlideCount(parseInt(v))}>
                        <SelectTrigger id="slideCount" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SLIDE_COUNT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              <div>
                                <div className="font-medium text-xs">{option.label}</div>
                                <div className="text-[10px] text-muted-foreground">{option.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="presentationType" className="text-xs">Type</Label>
                      <Select value={presentationType} onValueChange={setPresentationType}>
                        <SelectTrigger id="presentationType" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESENTATION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div>
                                <div className="font-medium text-xs">{type.label}</div>
                                <div className="text-[10px] text-muted-foreground">{type.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="templateStyle" className="text-xs">Template</Label>
                      <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                        <SelectTrigger id="templateStyle" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESENTATION_TEMPLATES.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              <div>
                                <div className="font-medium text-xs">{template.name}</div>
                                <div className="text-[10px] text-muted-foreground">{template.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="voice" className="text-xs">Voice</Label>
                      <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger id="voice" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BRITISH_VOICES.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              <div>
                                <div className="font-medium text-xs">{voice.name}</div>
                                <div className="text-[10px] text-muted-foreground">{voice.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleQuickGenerate}
                    disabled={isGenerating}
                    size="lg"
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Generating Executive Overview...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 mr-2" />
                        Generate Executive Overview
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  onClick={() => setIsOpen(true)}
                  variant="outline"
                  className="w-full"
                >
                  <Presentation className="h-5 w-5 mr-2" />
                  Advanced PowerPoint Generator
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <PowerPointGenerator
        open={isOpen}
        onOpenChange={handleOpenChange}
        preloadedContent={preloadedContent}
      />
    </div>
  );
};
