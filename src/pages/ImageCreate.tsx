import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, 
  Download, 
  Upload, 
  X, 
  Heart,
  RotateCcw,
  ChevronDown
} from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { UploadedFile } from "@/types/ai4gp";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";


const ImageCreate = () => {
  const { user, loading } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedFile | null>(null);
  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [isImageUploadOpen, setIsImageUploadOpen] = useState(false);
  const { processFiles, isProcessing } = useFileUpload();

  const handleImageUpload = async (files: FileList) => {
    try {
      const processedFiles = await processFiles(files);
      if (processedFiles.length > 0) {
        const imageFile = processedFiles.find(file => file.type.startsWith('image/'));
        if (imageFile) {
          setUploadedImage(imageFile);
          toast.success("Image uploaded successfully!");
        } else {
          toast.error("Please upload an image file");
        }
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
  };


  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt to generate an image");
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setRevisedPrompt(null);

    try {
      // Create FormData for the request
      const formData = new FormData();
      formData.append('prompt', prompt.trim());
      formData.append('size', '1024x1024');
      formData.append('quality', 'high');

      // Add reference image if uploaded
      if (uploadedImage) {
        // Convert base64 to blob if needed
        let imageBlob: Blob;
        if (uploadedImage.content.startsWith('data:')) {
          const response = await fetch(uploadedImage.content);
          imageBlob = await response.blob();
        } else {
          // If it's already a blob or file
          imageBlob = uploadedImage as any;
        }
        formData.append('image', imageBlob, uploadedImage.name || 'reference.png');
        formData.append('mode', 'generation'); // Use 'edit' for editing mode
      } else {
        formData.append('mode', 'generation');
      }

      console.log('Sending request to advanced-image-generation...');

      const { data, error } = await supabase.functions.invoke('advanced-image-generation', {
        body: formData
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to generate image');
      }

      if (data.success) {
        setGeneratedImage(data.imageData);
        setRevisedPrompt(data.revisedPrompt);
        
        // Add to history (keep last 3)
        setImageHistory(prev => {
          const newHistory = [data.imageData, ...prev];
          return newHistory.slice(0, 3);
        });
        
        toast.success("Image generated successfully!");
      } else {
        throw new Error(data.error || "Failed to generate image");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      toast.error(error.message || "Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `nhs-infographic-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveImage = () => {
    toast.success("Image saved to your gallery!");
  };

  const handleRegenerateImage = () => {
    handleGenerateImage();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Create Your Image */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Create Your Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Description */}
              <div className="space-y-2">
                <label htmlFor="prompt" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="prompt"
                  placeholder="e.g. draw a horse standing on its hind legs, wearing a red dress smoking a cigar"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>

              {/* Reference Image Upload - Collapsible */}
              <Collapsible open={isImageUploadOpen} onOpenChange={setIsImageUploadOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                    <span className="text-sm font-medium">Reference Image (Optional)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${isImageUploadOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {uploadedImage ? (
                    <div className="relative">
                      <div className="aspect-video bg-muted/50 rounded-lg overflow-hidden">
                        <img 
                          src={uploadedImage.content.startsWith('IMAGE_DATA_URL:') 
                            ? uploadedImage.content.replace('IMAGE_DATA_URL:', '') 
                            : uploadedImage.content} 
                          alt="Reference image"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={handleRemoveImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div 
                      className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                      onClick={() => document.getElementById('image-upload')?.click()}
                    >
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload a reference image
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        PNG, JPG, WEBP up to 10MB
                      </p>
                    </div>
                  )}
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                    className="hidden"
                    disabled={isProcessing}
                  />
                </CollapsibleContent>
              </Collapsible>

              <Button 
                onClick={handleGenerateImage}
                disabled={isGenerating || !prompt.trim() || isProcessing}
                className="w-full bg-[#005EB8] hover:bg-[#005EB8]/90"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Image...
                  </>
                ) : (
                  "Generate Image"
                )}
              </Button>

              {revisedPrompt && (
                <div className="space-y-2">
                  <Badge variant="secondary" className="text-xs">
                    AI Enhanced Prompt
                  </Badge>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                    {revisedPrompt}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Column - Generated Image */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Generated Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-square bg-muted/50 rounded-lg flex items-center justify-center overflow-hidden">
                {isGenerating ? (
                  <div className="text-center space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground">Creating your image...</p>
                  </div>
                ) : generatedImage ? (
                  <img 
                    src={generatedImage} 
                    alt="Generated image"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 mx-auto text-muted-foreground/50">✨</div>
                    <p className="text-sm text-muted-foreground">
                      Your generated image will appear here
                    </p>
                  </div>
                )}
              </div>

              {generatedImage && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={handleDownloadImage}
                      variant="outline"
                      className="w-full"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button 
                      onClick={handleSaveImage}
                      variant="outline"
                      className="w-full"
                    >
                      <Heart className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                  <Button 
                    onClick={handleRegenerateImage}
                    variant="outline"
                    className="w-full"
                    disabled={isGenerating}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Regenerate
                  </Button>
                </div>
              )}

              {/* Image History */}
              {imageHistory.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recent Images</label>
                  <div className="grid grid-cols-3 gap-2">
                    {imageHistory.map((historyImage, index) => (
                      <div
                        key={index}
                        className="aspect-square bg-muted/50 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setGeneratedImage(historyImage)}
                      >
                        <img 
                          src={historyImage} 
                          alt={`History ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ImageCreate;
