import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Presentation, Loader2, Eye, Edit2, CheckCircle, Mic, FileUp, ChevronDown, X, Palette, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { SimpleFileUpload } from "@/components/SimpleFileUpload";
import { TemplateSelector } from "@/components/TemplateSelector";
import { BackgroundImageUploader } from "@/components/BackgroundImageUploader";
import { AnimationPicker } from "@/components/AnimationPicker";
import { GlobalDesignControls } from "@/components/GlobalDesignControls";
import { DocumentContextPanel } from "@/components/DocumentContextPanel";
import { useFileUpload } from "@/hooks/useFileUpload";
import { usePresentationHistory } from "@/hooks/usePresentationHistory";
import { UploadedFile } from "@/types/ai4gp";
import { SlideContent, PresentationContent, GenerationMetadata, SlideAnimation } from "@/types/presentation";
import { generateEnhancedPowerPoint } from "@/utils/enhancedPresentationGenerator";
import { getTemplateById, PRESENTATION_TEMPLATES } from "@/utils/presentationTemplates";
import PptxGenJS from "pptxgenjs";
import defaultPptBackground from "@/assets/default-ppt-background.jpg";

interface PowerPointGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preloadedContent?: {
    presentation: PresentationContent;
    metadata: GenerationMetadata;
    slideImages?: { [key: number]: string };
    voiceId?: string;
    sessionId?: string;
  };
}

// Types are now imported from types/presentation.ts

const BRITISH_VOICES = [
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'British Female - Friendly' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'British Male - Professional' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'British Female - Clear' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'British Male - Authoritative' },
];

const presentationTypes = [
  { value: "Executive Overview", label: "Executive Overview", description: "High-level strategic summary with key insights, metrics, and recommendations" },
  { value: "Clinical Guidelines", label: "Clinical Guidelines", description: "Evidence-based medical guidelines and protocols" },
  { value: "Patient Education", label: "Patient Education", description: "Patient-friendly educational materials" },
  { value: "Training Materials", label: "Training Materials", description: "Staff training and development content" },
  { value: "Research Presentation", label: "Research Presentation", description: "Academic research findings and methodology" },
  { value: "PCN Board Meetings", label: "PCN Board Meeting", description: "Primary Care Network governance meetings" },
  { value: "Practice Partnership Meetings", label: "Practice Partnership Meeting", description: "Practice partnership and operational meetings" },
  { value: "Neighbourhood Meetings", label: "Neighbourhood Meeting", description: "Community healthcare collaboration meetings" },
  { value: "Custom Topic", label: "Custom Topic", description: "General healthcare presentation" }
];

const complexityLevels = [
  { value: "basic", label: "Basic", description: "Simple, easy-to-understand content" },
  { value: "intermediate", label: "Intermediate", description: "Moderate detail and complexity" },
  { value: "advanced", label: "Advanced", description: "Detailed, technical content" }
];

export const PowerPointGenerator = ({ open, onOpenChange, preloadedContent }: PowerPointGeneratorProps) => {
  const [currentStep, setCurrentStep] = useState<'input' | 'generating' | 'preview' | 'download'>('input');
  const [topic, setTopic] = useState("");
  const [presentationType, setPresentationType] = useState("Executive Overview");
  const [complexityLevel, setComplexityLevel] = useState("intermediate");
  const [slideCount, setSlideCount] = useState(10);
  const [selectedTemplate, setSelectedTemplate] = useState(PRESENTATION_TEMPLATES[0].id);
  const [backgroundImage, setBackgroundImage] = useState<string>(defaultPptBackground);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [presentationContent, setPresentationContent] = useState<PresentationContent | null>(null);
  const [metadata, setMetadata] = useState<GenerationMetadata | null>(null);
  const [preloadedImages, setPreloadedImages] = useState<{ [key: number]: string } | undefined>(undefined);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('Xb7hH8MSUJpSbSDYk0k2'); // Alice default
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const { saveSession, updateSession } = usePresentationHistory();

  // Load preloaded content when modal opens
  React.useEffect(() => {
    if (open && preloadedContent) {
      setPresentationContent(preloadedContent.presentation);
      setMetadata(preloadedContent.metadata);
      setPreloadedImages(preloadedContent.slideImages);
      if (preloadedContent.voiceId) {
        setSelectedVoiceId(preloadedContent.voiceId);
      }
      if (preloadedContent.sessionId) {
        setSavedSessionId(preloadedContent.sessionId);
      }
      setCurrentStep('preview');
      setTopic(preloadedContent.metadata.topic);
      setPresentationType(preloadedContent.metadata.presentationType);
      setSlideCount(preloadedContent.metadata.slideCount);
    }
  }, [open, preloadedContent]);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [editingSlide, setEditingSlide] = useState<SlideContent | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<boolean[]>([]);
  const [slideAnimations, setSlideAnimations] = useState<SlideAnimation[]>([]);
  const [titleFontSize, setTitleFontSize] = useState(32);
  const [contentFontSize, setContentFontSize] = useState(16);
  const [globalAnimation, setGlobalAnimation] = useState<SlideAnimation>({
    type: 'none',
    duration: 500,
    delay: 200,
    elementOrder: true
  });
  const { processFiles, isProcessing } = useFileUpload();

  const resetState = () => {
    setCurrentStep('input');
    setTopic("");
    setPresentationType("");
    setComplexityLevel("intermediate");
    setSlideCount(10);
    setSelectedTemplate(PRESENTATION_TEMPLATES[0].id);
    setBackgroundImage('');
    setIsGenerating(false);
    setGenerationProgress(0);
    setPresentationContent(null);
    setMetadata(null);
    setEditingSlideIndex(null);
    setEditingSlide(null);
    setUploadedFiles([]);
    setShowFileUpload(false);
    setSelectedFiles([]);
    setSlideAnimations([]);
    setTitleFontSize(32);
    setContentFontSize(16);
    setGlobalAnimation({
      type: 'none',
      duration: 500,
      delay: 200,
      elementOrder: true
    });
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen && !isGenerating) {
      resetState();
    }
    onOpenChange(newOpen);
  };

  const handleVoiceTranscription = (transcription: string) => {
    setTopic(transcription);
    toast.success("Voice transcription completed!");
  };

  const handleFileUpload = async (files: File[]) => {
    try {
      const fileList = new DataTransfer();
      files.forEach(file => fileList.items.add(file));
      const processedFiles = await processFiles(fileList.files);
      setUploadedFiles(prev => [...prev, ...processedFiles]);
      // Initialize selected files array
      setSelectedFiles(prev => [...prev, ...Array(processedFiles.length).fill(true)]);
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleFileSelection = (index: number) => {
    setSelectedFiles(prev => {
      const updated = [...prev];
      updated[index] = !updated[index];
      return updated;
    });
  };

  const generatePresentation = async () => {
    if (!topic.trim() || !presentationType) {
      toast.error("Please provide a topic and select a presentation type");
      return;
    }

    setIsGenerating(true);
    setCurrentStep('generating');
    setGenerationProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 80));
      }, 500);

      const { data, error } = await supabase.functions.invoke('generate-powerpoint', {
        body: {
          topic,
          presentationType,
          slideCount,
          complexityLevel,
          templateId: selectedTemplate,
          backgroundImage: backgroundImage || undefined,
          animations: slideAnimations.length > 0 ? slideAnimations : undefined,
          globalAnimation: globalAnimation.type !== 'none' ? globalAnimation : undefined,
          titleFontSize,
          contentFontSize,
          supportingFiles: uploadedFiles
            .filter((_, index) => selectedFiles[index] !== false)
            .map(file => ({
              name: file.name,
              content: file.content,
              type: file.type
            }))
        }
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      if (error) throw error;

      if (data?.success && data?.presentation) {
        setPresentationContent(data.presentation);
        setMetadata(data.metadata);
        // Initialize animations for each slide if not already set
        if (slideAnimations.length === 0) {
          setSlideAnimations(Array(data.presentation.slides.length).fill({
            type: 'none',
            duration: 500,
            delay: 200,
            elementOrder: true
          }));
        }
        setCurrentStep('preview');
        toast.success("Presentation generated successfully!");
      } else {
        throw new Error(data?.error || "Failed to generate presentation");
      }
    } catch (error: any) {
      console.error("Error generating presentation:", error);
      toast.error(error.message || "Failed to generate presentation");
      setCurrentStep('input');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const startEditSlide = (slideIndex: number) => {
    if (presentationContent && presentationContent.slides[slideIndex]) {
      setEditingSlideIndex(slideIndex);
      setEditingSlide({ ...presentationContent.slides[slideIndex] });
    }
  };

  const cancelEditSlide = () => {
    setEditingSlideIndex(null);
    setEditingSlide(null);
  };

  const saveEditSlide = () => {
    if (editingSlideIndex !== null && editingSlide && presentationContent) {
      const updatedSlides = [...presentationContent.slides];
      updatedSlides[editingSlideIndex] = editingSlide;
      setPresentationContent({
        ...presentationContent,
        slides: updatedSlides
      });
      setEditingSlideIndex(null);
      setEditingSlide(null);
      toast.success("Slide updated successfully!");
    }
  };

  const updateEditingSlideContent = (field: keyof SlideContent, value: any) => {
    if (editingSlide) {
      setEditingSlide({
        ...editingSlide,
        [field]: value
      });
    }
  };

  const handleAnimationChange = (slideIndex: number, animation: SlideAnimation) => {
    setSlideAnimations(prev => {
      const updated = [...prev];
      // Ensure the array is long enough
      while (updated.length <= slideIndex) {
        updated.push({
          type: 'none',
          duration: 500,
          delay: 200,
          elementOrder: true
        });
      }
      updated[slideIndex] = animation;
      return updated;
    });
  };

  const handleSavePresentation = async () => {
    if (!presentationContent || !metadata) {
      toast.error("No presentation to save");
      return;
    }

    try {
      const voiceName = BRITISH_VOICES.find(v => v.id === selectedVoiceId)?.name || 'Alice';
      const sourceDocuments = uploadedFiles.map(f => f.name);

      if (savedSessionId) {
        // Update existing session
        await updateSession(savedSessionId, {
          title: presentationContent.title,
          topic: metadata.topic,
          presentation_type: metadata.presentationType,
          template_id: selectedTemplate,
          slide_count: presentationContent.slides.length,
          complexity_level: metadata.complexityLevel,
          voice_id: selectedVoiceId,
          voice_name: voiceName,
          slides: presentationContent.slides,
          slide_images: preloadedImages,
          source_documents: sourceDocuments,
          background_image: backgroundImage
        });
      } else {
        // Create new session
        const result = await saveSession({
          title: presentationContent.title,
          topic: metadata.topic,
          presentation_type: metadata.presentationType,
          template_id: selectedTemplate,
          slide_count: presentationContent.slides.length,
          complexity_level: metadata.complexityLevel,
          voice_id: selectedVoiceId,
          voice_name: voiceName,
          slides: presentationContent.slides,
          slide_images: preloadedImages,
          source_documents: sourceDocuments,
          background_image: backgroundImage
        });
        if (result) {
          setSavedSessionId(result.id);
        }
      }
    } catch (error) {
      console.error("Error saving presentation:", error);
    }
  };

  const downloadPowerPoint = async () => {
    if (!presentationContent || !metadata) {
      toast.error("No presentation content available");
      return;
    }

    try {
      const template = getTemplateById(selectedTemplate);
      if (!template) {
        toast.error("Selected template not found");
        return;
      }

      // Generate audio narration for slides with speaker notes
      let slideAudio: { [slideIndex: number]: string } = {};
      const slidesWithNotes = presentationContent.slides.filter(slide => slide.notes);
      
      if (slidesWithNotes.length > 0) {
        toast.info("Generating narration...");
        
        try {
          const audioPromises = presentationContent.slides.map(async (slide, index) => {
            if (!slide.notes) return null;
            
            const { data, error } = await supabase.functions.invoke('generate-slide-narration', {
              body: {
                slideNumber: index + 1,
                slideContent: slide.content?.join(' ') || slide.title,
                speakerNotes: slide.notes,
                voiceId: selectedVoiceId
              }
            });
            
            if (error) {
              console.error(`Error generating audio for slide ${index + 1}:`, error);
              return null;
            }
            
            return { index, audioBase64: data.audioBase64 };
          });
          
          const audioResults = await Promise.all(audioPromises);
          audioResults.forEach(result => {
            if (result) {
              slideAudio[result.index] = result.audioBase64;
            }
          });
          
          toast.success("Narration generated successfully!");
        } catch (audioError) {
          console.error("Error generating audio:", audioError);
          toast.warning("Continuing without audio narration");
        }
      }

      await generateEnhancedPowerPoint({
        template: backgroundImage ? { ...template, backgroundImage } : template,
        content: presentationContent,
        metadata,
        titleFontSize,
        contentFontSize,
        globalAnimation: globalAnimation.type !== 'none' ? globalAnimation : undefined,
        slideImages: preloadedImages,
        slideAudio
      });
      
      toast.success("Enhanced PowerPoint presentation downloaded successfully!");
      setCurrentStep('preview');
      
    } catch (error) {
      console.error("Error generating enhanced PowerPoint file:", error);
      toast.error("Failed to generate PowerPoint file");
      
      // Fallback to basic generation
      try {
        const pptx = new PptxGenJS();
        
        pptx.author = "Notewell AI";
        pptx.company = "NHS Healthcare";
        pptx.title = presentationContent.title;
        pptx.subject = metadata?.topic || "";

        presentationContent.slides.forEach((slideData) => {
          const slide = pptx.addSlide();

          slide.addText(slideData.title, {
            x: 0.5,
            y: 0.5,
            w: 9,
            h: 1,
            fontSize: 28,
            fontFace: "Calibri",
            color: "1f4e79",
            bold: true
          });

          if (slideData.content && slideData.content.length > 0) {
            const bulletText = slideData.content.map(point => `• ${point}`).join('\n');
            slide.addText(bulletText, {
              x: 0.5,
              y: 1.8,
              w: 9,
              h: 5,
              fontSize: 18,
              fontFace: "Calibri",
              color: "333333"
            });
          }

          if (slideData.notes) {
            slide.addNotes(slideData.notes);
          }
        });

        const fileName = `${presentationContent.title.replace(/[^a-zA-Z0-9]/g, '_')}_fallback_${new Date().toISOString().split('T')[0]}.pptx`;
        await pptx.writeFile({ fileName });
        
        toast.success("PowerPoint presentation downloaded (basic format)");
        setCurrentStep('preview');
        
      } catch (fallbackError) {
        console.error("Fallback generation also failed:", fallbackError);
        toast.error("Failed to generate PowerPoint file");
        setCurrentStep('preview');
      }
    }
  };

  const renderInputStep = () => (
    <Tabs defaultValue="content" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="content" className="flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Content
        </TabsTrigger>
        <TabsTrigger value="template" className="flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Design
        </TabsTrigger>
        <TabsTrigger value="background" className="flex items-center gap-2">
          <Presentation className="w-4 h-4" />
          Background
        </TabsTrigger>
        <TabsTrigger value="files" className="flex items-center gap-2">
          <FileUp className="w-4 h-4" />
          Context ({uploadedFiles.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="content" className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Presentation Topic</label>
          <div className="relative">
            <Textarea
              placeholder="Enter your presentation topic (e.g., 'Diabetes Management in Primary Care', 'New NHS Quality Standards')"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="min-h-[100px] pr-12"
            />
            <div className="absolute top-2 right-2">
              <VoiceRecorder 
                onTranscription={handleVoiceTranscription}
                disabled={isProcessing}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Presentation Type</label>
            <Select value={presentationType} onValueChange={setPresentationType}>
              <SelectTrigger>
                <SelectValue placeholder="Select presentation type" />
              </SelectTrigger>
              <SelectContent>
                {presentationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Complexity Level</label>
            <Select value={complexityLevel} onValueChange={setComplexityLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {complexityLevels.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    <div>
                      <div className="font-medium">{level.label}</div>
                      <div className="text-xs text-muted-foreground">{level.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="template" className="space-y-6">
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Choose Your Presentation Style</h3>
            <p className="text-sm text-muted-foreground">
              Select a template that matches your presentation needs and audience
            </p>
          </div>
          
          <TemplateSelector
            selectedTemplate={selectedTemplate}
            onTemplateSelect={setSelectedTemplate}
            showPreview={true}
          />
          
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground">
              <strong>Selected:</strong> {PRESENTATION_TEMPLATES.find(t => t.id === selectedTemplate)?.name} - 
              {PRESENTATION_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
            </div>
          </div>

          <Separator />

          {/* Global Design Controls */}
          <GlobalDesignControls
            titleFontSize={titleFontSize}
            contentFontSize={contentFontSize}
            globalAnimation={globalAnimation}
            onTitleFontSizeChange={setTitleFontSize}
            onContentFontSizeChange={setContentFontSize}
            onGlobalAnimationChange={setGlobalAnimation}
          />
        </div>
      </TabsContent>

      <TabsContent value="background" className="space-y-6">
        <BackgroundImageUploader
          onImageUpload={setBackgroundImage}
          onImageRemove={() => setBackgroundImage('')}
          currentImage={backgroundImage}
        />
      </TabsContent>

      <TabsContent value="files">
        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-4">
            <div className="text-sm text-muted-foreground">
              Upload documents to provide additional context for your presentation (PDF, Word, Excel, Images, Text files)
            </div>
            
            <SimpleFileUpload
              onFileUpload={handleFileUpload}
              accept=".pdf,.docx,.xlsx,.txt,.png,.jpg,.jpeg,.gif"
              maxSize={10}
              multiple
            />
          </div>

          <DocumentContextPanel
            uploadedFiles={uploadedFiles}
            onToggleFileSelection={toggleFileSelection}
            selectedFiles={selectedFiles}
          />
        </div>
      </TabsContent>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          Generate a professional PowerPoint presentation with AI assistance
        </div>
        <Button 
          onClick={generatePresentation}
          disabled={!topic.trim() || !presentationType}
          className="flex items-center gap-2"
        >
          <Presentation className="w-4 h-4" />
          Generate Presentation
        </Button>
      </div>
    </Tabs>
  );

  const renderGeneratingStep = () => (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <div>
          <h3 className="text-lg font-semibold">Generating Your Presentation</h3>
          <p className="text-muted-foreground">AI is creating your PowerPoint slides...</p>
        </div>
      </div>
      
      <div className="space-y-2">
        <Progress value={generationProgress} className="w-full" />
        <p className="text-sm text-muted-foreground">
          {generationProgress < 30 && "Analyzing your topic..."}
          {generationProgress >= 30 && generationProgress < 60 && "Creating slide content..."}
          {generationProgress >= 60 && generationProgress < 90 && "Structuring presentation..."}
          {generationProgress >= 90 && "Finalizing slides..."}
        </p>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{presentationContent?.title}</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{presentationContent?.slides.length} slides</span>
            <span>•</span>
            <span>{metadata?.presentationType}</span>
            <span>•</span>
            <span>{metadata?.complexityLevel} level</span>
            <span>•</span>
            <Badge variant="outline" className="text-xs">
              {PRESENTATION_TEMPLATES.find(t => t.id === selectedTemplate)?.name}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCurrentStep('input')}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Details
          </Button>
          <Button variant="outline" onClick={handleSavePresentation}>
            <Save className="w-4 h-4 mr-2" />
            {savedSessionId ? 'Update' : 'Save to History'}
          </Button>
          <Button onClick={downloadPowerPoint}>
            <Download className="w-4 h-4 mr-2" />
            Download PowerPoint
          </Button>
        </div>
      </div>

      <Separator />

      <ScrollArea className="h-[400px] w-full">
        <div className="space-y-4">
          {presentationContent?.slides.map((slide, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Slide {index + 1}: {slide.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{slide.type}</Badge>
                    <AnimationPicker
                      slideIndex={index}
                      currentAnimation={slideAnimations[index]}
                      onAnimationChange={handleAnimationChange}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditSlide(index)}
                      disabled={editingSlideIndex === index}
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingSlideIndex === index && editingSlide ? (
                  // Edit mode
                  <div className="space-y-4 border-l-4 border-primary pl-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Slide Title</label>
                      <input
                        type="text"
                        value={editingSlide.title}
                        onChange={(e) => updateEditingSlideContent('title', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md text-sm"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Content Points</label>
                      {editingSlide.content.map((point, pointIndex) => (
                        <div key={pointIndex} className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm">•</span>
                          <input
                            type="text"
                            value={point}
                            onChange={(e) => {
                              const updatedContent = [...editingSlide.content];
                              updatedContent[pointIndex] = e.target.value;
                              updateEditingSlideContent('content', updatedContent);
                            }}
                            className="flex-1 px-2 py-1 border border-border rounded text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updatedContent = editingSlide.content.filter((_, i) => i !== pointIndex);
                              updateEditingSlideContent('content', updatedContent);
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const updatedContent = [...editingSlide.content, "New bullet point"];
                          updateEditingSlideContent('content', updatedContent);
                        }}
                        className="mt-2"
                      >
                        + Add Point
                      </Button>
                    </div>

                    {editingSlide.notes && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Speaker Notes</label>
                        <Textarea
                          value={editingSlide.notes}
                          onChange={(e) => updateEditingSlideContent('notes', e.target.value)}
                          className="text-xs"
                          rows={3}
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={cancelEditSlide}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={saveEditSlide}>
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <>
                    <div className="space-y-1">
                      {slide.content.map((point, pointIndex) => (
                        <div key={pointIndex} className="flex items-start gap-2 text-sm">
                          <span className="text-muted-foreground">•</span>
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                    {slide.notes && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground font-medium mb-1">Speaker Notes:</p>
                        <p className="text-xs text-muted-foreground">{slide.notes}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const renderDownloadStep = () => (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center space-y-4">
        <CheckCircle className="w-12 h-12 text-green-500" />
        <div>
          <h3 className="text-lg font-semibold">Presentation Downloaded</h3>
          <p className="text-muted-foreground">Your PowerPoint file has been generated and downloaded</p>
        </div>
      </div>
      
      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={() => setCurrentStep('preview')}>
          <Eye className="w-4 h-4 mr-2" />
          View Preview
        </Button>
        <Button onClick={() => handleClose(false)}>
          Close
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="w-5 h-5 text-primary" />
            PowerPoint Presentation Generator
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-6">
          {currentStep === 'input' && renderInputStep()}
          {currentStep === 'generating' && renderGeneratingStep()}
          {currentStep === 'preview' && renderPreviewStep()}
          {currentStep === 'download' && renderDownloadStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
};