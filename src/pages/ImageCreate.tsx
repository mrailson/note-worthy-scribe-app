import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Download, Sparkles, Upload, X, Mic, MicOff } from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { UploadedFile } from "@/types/ai4gp";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { useToast } from "@/hooks/use-toast";

const ImageCreate = () => {
  const { user, loading } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedFile | null>(null);
  const { processFiles, isProcessing } = useFileUpload();
  const { isRecording, isProcessing: isVoiceProcessing, toggleRecording } = useVoiceRecording();
  const { toast: useToastHook } = useToast();

  const handleImageUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    try {
      const file = files[0]; // Only process the first file
      
      // Basic validation before processing
      if (!file.type.startsWith('image/')) {
        toast.error("Please upload an image file (PNG, JPG, or WEBP)");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image too large. Please use an image smaller than 10MB");
        return;
      }

      if (file.size === 0) {
        toast.error("File appears to be empty. Please try another image");
        return;
      }

      // Upload to Supabase Storage instead of processing locally
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const fileName = `${user?.id}/${timestamp}.${fileExtension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('image-processing')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Set the uploaded file with storage path
      setUploadedImage({
        name: file.name,
        type: file.type,
        content: uploadData.path, // Store the storage path instead of base64
        size: file.size,
        isLoading: false
      });
      
      const sizeInMB = (file.size / 1024 / 1024).toFixed(1);
      toast.success(`Image uploaded successfully! (${sizeInMB}MB)`);
      
    } catch (error) {
      console.error("Error uploading image:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
      toast.error(errorMessage);
    }
  };

  const handleRemoveImage = async () => {
    if (uploadedImage && uploadedImage.content) {
      try {
        // Delete from storage
        const { error } = await supabase.storage
          .from('image-processing')
          .remove([uploadedImage.content]);
        
        if (error) {
          console.warn("Failed to delete image from storage:", error);
        }
      } catch (error) {
        console.warn("Error deleting image:", error);
      }
    }
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
      const requestBody: any = { 
        prompt: prompt.trim(),
        size: "1024x1024",
        quality: "standard"
      };

      // If there's an uploaded image, include the storage path
      if (uploadedImage) {
        requestBody.imagePath = uploadedImage.content; // Storage path instead of base64
        requestBody.mode = "edit";
        console.log("Sending image edit request with storage path:", uploadedImage.content);
      } else {
        console.log("Sending standard image generation request");
      }

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: requestBody
      });

      if (error) {
        console.error("Supabase function error:", error);
        throw new Error(`Request failed: ${error.message || 'Unknown error'}`);
      }

      if (data?.success) {
        setGeneratedImage(data.imageData);
        setRevisedPrompt(data.revisedPrompt);
        const mode = uploadedImage ? "edited" : "generated";
        toast.success(`Image ${mode} successfully!`);
      } else {
        const errorMsg = data?.error || "Unknown error occurred";
        console.error("Generation failed:", errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      
      // Provide user-friendly error messages
      let userMessage = "Failed to generate image";
      
      if (error.message) {
        if (error.message.includes("too large")) {
          userMessage = "Image file is too large. Please use a smaller image (under 4MB)";
        } else if (error.message.includes("Invalid image")) {
          userMessage = "Invalid image format. Please try uploading a different image";
        } else if (error.message.includes("temporarily unavailable")) {
          userMessage = "Image generation service is temporarily unavailable. Please try again in a moment";
        } else if (error.message.includes("API key")) {
          userMessage = "Service configuration error. Please contact support";
        } else {
          userMessage = error.message;
        }
      }
      
      toast.error(userMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleNewMeeting = () => {
    // Navigate to home or handle as needed
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-gradient-background">
        <Header onNewMeeting={handleNewMeeting} />
        <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-background">
      <Header onNewMeeting={handleNewMeeting} />
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-6 max-w-4xl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Image Create</h1>
          <p className="text-muted-foreground">
            Generate stunning images from text descriptions using AI
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Create Your Image
              </CardTitle>
              <CardDescription>
                Describe the image you want to create in detail
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reference Image Upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Reference Image (Optional)
                </label>
                  {uploadedImage ? (
                    <div className="relative">
                      <div className="aspect-video bg-muted/50 rounded-lg overflow-hidden">
                        <img 
                          src={`https://dphcnbricafkbtizkoal.supabase.co/storage/v1/object/public/image-processing/${uploadedImage.content}`}
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
              </div>

              <div className="space-y-2">
                <label htmlFor="prompt" className="text-sm font-medium">
                  {uploadedImage ? "Describe what to change or add" : "Image Description"}
                </label>
                <div className="relative">
                  <Textarea
                    id="prompt"
                    placeholder={uploadedImage 
                      ? "e.g., Change the sky to a dramatic sunset, add more trees in the foreground..."
                      : "e.g., A serene mountain landscape at sunset with snow-capped peaks, warm orange and pink sky, reflected in a crystal clear lake..."
                    }
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    className="resize-none pr-12"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`absolute right-2 top-2 h-8 w-8 p-0 transition-all duration-200 ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30' 
                        : isVoiceProcessing 
                          ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                          : 'hover:bg-accent'
                    }`}
                    onClick={async () => {
                      try {
                        const text = await toggleRecording();
                        if (text) {
                          setPrompt(prompt + (prompt ? ' ' : '') + text);
                        }
                      } catch (error) {
                        toast.error("Failed to record audio");
                      }
                    }}
                    disabled={isGenerating || isProcessing}
                    title={isRecording ? 'Click to stop recording' : isVoiceProcessing ? 'Processing speech...' : 'Click to start recording'}
                  >
                    {isRecording ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {uploadedImage 
                    ? "Describe modifications to make to the reference image."
                    : "Be descriptive for better results. Mention style, colors, mood, and details."
                  } {isRecording ? '🔴 Recording... click mic to stop' : isVoiceProcessing ? '⏳ Processing speech...' : ''}
                </p>
              </div>

              <Button 
                onClick={handleGenerateImage}
                disabled={isGenerating || !prompt.trim() || isProcessing}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadedImage ? "Editing Image..." : "Generating Image..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {uploadedImage ? "Edit Image" : "Generate Image"}
                  </>
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

          {/* Result Section */}
          <Card>
            <CardHeader>
              <CardTitle>Generated Image</CardTitle>
              <CardDescription>
                Your AI-generated image will appear here
              </CardDescription>
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
                    <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Your generated image will appear here
                    </p>
                  </div>
                )}
              </div>

              {generatedImage && (
                <Button 
                  onClick={handleDownloadImage}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Image
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tips Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tips for Better Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <h4 className="font-medium">Be Specific</h4>
                <p className="text-sm text-muted-foreground">
                  Include details about style, colors, lighting, and composition
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-medium">Mention Style</h4>
                <p className="text-sm text-muted-foreground">
                  Try "photorealistic", "digital art", "oil painting", or "minimalist"
                </p>
              </div>
              <div className="space-y-1">
                <h4 className="font-medium">Set the Mood</h4>
                <p className="text-sm text-muted-foreground">
                  Describe the atmosphere: "serene", "dramatic", "cheerful", "mysterious"
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ImageCreate;