import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/LoginForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, 
  Download, 
  Upload, 
  X, 
  ChevronDown,
  FileText,
  RotateCcw,
  Save,
  Copy,
  Palette,
  ImageIcon,
  Settings
} from "lucide-react";

// Quick-Pick library
const QUICK_PICKS = [
  {
    title: "DNA (Did Not Attend) poster",
    prompt: "Design an A4 portrait poster for a GP practice about reducing DNAs (missed appointments). Audience: adult patients. Tone: supportive not blaming. Include: clear headline, 3–5 bullet tips to cancel/rebook, how to cancel (phone, online), gentle reminder of impact on others, {practice_name} branding. Layout clean NHS info style using {primary_colour}. Large readable text.",
    options: {"size":"A4 Portrait","style":"Clean NHS info","large_text":true}
  },
  {
    title: "Flu clinic invite",
    prompt: "A4 portrait poster inviting eligible patients to book their seasonal flu vaccine at {practice_name}. Include: who is eligible (concise), how to book, clinic dates placeholder, accessibility note, QR placeholder for booking link. NHS tone, friendly, legible.",
    options: {"size":"A4 Portrait","style":"Clean NHS info","qr":true,"large_text":true}
  },
  {
    title: "COVID autumn campaign",
    prompt: "Square social tile for Facebook with concise message about autumn COVID vaccinations at {practice_name}. Include: eligibility summary, booking options, call to action. Strong contrast, clear hierarchy, {primary_colour} accent.",
    options: {"size":"Square 1024","style":"Minimal","large_text":true}
  },
  {
    title: "Repeat prescriptions – how to order",
    prompt: "A4 landscape infographic explaining how to order repeat prescriptions. Include: NHS App, online services, pharmacy apps (if applicable), phone policy, processing times, collection info, safety notes. Use icons and short steps.",
    options: {"size":"A4 Landscape","style":"Icon-led"}
  },
  {
    title: "Care navigation explainer",
    prompt: "A4 portrait explainer showing how the reception team directs patients to the right care (GP, nurse, pharmacist, physio, social prescriber). Include flow or simple path diagram. Reassuring tone.",
    options: {"size":"A4 Portrait","style":"Illustrated"}
  },
  {
    title: "Opening hours & contact",
    prompt: "A4 portrait practice opening hours and contact options. Include phone, eConsult/online forms, in-person, out-of-hours advice (NHS 111). Clean grid, strong legibility.",
    options: {"size":"A4 Portrait","style":"Minimal","large_text":true}
  },
  {
    title: "Bank holiday closure notice",
    prompt: "A4 portrait notice about bank holiday closure with alternative care options (NHS 111, pharmacies, 999 emergencies). Date placeholders. High contrast. Accessible.",
    options: {"size":"A4 Portrait","style":"Clean NHS info","large_text":true}
  },
  {
    title: "Zero tolerance poster",
    prompt: "A4 portrait zero-tolerance statement: respectful behaviour policy, what is unacceptable, consequences, support for staff. Calm but firm tone.",
    options: {"size":"A4 Portrait","style":"Minimal"}
  },
  {
    title: "Chaperone available",
    prompt: "A4 portrait poster explaining chaperones, when offered, how to request. Friendly, inclusive imagery (illustrative), privacy & dignity emphasis.",
    options: {"size":"A4 Portrait","style":"Illustrated"}
  },
  {
    title: "Interpreter & accessibility",
    prompt: "A4 portrait poster: interpreter services, British Sign Language access, translation options, accessible formats, how to request.",
    options: {"size":"A4 Portrait","style":"Clean NHS info"}
  },
  {
    title: "Complaints & compliments",
    prompt: "A4 portrait patient info on feedback/complaints: how to raise, timeframes, what to expect, PALS/ICS escalation, accessible routes.",
    options: {"size":"A4 Portrait","style":"Minimal"}
  },
  {
    title: "PPG recruitment",
    prompt: "A4 portrait poster inviting patients to join the Patient Participation Group. Purpose, meeting cadence, how to sign up, inclusive language.",
    options: {"size":"A4 Portrait","style":"Illustrated"}
  },
  {
    title: "Privacy notice (short form)",
    prompt: "A4 portrait concise privacy notice summary for patients: what data we collect, why, lawful basis, how to access your record, contact details. Clear headings.",
    options: {"size":"A4 Portrait","style":"Clean NHS info"}
  },
  {
    title: "Online services sign-up",
    prompt: "Square social tile promoting NHS App/online services: order repeats, view results, book appointments. Clear call to action, QR placeholder.",
    options: {"size":"Square 1024","style":"Icon-led","qr":true}
  },
  {
    title: "Results turnaround times",
    prompt: "A4 landscape poster: typical lab result timeframes, how we communicate, when to call, safety-net advice. Calm tone.",
    options: {"size":"A4 Landscape","style":"Clean NHS info"}
  },
  {
    title: "Phone queue tips",
    prompt: "A4 portrait tips for calling the practice: best times to call, options menu cheat-sheet, call-back availability, alternative routes.",
    options: {"size":"A4 Portrait","style":"Icon-led"}
  },
  {
    title: "New patient registration",
    prompt: "A4 portrait 'How to register' steps, documents required, online link QR, catchment info, timeframe expectations.",
    options: {"size":"A4 Portrait","style":"Minimal","qr":true}
  },
  {
    title: "Travel vaccines info",
    prompt: "A4 portrait poster: travel vaccine process, private vs NHS, timelines (book 6–8 weeks ahead), links to NHS travel advice.",
    options: {"size":"A4 Portrait","style":"Clean NHS info"}
  },
  {
    title: "Social media carousel (3–5 slides)",
    prompt: "Create 4 square slides for Instagram explaining same-day urgent care routes: on-the-day appointments, pharmacy consultation, NHS 111, UTC/WIC. Simple icons and big text.",
    options: {"size":"Square 1024","style":"Icon-led","large_text":true}
  },
  {
    title: "Staff vacancy tile",
    prompt: "Square social tile advertising a staff vacancy. Include role, band/pay range placeholder, hours, apply-by date, how to apply.",
    options: {"size":"Square 1024","style":"Minimal"}
  }
];

const SIZE_OPTIONS = [
  { label: "A4 Portrait", value: "A4 Portrait", dimensions: "2480×3508" },
  { label: "A4 Landscape", value: "A4 Landscape", dimensions: "3508×2480" },
  { label: "Square 1024", value: "Square 1024", dimensions: "1024×1024" },
  { label: "Social 1080×1350", value: "Social Portrait", dimensions: "1080×1350" },
  { label: "Banner 1920×768", value: "Banner", dimensions: "1920×768" }
];

const STYLE_PRESETS = [
  "Clean NHS info",
  "Illustrated", 
  "Minimal",
  "Photo-led",
  "Icon-led"
];

interface ImageResult {
  prompt: string;
  options: any;
  imageUrl: string;
  createdAt: Date;
  altText: string;
}

const PracticeImageMaker = () => {
  const { user, loading } = useAuth();
  
  // Brand Kit State
  const [practiceName, setPracticeName] = useState("");
  const [primaryColour, setPrimaryColour] = useState("#005EB8");
  const [secondaryColour, setSecondaryColour] = useState("#003087");
  const [logo, setLogo] = useState<File | null>(null);
  const [applyBrand, setApplyBrand] = useState(false);
  const [brandKitOpen, setBrandKitOpen] = useState(false);
  
  // Prompt Composer State
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [selectedSize, setSelectedSize] = useState("A4 Portrait");
  const [selectedStyle, setSelectedStyle] = useState("Clean NHS info");
  const [textHeaviness, setTextHeaviness] = useState([50]);
  const [largeText, setLargeText] = useState(false);
  const [includeQR, setIncludeQR] = useState(false);
  const [transparentBg, setTransparentBg] = useState(false);
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<ImageResult[]>([]);

  const handleQuickPick = (quickPick: typeof QUICK_PICKS[0]) => {
    // Replace tokens with brand kit values
    let processedPrompt = quickPick.prompt
      .replace(/{practice_name}/g, practiceName || "[Practice Name]")
      .replace(/{primary_colour}/g, primaryColour);
    
    setPrompt(processedPrompt);
    
    // Apply options
    if (quickPick.options.size) setSelectedSize(quickPick.options.size);
    if (quickPick.options.style) setSelectedStyle(quickPick.options.style);
    if (quickPick.options.large_text) setLargeText(quickPick.options.large_text);
    if (quickPick.options.qr) setIncludeQR(quickPick.options.qr);
  };

  const assemblePrompt = () => {
    let finalPrompt = prompt;
    
    // Add branding constraints if enabled
    if (applyBrand && practiceName) {
      finalPrompt += `\n\nBranding: Use ${practiceName} branding with primary colour ${primaryColour}. Keep layouts clean and accessible, with strong text contrast, large headings, and readable body text.`;
      
      if (logo) {
        finalPrompt += " Use the uploaded logo subtly; keep NHS Identity rules (no NHS lozenge unless licensed).";
      }
    }
    
    // Add style preset
    finalPrompt += `\n\nStyle: ${selectedStyle}. If icons are used, keep them simple and universal.`;
    
    // Add QR placeholder if requested
    if (includeQR) {
      finalPrompt += "\n\nIf a QR code is requested, reserve a blank square placeholder and label it 'Scan to book'.";
    }
    
    // Add compliance guardrails
    finalPrompt += "\n\nUK primary care context only. No patient identifiers. Keep wording concise and plain English.";
    
    return finalPrompt;
  };

  const handleGenerate = async () => {
    // Check for PHI patterns
    const phiPatterns = /\b(name|dob|nhs\s?number|address)\b/i;
    if (phiPatterns.test(prompt)) {
      toast.error("Please remove any patient identifiers from your prompt.");
      return;
    }
    
    if (!prompt.trim()) {
      toast.error("Please enter a prompt to generate an image");
      return;
    }

    setIsGenerating(true);
    setCurrentImage(null);

    try {
      const finalPrompt = assemblePrompt();
      
      // Determine size for API
      let apiSize = "1024x1024";
      if (selectedSize.includes("A4")) {
        apiSize = selectedSize.includes("Portrait") ? "1024x1536" : "1536x1024";
      } else if (selectedSize === "Banner") {
        apiSize = "1792x1024";
      }

      const { data, error } = await supabase.functions.invoke('advanced-image-generation', {
        body: {
          prompt: finalPrompt,
          size: apiSize,
          quality: 'high',
          mode: 'generation'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate image');
      }

      if (data.success) {
        setCurrentImage(data.imageData);
        
        // Add to history
        const newResult: ImageResult = {
          prompt: finalPrompt,
          options: { size: selectedSize, style: selectedStyle },
          imageUrl: data.imageData,
          createdAt: new Date(),
          altText: `Poster for ${practiceName || 'GP practice'} about ${prompt.split('.')[0]}. ${selectedStyle} layout, high-contrast colours.`
        };
        
        setImageHistory(prev => [newResult, ...prev].slice(0, 12));
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

  const handleDownloadPNG = () => {
    if (!currentImage) return;
    
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `${practiceName || 'practice'}-${selectedSize.replace(' ', '-').toLowerCase()}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyAltText = () => {
    if (!currentImage) return;
    
    const altText = `Poster for ${practiceName || 'GP practice'} about ${prompt.split('.')[0]}. ${selectedStyle} layout, high-contrast colours.`;
    navigator.clipboard.writeText(altText);
    toast.success("Alt text copied to clipboard");
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
      {/* Header */}
      <div className="border-b bg-card/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-foreground">Practice Image Maker</h1>
            <div className="text-sm text-muted-foreground">
              Designed for NHS GP practices • UK-only content • No patient identifiers
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column - Prompt Composer */}
          <div className="space-y-6">
            
            {/* Brand Kit */}
            <Card>
              <Collapsible open={brandKitOpen} onOpenChange={setBrandKitOpen}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        <CardTitle className="text-lg">Brand Kit</CardTitle>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${brandKitOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="practice-name">Practice Name</Label>
                        <Input
                          id="practice-name"
                          value={practiceName}
                          onChange={(e) => setPracticeName(e.target.value)}
                          placeholder="Enter practice name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="primary-colour">Primary Colour</Label>
                        <div className="flex gap-2">
                          <Input
                            id="primary-colour"
                            type="color"
                            value={primaryColour}
                            onChange={(e) => setPrimaryColour(e.target.value)}
                            className="w-12 h-10 p-1"
                          />
                          <Input
                            value={primaryColour}
                            onChange={(e) => setPrimaryColour(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="secondary-colour">Secondary Colour</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondary-colour"
                          type="color"
                          value={secondaryColour}
                          onChange={(e) => setSecondaryColour(e.target.value)}
                          className="w-12 h-10 p-1"
                        />
                        <Input
                          value={secondaryColour}
                          onChange={(e) => setSecondaryColour(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Logo Upload (Optional)</Label>
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept=".png,.svg,.jpg,.jpeg"
                          onChange={(e) => setLogo(e.target.files?.[0] || null)}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label htmlFor="logo-upload" className="cursor-pointer">
                          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {logo ? logo.name : "Click to upload PNG/SVG"}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            We'll keep it subtle and accessible
                          </p>
                        </label>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="apply-brand"
                        checked={applyBrand}
                        onCheckedChange={setApplyBrand}
                      />
                      <Label htmlFor="apply-brand">Apply brand to all images</Label>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Create Your Own */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  <CardTitle>Create Your Own</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="prompt">Describe what you need</Label>
                  <Textarea
                    id="prompt"
                    placeholder="What do you need? e.g., 'A4 poster: Phone queue tips with best times to call, clear steps, friendly tone.'"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* Reference Image Upload */}
                <div>
                  <Label>Reference Image (Optional)</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      onChange={(e) => setReferenceImage(e.target.files?.[0] || null)}
                      className="hidden"
                      id="reference-upload"
                    />
                    <label htmlFor="reference-upload" className="cursor-pointer">
                      <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {referenceImage ? referenceImage.name : "PNG/JPG/WebP up to 4MB"}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        This helps preserve style or layout
                      </p>
                    </label>
                  </div>
                </div>

                {/* Size & Options */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Size & Ratio</Label>
                    <Select value={selectedSize} onValueChange={setSelectedSize}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label} ({option.dimensions})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Style Preset</Label>
                    <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLE_PRESETS.map(style => (
                          <SelectItem key={style} value={style}>{style}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-4">
                  <div>
                    <Label>Text Heaviness</Label>
                    <Slider
                      value={textHeaviness}
                      onValueChange={setTextHeaviness}
                      max={100}
                      step={1}
                      className="mt-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Low</span>
                      <span>High</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="large-text"
                        checked={largeText}
                        onCheckedChange={setLargeText}
                      />
                      <Label htmlFor="large-text">Large readable text</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="include-qr"
                        checked={includeQR}
                        onCheckedChange={setIncludeQR}
                      />
                      <Label htmlFor="include-qr">Include QR placeholder</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="transparent-bg"
                        checked={transparentBg}
                        onCheckedChange={setTransparentBg}
                      />
                      <Label htmlFor="transparent-bg">Transparent background</Label>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </Button>

                {/* Compliance Helper */}
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                  <strong>Compliance reminder:</strong> Please do not include patient names, dates of birth, addresses, or NHS numbers.
                </div>
              </CardContent>
            </Card>

            {/* Quick-Picks */}
            <Card>
              <CardHeader>
                <CardTitle>Quick-Picks (Top 20)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_PICKS.map((quickPick, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="h-auto p-3 text-left justify-start"
                      onClick={() => handleQuickPick(quickPick)}
                    >
                      <div>
                        <div className="font-medium">{quickPick.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {quickPick.prompt.substring(0, 80)}...
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Output & History */}
          <div className="space-y-6">
            
            {/* Latest Image Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Latest Image Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="aspect-square bg-muted/50 rounded-lg flex items-center justify-center overflow-hidden">
                  {isGenerating ? (
                    <div className="text-center space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="text-sm text-muted-foreground">Creating your image...</p>
                    </div>
                  ) : currentImage ? (
                    <img 
                      src={currentImage} 
                      alt="Generated image"
                      className="w-full h-full object-contain rounded-lg cursor-zoom-in"
                      onClick={() => window.open(currentImage, '_blank')}
                    />
                  ) : (
                    <div className="text-center space-y-2">
                      <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Your generated image will appear here
                      </p>
                    </div>
                  )}
                </div>

                {currentImage && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={handleGenerate}
                        variant="outline"
                        className="w-full"
                        disabled={isGenerating}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Regenerate
                      </Button>
                      <Button 
                        onClick={handleDownloadPNG}
                        variant="outline"
                        className="w-full"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download PNG
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          // Generate PDF (placeholder functionality)
                          toast.info("PDF download coming soon!");
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                      <Button 
                        onClick={handleCopyAltText}
                        variant="outline"
                        className="w-full"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Alt-text
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gallery - Session History */}
            {imageHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Gallery (Session History)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {imageHistory.map((result, index) => (
                      <div
                        key={index}
                        className="aspect-square bg-muted/50 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setCurrentImage(result.imageUrl)}
                      >
                        <img 
                          src={result.imageUrl} 
                          alt={result.altText}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-card/50 mt-8">
        <div className="container mx-auto px-6 py-4">
          <p className="text-xs text-muted-foreground">
            <strong>Usage Guidelines:</strong> Do not misuse the NHS lozenge without proper license. Follow NHS Identity guidelines. 
            Generated content is for guidance only and should be reviewed before publication.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PracticeImageMaker;