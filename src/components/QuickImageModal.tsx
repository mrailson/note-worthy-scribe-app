import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Download, Wand2, Edit, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePracticeContext } from "@/hooks/usePracticeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QuickPick {
  id: string;
  title: string;
  description: string;
  basePrompt: string;
  size: { width: number; height: number };
  category: string;
}

interface GeneratedImage {
  id: string;
  image_url: string;
  prompt: string;
  detailed_prompt?: string;
  quick_pick_id?: string;
  alt_text?: string;
  created_at: string;
}

const practiceQuickPicks: QuickPick[] = [
  {
    id: "dna-reminder",
    title: "DNA Reminder Poster",
    description: "Professional A4 poster about missed appointments",
    basePrompt: "Create a professional NHS-style A4 poster about missed appointments (DNA - Did Not Attend). Clean design with NHS blue accents, clear typography, includes practice contact information and rebooking instructions. Professional medical practice communication style.",
    size: { width: 768, height: 1024 },
    category: "Practice Communication"
  },
  {
    id: "flu-campaign",
    title: "Flu Campaign Social",
    description: "Square social media tile for flu vaccination promotion",
    basePrompt: "Design a square social media post promoting flu vaccination. Bright, friendly NHS style with vaccination imagery, clear call-to-action, practice branding. Suitable for Facebook, Instagram, Twitter. Encouraging and professional tone.",
    size: { width: 1024, height: 1024 },
    category: "Health Promotion"
  },
  {
    id: "opening-hours",
    title: "Opening Hours Notice",
    description: "Clean A4 notice board style with practice hours",
    basePrompt: "Create a clean, professional A4 notice for practice opening hours. NHS branding, clear typography, easy-to-read schedule format. Include emergency contact information and out-of-hours guidance. Notice board appropriate design.",
    size: { width: 768, height: 1024 },
    category: "Practice Information"
  },
  {
    id: "staff-appreciation",
    title: "Staff Appreciation Post",
    description: "Square social media celebrating team",
    basePrompt: "Design a warm, appreciative social media post celebrating practice staff. Professional but friendly tone, team-focused imagery, NHS values, suitable for practice social media channels. Positive and engaging design.",
    size: { width: 1024, height: 1024 },
    category: "Team Recognition"
  },
  {
    id: "service-update",
    title: "Service Update Announcement",
    description: "Landscape banner for service changes",
    basePrompt: "Create a professional landscape banner announcing practice service updates. Clear, informative design with NHS branding, space for service details, professional communication style. Suitable for website headers or email communications.",
    size: { width: 1536, height: 1024 },
    category: "Service Communication"
  }
];

export const QuickImageModal = ({ open, onOpenChange }: QuickImageModalProps) => {
  const { user } = useAuth();
  const { practiceDetails } = usePracticeContext();
  
  const [activeTab, setActiveTab] = useState("quick-picks");
  const [selectedQuickPick, setSelectedQuickPick] = useState<QuickPick | null>(null);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [detailedPrompt, setDetailedPrompt] = useState("");
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GeneratedImage[]>([]);
  const [generationProgress, setGenerationProgress] = useState("");
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  useEffect(() => {
    if (open && user) {
      fetchGalleryImages();
    }
  }, [open, user]);

  const fetchGalleryImages = async () => {
    try {
      const { data, error } = await supabase
        .from('user_generated_images')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setGalleryImages(data || []);
    } catch (error) {
      console.error("Error fetching gallery images:", error);
    }
  };

  const enhancePromptWithPractice = (basePrompt: string): string => {
    if (!practiceDetails) return basePrompt;
    
    let enhanced = basePrompt;
    if (practiceDetails.practice_name) {
      enhanced += ` Include practice name: "${practiceDetails.practice_name}".`;
    }
    if (practiceDetails.contact_phone) {
      enhanced += ` Contact phone: ${practiceDetails.contact_phone}.`;
    }
    
    return enhanced;
  };

  const generateAltText = (prompt: string): string => {
    const cleanPrompt = prompt.toLowerCase();
    if (cleanPrompt.includes('poster')) return `Medical practice poster: ${prompt.slice(0, 100)}`;
    if (cleanPrompt.includes('social')) return `Social media post: ${prompt.slice(0, 100)}`;
    if (cleanPrompt.includes('banner')) return `Practice banner: ${prompt.slice(0, 100)}`;
    return `Generated medical practice image: ${prompt.slice(0, 100)}`;
  };

  const saveToGallery = async (imageUrl: string, prompt: string, detailedPrompt?: string, quickPickId?: string) => {
    try {
      const altText = generateAltText(prompt);
      const { error } = await supabase
        .from('user_generated_images')
        .insert({
          user_id: user!.id,
          image_url: imageUrl,
          prompt: prompt,
          detailed_prompt: detailedPrompt,
          quick_pick_id: quickPickId,
          alt_text: altText,
          image_settings: selectedQuickPick ? { size: selectedQuickPick.size } : {}
        });

      if (error) throw error;
      await fetchGalleryImages();
    } catch (error) {
      console.error("Error saving to gallery:", error);
    }
  };

  const handleQuickPickSelect = (quickPick: QuickPick) => {
    setSelectedQuickPick(quickPick);
    setQuickPrompt(quickPick.title);
    setDetailedPrompt(enhancePromptWithPractice(quickPick.basePrompt));
    setActiveTab("generate");
  };

  const handleGenerate = async () => {
    const promptToUse = detailedPrompt || quickPrompt;
    if (!promptToUse.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setGenerationProgress("Processing prompt...");
    
    try {
      setGenerationProgress("Generating image...");
      
      const requestFormData = new FormData();
      requestFormData.append('prompt', promptToUse);
      requestFormData.append('size', selectedQuickPick ? `${selectedQuickPick.size.width}x${selectedQuickPick.size.height}` : '1024x1024');
      requestFormData.append('quality', 'high');
      requestFormData.append('mode', 'generation');

      const { data, error } = await supabase.functions.invoke('advanced-image-generation', {
        body: requestFormData
      });

      if (error) throw error;

      if (data?.success && data?.imageData) {
        setGeneratedImage(data.imageData);
        setGenerationProgress("Saving to gallery...");
        await saveToGallery(data.imageData, quickPrompt, detailedPrompt, selectedQuickPick?.id);
        setGenerationProgress("Complete!");
        toast.success("Image generated successfully!");
      } else {
        throw new Error(data?.error || "Failed to generate image");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      toast.error(error.message || "Failed to generate image");
    } finally {
      setIsGenerating(false);
      setGenerationProgress("");
    }
  };

  const handleDownload = async (imageUrl: string, filename?: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `practice-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Image downloaded!");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      const { error } = await supabase
        .from('user_generated_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;
      await fetchGalleryImages();
      toast.success("Image deleted from gallery");
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Failed to delete image");
    }
  };

  const handleRegenerateFromGallery = (image: GeneratedImage) => {
    setQuickPrompt(image.prompt);
    setDetailedPrompt(image.detailed_prompt || "");
    if (image.quick_pick_id) {
      const quickPick = practiceQuickPicks.find(qp => qp.id === image.quick_pick_id);
      setSelectedQuickPick(quickPick || null);
    }
    setActiveTab("generate");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await processAudioToText(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      toast.success("Recording started - speak now!");
    } catch (error: any) {
      console.error("Error starting recording:", error);
      toast.error("Failed to start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      toast.success("Recording stopped - processing...");
    }
  };

  const processAudioToText = async (audioBlob: Blob) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binaryString = '';
      const chunkSize = 0x8000;
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64Audio = btoa(binaryString);
      
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) throw error;

      if (data?.text) {
        setQuickPrompt(prev => prev ? `${prev} ${data.text}` : data.text);
        toast.success("Voice transcription added!");
      } else {
        throw new Error('No transcription received');
      }
    } catch (error: any) {
      console.error("Error processing audio:", error);
      toast.error(error.message || "Failed to process audio");
    }
  };

  const handleModalClose = (newOpen: boolean) => {
    if (!newOpen && isRecording) {
      stopRecording();
    }
    onOpenChange(newOpen);
    
    if (!newOpen) {
      setQuickPrompt("");
      setDetailedPrompt("");
      setGeneratedImage(null);
      setSelectedQuickPick(null);
      setIsEditingPrompt(false);
      setActiveTab("quick-picks");
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Image Generator for Practice Managers</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quick-picks">Quick-Picks</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="gallery">My Gallery</TabsTrigger>
          </TabsList>

          <TabsContent value="quick-picks" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {practiceQuickPicks.map((quickPick) => (
                <Card key={quickPick.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleQuickPickSelect(quickPick)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">{quickPick.title}</h3>
                      <Badge variant="secondary" className="text-xs">{quickPick.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{quickPick.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{quickPick.size.width}×{quickPick.size.height}</span>
                      <span>•</span>
                      <span>Practice Manager</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="generate" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <div className="space-y-4">
                {selectedQuickPick && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{selectedQuickPick.title}</h3>
                        <Badge variant="outline">{selectedQuickPick.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedQuickPick.description}</p>
                    </CardContent>
                  </Card>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Image Prompt
                  </label>
                  <Textarea
                    placeholder="Describe the image you want to generate..."
                    value={quickPrompt}
                    onChange={(e) => setQuickPrompt(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">
                      Detailed AI Prompt
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      {isEditingPrompt ? "Finish Editing" : "Edit Prompt"}
                    </Button>
                  </div>
                  <Textarea
                    placeholder="AI-enhanced detailed prompt will appear here..."
                    value={detailedPrompt}
                    onChange={(e) => setDetailedPrompt(e.target.value)}
                    disabled={!isEditingPrompt}
                    className={`min-h-[120px] ${!isEditingPrompt ? 'bg-muted' : ''}`}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !quickPrompt.trim()}
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {generationProgress || "Generating..."}
                      </div>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Generate Image
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    variant={isRecording ? "destructive" : "outline"}
                    size="icon"
                    disabled={isGenerating}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                </div>

                {isRecording && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                    Recording... Click the mic to stop
                  </div>
                )}
              </div>

              {/* Output Section */}
              <div className="space-y-4">
                {generatedImage ? (
                  <div className="space-y-4">
                    <img
                      src={generatedImage}
                      alt="Generated practice image"
                      className="w-full rounded-lg border"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleDownload(generatedImage)}
                        variant="outline"
                        className="flex-1"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        onClick={handleGenerate}
                        variant="outline"
                        size="icon"
                        title="Regenerate"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                    <p className="text-muted-foreground">Your generated image will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="gallery" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">My Generated Images</h3>
              <p className="text-sm text-muted-foreground">{galleryImages.length} images</p>
            </div>
            
            {galleryImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {galleryImages.map((image) => (
                  <Card key={image.id} className="overflow-hidden">
                    <div className="aspect-square relative group">
                      <img
                        src={image.image_url}
                        alt={image.alt_text || "Generated image"}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <Button
                          size="icon"
                          variant="secondary"
                          onClick={() => handleDownload(image.image_url, `${image.prompt.slice(0, 20)}.png`)}
                          className="h-8 w-8"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="secondary"
                          onClick={() => handleRegenerateFromGallery(image)}
                          className="h-8 w-8"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => handleDeleteImage(image.id)}
                          className="h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs font-medium truncate" title={image.prompt}>
                        {image.prompt}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        {image.quick_pick_id && (
                          <Badge variant="outline" className="text-xs">
                            {practiceQuickPicks.find(qp => qp.id === image.quick_pick_id)?.title || "Quick-Pick"}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(image.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                <p className="text-muted-foreground">No images generated yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};