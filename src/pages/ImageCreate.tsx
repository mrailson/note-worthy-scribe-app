import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Calendar,
  UserCheck,
  Pill,
  ShieldX,
  Clock,
  Syringe,
  Smartphone,
  Ribbon,
  HandHeart,
  UserPlus,
  Heart,
  RotateCcw,
  Home,
  Settings,
  LogOut,
  ChevronDown
} from "lucide-react";
import { useFileUpload } from "@/hooks/useFileUpload";
import { UploadedFile } from "@/types/ai4gp";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const quickPickTemplates = [
  {
    icon: Calendar,
    title: "Chaperone Policy",
    prompt: "Create a clear and professional infographic for a GP practice explaining what a medical chaperone is, why patients may want one, and how to request one. NHS colours, accessible font, simple icons."
  },
  {
    icon: UserCheck,
    title: "Appointments",
    prompt: "Design a modern infographic showing how to book GP appointments - online, phone, and walk-in options. Include opening hours and emergency contact information. NHS branding, clean layout."
  },
  {
    icon: Pill,
    title: "Prescriptions",
    prompt: "Create an informative infographic about prescription services - ordering repeats online, collection times, and pharmacy partnerships. Professional NHS design with clear icons."
  },
  {
    icon: ShieldX,
    title: "Zero Tolerance",
    prompt: "Design a clear zero tolerance policy infographic for GP practice - no abuse of staff, consequences explained. Professional, firm but respectful tone. NHS colours and branding."
  },
  {
    icon: Clock,
    title: "Opening Hours",
    prompt: "Create a clean, easy-to-read opening hours infographic for GP practice. Include weekday/weekend times, lunch breaks, emergency contact. Modern NHS design with clear typography."
  },
  {
    icon: Syringe,
    title: "Vaccinations",
    prompt: "Design an informative vaccination infographic - available vaccines, booking process, travel vaccinations. NHS colours, reassuring design, clear medical icons."
  },
  {
    icon: Smartphone,
    title: "Online Services",
    prompt: "Create a digital services infographic showing NHS App features, online consultations, test results access. Modern, tech-friendly design with NHS branding."
  },
  {
    icon: Ribbon,
    title: "Cancer Screening",
    prompt: "Design a supportive cancer screening infographic - types available, age ranges, booking information. Sensitive, professional design with NHS colours and hopeful tone."
  },
  {
    icon: HandHeart,
    title: "Carers Support",
    prompt: "Create an empathetic carers support infographic - services available, respite care, support groups. Warm, caring design with NHS branding and heart symbols."
  },
  {
    icon: UserPlus,
    title: "New Patient Registration",
    prompt: "Design a welcoming new patient registration infographic - required documents, online forms, what to expect at first appointment. Friendly NHS design."
  }
];

const ImageCreate = () => {
  const { user, loading } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<UploadedFile | null>(null);
  const [imageHistory, setImageHistory] = useState<string[]>([]);
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

  const handleTemplateClick = (template: typeof quickPickTemplates[0]) => {
    setPrompt(template.prompt);
    toast.success(`Template loaded: ${template.title}`);
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

      if (uploadedImage) {
        requestBody.referenceImage = uploadedImage.content;
        requestBody.mode = "edit";
      }

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: requestBody
      });

      if (error) throw error;

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
      {/* NHS Header */}
      <header className="bg-[#005EB8] text-white p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-xl font-semibold">Notewell AI ✨</h1>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => window.location.href = '/'}
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                >
                  Select Service
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border shadow-lg z-50">
                <DropdownMenuItem onClick={() => window.location.href = '/ai4gp'}>
                  AI 4 GP Service
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = '/image-create'}>
                  Image Create
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => window.location.href = '/'}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Left Column - Quick Pick Templates */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Quick Pick Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickPickTemplates.map((template, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start h-auto p-3 hover:bg-[#005EB8]/10"
                  onClick={() => handleTemplateClick(template)}
                >
                  <template.icon className="w-4 h-4 mr-3 text-[#005EB8]" />
                  <span className="text-sm">{template.title}</span>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Middle Column - Create Your Image */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Create Your Image</CardTitle>
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
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label htmlFor="prompt" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="prompt"
                  placeholder="e.g. Create a clear and professional infographic for a GP practice explaining what a medical chaperone is, why patients may want one, and how to request one. NHS colours, accessible font, simple icons."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>

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
