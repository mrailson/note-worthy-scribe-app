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
    prompt: "Create a professional NHS-branded infographic explaining medical chaperone services. Use EXACTLY this text:\n\n[TITLE]\nMedical Chaperone Service\n\n[SECTION 1]\nWhat is a Medical Chaperone?\nA trained member of staff who can be present during your examination or consultation for your comfort and safety.\n\n[SECTION 2]\nWhen to Request a Chaperone:\n• During intimate examinations\n• If you feel uncomfortable\n• Cultural or religious reasons\n• Personal preference\n\n[SECTION 3]\nHow to Request:\n• Ask when booking your appointment\n• Speak to reception staff\n• Tell your GP or nurse\n• Available for all patients\n\n[SECTION 4]\nYour Rights:\n• You can request a chaperone of a specific gender\n• You can decline if a chaperone is offered\n• The chaperone will maintain your privacy\n• This service is always free\n\n[CONTACT PANEL]\nText Here Practice Name · Text Here Phone · Text Here Website\n\nUse NHS blue #005EB8, white background, clean Arial font, simple medical icons."
  },
  {
    icon: UserCheck,
    title: "Appointments",
    prompt: "Create a professional NHS-branded infographic about booking appointments. Use EXACTLY this text:\n\n[TITLE]\nHow to Book Your GP Appointment\n\n[SECTION 1]\nOnline Booking:\n• Visit our practice website\n• Use NHS App for 24/7 access\n• Book routine appointments up to 4 weeks ahead\n• Cancel or reschedule easily\n\n[SECTION 2]\nTelephone Booking:\n• Call during opening hours\n• Emergency appointments available\n• Speak directly with reception\n• Telephone consultations offered\n\n[SECTION 3]\nWalk-in Services:\n• Emergency appointments only\n• Arrive early for best availability\n• May experience longer waiting times\n• Bring photo ID and NHS number\n\n[SECTION 4]\nOpening Hours:\nMonday-Friday: Text Here Hours\nSaturday: Text Here Hours\nSunday: Closed\nEmergency: Call 111 or 999\n\n[CONTACT PANEL]\nText Here Practice Name · Text Here Phone · Text Here Website\n\nUse NHS blue #005EB8, white background, clean layout with calendar and phone icons."
  },
  {
    icon: Pill,
    title: "Prescriptions",
    prompt: "Create a professional NHS-branded infographic about prescription services. Use EXACTLY this text:\n\n[TITLE]\nPrescription Services\n\n[SECTION 1]\nOrdering Repeat Prescriptions:\n• Order online via NHS App\n• Call our prescription line\n• Drop off request at reception\n• Allow 48 hours processing time\n\n[SECTION 2]\nCollection Options:\n• Collect from practice\n• Nominated pharmacy collection\n• Home delivery (if available)\n• Electronic prescriptions sent directly\n\n[SECTION 3]\nPharmacy Partners:\n• Text Here Pharmacy Names\n• Electronic prescription service\n• Medication reviews available\n• Expert advice on medications\n\n[SECTION 4]\nImportant Notes:\n• Order before you run out\n• Bring NHS number when collecting\n• Check expiry dates regularly\n• Dispose of unused medicines safely\n\n[CONTACT PANEL]\nText Here Practice Name · Text Here Phone · Text Here Website\n\nUse NHS blue #005EB8, white background, clean typography with pill and pharmacy icons."
  },
  {
    icon: ShieldX,
    title: "Zero Tolerance",
    prompt: "Create a professional NHS-branded zero tolerance policy infographic. Use EXACTLY this text:\n\n[TITLE]\nZero Tolerance Policy\n\n[SECTION 1]\nWe Do Not Tolerate:\n• Verbal abuse or aggression\n• Physical violence or threats\n• Discrimination or harassment\n• Damage to practice property\n\n[SECTION 2]\nThis Applies To:\n• All patients and visitors\n• Telephone conversations\n• Online communications\n• Waiting room behavior\n\n[SECTION 3]\nConsequences:\n• Immediate removal from premises\n• Police involvement if necessary\n• Removal from practice list\n• Restriction of services\n\n[SECTION 4]\nWe Are Committed To:\n• Safe working environment for staff\n• Respectful treatment for all patients\n• Professional healthcare delivery\n• Supporting staff wellbeing\n\n[CONTACT PANEL]\nText Here Practice Name · Text Here Phone · Text Here Website\n\nUse NHS blue #005EB8, firm but professional tone, clear warning icons."
  },
  {
    icon: Clock,
    title: "Opening Hours",
    prompt: "Create a professional NHS-branded opening hours infographic. Use EXACTLY this text:\n\n[TITLE]\nPractice Opening Hours\n\n[SECTION 1]\nMonday to Friday:\nMorning: Text Here Hours\nAfternoon: Text Here Hours\nLunch Break: Text Here Hours\n\n[SECTION 2]\nWeekend Services:\nSaturday: Text Here Hours\nSunday: Text Here Status\nPublic Holidays: Text Here Status\n\n[SECTION 3]\nOut of Hours Care:\n• Call NHS 111 for urgent advice\n• Visit A&E for emergencies only\n• Use NHS App for health information\n• Contact 999 for life-threatening emergencies\n\n[SECTION 4]\nAppointment Times:\n• Morning appointments: Text Here Times\n• Afternoon appointments: Text Here Times\n• Emergency slots available daily\n• Please arrive 5 minutes early\n\n[CONTACT PANEL]\nText Here Practice Name · Text Here Phone · Text Here Website\n\nUse NHS blue #005EB8, white background, clear clock and calendar icons."
  },
  {
    icon: Syringe,
    title: "Vaccinations",
    prompt: "Create a professional NHS-branded vaccination information infographic. Use EXACTLY this text:\n\n[TITLE]\nVaccination Services\n\n[SECTION 1]\nRoutine Vaccinations:\n• Annual flu vaccinations\n• COVID-19 boosters\n• Childhood immunisations\n• Adult booster shots\n\n[SECTION 2]\nTravel Vaccinations:\n• Consultation required 6-8 weeks before travel\n• Country-specific recommendations\n• Yellow fever certificates\n• Malaria prevention advice\n\n[SECTION 3]\nHow to Book:\n• Call reception for appointment\n• Online booking for eligible patients\n• Walk-in clinics: Text Here Days/Times\n• Group bookings for families\n\n[SECTION 4]\nWhat to Bring:\n• Vaccination record/red book\n• List of medications\n• Travel itinerary (if applicable)\n• NHS number\n\n[CONTACT PANEL]\nText Here Practice Name · Text Here Phone · Text Here Website\n\nUse NHS blue #005EB8, white background, vaccination and travel icons."
  },
  {
    icon: Smartphone,
    title: "Online Services",
    prompt: "Create a professional NHS-branded digital services infographic. Use EXACTLY this text:\n\n[TITLE]\nNHS Digital Services\n\n[SECTION 1]\nNHS App Features:\n• Book and manage appointments\n• Order repeat prescriptions\n• View test results securely\n• Access your medical record\n\n[SECTION 2]\nOnline Consultations:\n• Complete health questionnaires\n• Upload photos securely\n• Receive clinical advice\n• Follow-up appointments\n\n[SECTION 3]\nPatient Portal Access:\n• Register at reception\n• Verify identity required\n• Set up secure login\n• Technical support available\n\n[SECTION 4]\nGetting Started:\n• Download NHS App\n• Register with practice\n• Verify your identity\n• Start using services today\n\n[CONTACT PANEL]\nText Here Practice Name · Text Here Phone · Text Here Website\n\nUse NHS blue #005EB8, modern tech icons, smartphone imagery."
  },
  {
    icon: Ribbon,
    title: "Cancer Screening",
    prompt: "Create a professional NHS-branded cancer screening infographic. Use EXACTLY this text:\n\n[TITLE]\nNHS Cancer Screening\n\n[SECTION 1]\nCervical Screening:\n• Women aged 25-64\n• Every 3-5 years\n• Prevents 75% of cervical cancers\n• Book with practice nurse\n\n[SECTION 2]\nBreast Screening:\n• Women aged 50-70\n• Every 3 years\n• Invitation sent automatically\n• Takes about 10 minutes\n\n[SECTION 3]\nBowel Screening:\n• Men and women aged 60-74\n• Every 2 years\n• Home testing kit posted\n• Early detection saves lives\n\n[SECTION 4]\nBooking Your Screening:\n• Wait for your invitation\n• Call if you haven't received one\n• Discuss any concerns with GP\n• Screening is free on NHS\n\n[CONTACT PANEL]\nText Here Practice Name · Text Here Phone · Text Here Website\n\nUse NHS blue #005EB8, supportive tone, hope-focused imagery."
  },
  {
    icon: HandHeart,
    title: "Carers Support",
    prompt: "Create a professional NHS-branded carers support infographic. Use EXACTLY this text:\n\n[TITLE]\nSupport for Carers\n\n[SECTION 1]\nWhat We Offer:\n• Carers health checks\n• Flexible appointment times\n• Priority appointments when needed\n• Understanding of caring responsibilities\n\n[SECTION 2]\nLocal Support Services:\n• Text Here Local Carers Organization\n• Respite care information\n• Benefits and financial advice\n• Carers support groups\n\n[SECTION 3]\nYour Wellbeing Matters:\n• Annual health checks available\n• Mental health support\n• Flu vaccinations\n• Prescription delivery services\n\n[SECTION 4]\nHow to Access Support:\n• Tell us you're a carer\n• Register for carer services\n• Join our carers register\n• Speak to your GP about support\n\n[CONTACT PANEL]\nText Here Practice Name · Text Here Phone · Text Here Website\n\nUse NHS blue #005EB8, warm and caring design, heart and support icons."
  },
  {
    icon: UserPlus,
    title: "New Patient Registration",
    prompt: "Create a professional NHS-branded new patient registration infographic. Use EXACTLY this text:\n\n[TITLE]\nNew Patient Registration\n\n[SECTION 1]\nWelcome to Our Practice\n• Complete registration online or in person\n• Bring required documents\n• Meet your practice team\n• Learn about our services\n\n[SECTION 2]\nWhat to Bring:\n• Photo identification\n• Proof of address\n• NHS medical card (if available)\n• Current medication list\n\n[SECTION 3]\nRegistration Process:\n• Complete registration form\n• New patient health check\n• Meet practice nurse\n• Set up online access\n\n[SECTION 4]\nYour First Appointment:\n• Health and lifestyle assessment\n• Medical history review\n• Current medications check\n• Questions and information\n\n[CONTACT PANEL]\nText Here Practice Name · Text Here Phone · Text Here Website\n\nUse NHS blue #005EB8, welcoming design, registration and welcome icons."
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
