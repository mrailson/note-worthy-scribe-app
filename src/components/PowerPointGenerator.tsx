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
import { Download, Presentation, Loader2, Eye, Edit2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PptxGenJS from "pptxgenjs";

interface PowerPointGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SlideContent {
  title: string;
  type: string;
  content: string[];
  notes?: string;
  meetingSection?: string;
}

interface PresentationContent {
  title: string;
  slides: SlideContent[];
}

interface GenerationMetadata {
  topic: string;
  presentationType: string;
  slideCount: number;
  complexityLevel: string;
  generatedAt: string;
}

const presentationTypes = [
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

export const PowerPointGenerator = ({ open, onOpenChange }: PowerPointGeneratorProps) => {
  const [currentStep, setCurrentStep] = useState<'input' | 'generating' | 'preview' | 'download'>('input');
  const [topic, setTopic] = useState("");
  const [presentationType, setPresentationType] = useState("");
  const [complexityLevel, setComplexityLevel] = useState("intermediate");
  const [slideCount, setSlideCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [presentationContent, setPresentationContent] = useState<PresentationContent | null>(null);
  const [metadata, setMetadata] = useState<GenerationMetadata | null>(null);

  const resetState = () => {
    setCurrentStep('input');
    setTopic("");
    setPresentationType("");
    setComplexityLevel("intermediate");
    setSlideCount(10);
    setIsGenerating(false);
    setGenerationProgress(0);
    setPresentationContent(null);
    setMetadata(null);
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen && !isGenerating) {
      resetState();
    }
    onOpenChange(newOpen);
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
          complexityLevel
        }
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      if (error) throw error;

      if (data?.success && data?.presentation) {
        setPresentationContent(data.presentation);
        setMetadata(data.metadata);
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

  const downloadPowerPoint = async () => {
    if (!presentationContent) return;

    setCurrentStep('download');
    
    try {
      const pptx = new PptxGenJS();
      
      // Set presentation properties
      pptx.author = "Notewell AI";
      pptx.company = "NHS Healthcare";
      pptx.title = presentationContent.title;
      pptx.subject = metadata?.topic || "";

      // Create slides
      presentationContent.slides.forEach((slideData) => {
        const slide = pptx.addSlide();

        // Add title
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

        // Add content bullets
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

        // Add notes if available
        if (slideData.notes) {
          slide.addNotes(slideData.notes);
        }
      });

      // Generate and download the file
      const fileName = `${presentationContent.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pptx`;
      
      await pptx.writeFile({ fileName });
      
      toast.success("PowerPoint presentation downloaded successfully!");
      setCurrentStep('preview');
      
    } catch (error) {
      console.error("Error generating PowerPoint file:", error);
      toast.error("Failed to generate PowerPoint file");
      setCurrentStep('preview');
    }
  };

  const renderInputStep = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Presentation Topic</label>
        <Textarea
          placeholder="Enter your presentation topic (e.g., 'Diabetes Management in Primary Care', 'New NHS Quality Standards')"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="min-h-[100px]"
        />
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

      <div className="flex items-center justify-between pt-4">
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
    </div>
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
          <p className="text-sm text-muted-foreground">
            {presentationContent?.slides.length} slides • {metadata?.presentationType} • {metadata?.complexityLevel} level
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCurrentStep('input')}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Details
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
                  <Badge variant="outline">{slide.type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
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