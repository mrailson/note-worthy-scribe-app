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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Settings,
  Zap
} from "lucide-react";
import { TextOverlayPoster } from "@/components/TextOverlayPoster";

// Quick-Pick library with structured content
const QUICK_PICKS = [
  {
    "title": "DNA (Did Not Attend)",
    "conciseText": "Headline: Please Cancel If You Can't Attend\nBody:\n- Last month, 132 patients missed appointments.\n- Over 20 hours of GP & nurse time lost.\n- If you can't attend, cancel:\n   Call: 01604 123456\n   NHS App\n   www.mysurgery.co.uk",
    "expandedText": "Headline: Missed Appointments Affect Everyone\nBody:\nLast month, 132 patients missed their appointments without telling us. That equals more than 20 hours of wasted GP and nurse time.\nWhat this means:\n- Longer waits for those who really need us\n- Fewer urgent appointments available\n- Increased pressure on our staff\nPlease cancel if you cannot attend:\n- Call 01604 123456\n- NHS App\n- Online: www.mysurgery.co.uk\nTogether we can improve access for everyone.",
    "designPrompt": "Design an A4 portrait NHS-style poster layout. Use NHS blue and white. Large bold header area, 3 bullet icons, space for a text block. Leave grey placeholder rectangles for text, do NOT write words. Add a phone icon box and a QR placeholder.",
    "options": {"size":"A4 Portrait","style":"Clean NHS info","large_text":true}
  },
  {
    "title": "Flu Clinic Invite",
    "conciseText": "Headline: Book Your Flu Jab Today\nBody:\n- FREE for 65+, pregnant, long-term conditions, carers\n- Call 01604 123456 or NHS App\n- Clinics every Saturday in October",
    "expandedText": "Headline: Protect Yourself This Winter – Get Your Free Flu Jab\nBody:\nAnnual flu vaccination is the best way to protect yourself and those around you.\nEligible groups:\n- Age 65+\n- Pregnant women\n- People with asthma, COPD, diabetes, heart disease\n- Carers & health staff\nHow to book:\n- Call 01604 123456\n- NHS App\n- Ask at your pharmacy\nClinic dates: Sat 5 Oct, Sat 12 Oct\nHelp keep our community well this winter.",
    "designPrompt": "Create an A4 portrait poster layout in NHS style with winter/health theme. Large bold header box at top, one side illustration of syringe/flu icon, 3 bullet sections with grey bars as placeholder text. Leave space for clinic dates and a QR code box.",
    "options": {"size":"A4 Portrait","style":"Clean NHS info","qr":true,"large_text":true}
  },
  {
    "title": "COVID Autumn Campaign",
    "conciseText": "Headline: Protect Yourself This Autumn\nBody:\n- COVID boosters now available\n- For: Over 65s, pregnant women, at-risk groups\n- Book: NHS App or 01604 123456",
    "expandedText": "Headline: Protect Yourself Against COVID This Autumn\nBody:\nCOVID booster vaccines are now available at {practice_name}.\nWho is eligible:\n- People aged 65+\n- Pregnant women\n- People with long-term conditions\nHow to book:\n- NHS App\n- Call 01604 123456\nStay well this winter. Vaccines save lives.",
    "designPrompt": "Square social tile design in NHS style. Bold header banner, central vaccine icon, 2–3 rectangular boxes as placeholders for text. Use blue, white, and NHS accent colours. Leave QR code space.",
    "options": {"size":"Square 1024","style":"Minimal","large_text":true}
  },
  {
    "title": "Repeat Prescriptions",
    "conciseText": "Headline: Repeat Prescriptions\nBody:\n- NHS App (fastest)\n- Online: www.mysurgery.co.uk\n- Pharmacy app\n- Written slip\nAllow 2 working days before collection.",
    "expandedText": "Headline: How to Order Repeat Prescriptions Safely\nBody:\nPlease use one of the following:\n- NHS App (fastest)\n- Online via www.mysurgery.co.uk\n- Pharmacy app\n- Written slip at reception\nPlease allow 2 working days before collection. Pharmacies may need extra time.\nSafety notes:\n- Order 7 days before you run out\n- Do not wait until your medication has finished\n- Ask your pharmacist for a medication review if needed",
    "designPrompt": "A4 landscape infographic layout. Flow with 4 icons (app, website, pharmacy, slip). Each icon has a grey placeholder box beneath for text. Add banner header area. Keep clean NHS colour scheme.",
    "options": {"size":"A4 Landscape","style":"Icon-led"}
  },
  {
    "title": "Care Navigation Explainer",
    "conciseText": "Headline: Our Reception Team Will Help You\nBody:\nReception may guide you to:\n- GP or Nurse\n- Pharmacist\n- Physio\n- Social Prescriber\n- NHS 111",
    "expandedText": "Headline: Our Reception Team Are Here to Help\nBody:\nOur trained receptionists will ask a few questions to guide you to the right service.\nOptions:\n- GP or Nurse: complex or ongoing problems\n- Clinical Pharmacist: medicines, repeat prescriptions\n- Physio: muscle, joint, back issues\n- Social Prescriber: wellbeing & community support\n- NHS 111: urgent advice when we're closed\nWhy we do this: quicker care, right place, right time.",
    "designPrompt": "A4 poster layout with a simple flowchart. Icons: GP, Nurse, Pharmacist, Physio, Social Prescriber. Each icon has space beneath with placeholder grey bars. Large header space at top.",
    "options": {"size":"A4 Portrait","style":"Illustrated"}
  },
  {
    "title": "Opening Hours & Contact",
    "conciseText": "Headline: Opening Hours\nBody:\nMon–Fri: 8am–6:30pm\nSat/Sun: Closed\nContact:\n- Phone 01604 123456\n- NHS App\n- Online: www.mysurgery.co.uk",
    "expandedText": "Headline: Practice Opening Hours & Contact\nBody:\nOpening Hours:\n- Mon–Fri: 8am–6:30pm\n- Sat & Sun: Closed\nContact us:\n- Phone: 01604 123456\n- Online consultations: www.mysurgery.co.uk\n- NHS App: 24/7 for booking & prescriptions\nOut-of-hours:\n- Call NHS 111 for urgent advice\n- Dial 999 for emergencies\nNote: Phones busiest 8–10am. For non-urgent queries, call later in the day.",
    "designPrompt": "A4 portrait NHS-style poster layout. Header bar, table-style boxes for Mon–Fri, Sat, Sun hours. Add phone icon, computer icon, NHS App icon each with placeholder text bar beneath. Leave space at bottom for emergency advice.",
    "options": {"size":"A4 Portrait","style":"Minimal","large_text":true}
  },
  {
    "title": "Bank Holiday Closure",
    "conciseText": "Headline: Bank Holiday Closure\nBody:\nClosed: Mon 25 Aug\nCall NHS 111 for urgent care\nDial 999 in emergencies",
    "expandedText": "Headline: Bank Holiday Closure Notice\nBody:\nThe practice will be CLOSED on Monday 25 August.\nIf you need urgent medical help:\n- Call NHS 111 (24/7)\n- Visit your local pharmacy for advice\n- Call 999 in an emergency\nNormal opening hours resume Tuesday 26 August.",
    "designPrompt": "A4 notice board style. Large bold header bar saying NOTICE (only the word NOTICE is allowed). Beneath, 2–3 placeholder rectangles for text. Add icons for phone, pharmacy, NHS 111 with blank text boxes beside them.",
    "options": {"size":"A4 Portrait","style":"Clean NHS info","large_text":true}
  },
  {
    "title": "Zero Tolerance Poster",
    "conciseText": "Headline: Respect Our Staff\nBody:\nWe will not tolerate:\n- Verbal abuse\n- Aggression\n- Violence",
    "expandedText": "Headline: Please Treat Our Staff with Respect\nBody:\nWe have a zero-tolerance policy.\nUnacceptable behaviour includes:\n- Shouting or swearing\n- Threats or intimidation\n- Physical violence\nConsequences:\n- Asked to leave premises\n- Reported to NHS England\n- Police involvement\n- Removal from the practice list\nHelp us provide safe care for everyone.",
    "designPrompt": "A4 poster layout with a bold red or NHS blue header box. Add warning/alert icon. Beneath, 3–4 grey rectangular placeholder text blocks. Layout should look official and simple.",
    "options": {"size":"A4 Portrait","style":"Minimal"}
  },
  {
    "title": "Chaperone Available",
    "conciseText": "Headline: Need a Chaperone?\nBody:\nChaperones are available. Please ask.",
    "expandedText": "Headline: Chaperones Are Available\nBody:\nYou are entitled to request a chaperone for any consultation, examination or procedure.\nChaperones provide reassurance, protection and support.\nPlease ask at reception or speak to your clinician if you would like a chaperone present.",
    "designPrompt": "A4 poster layout with header banner, supportive illustration (nurse/patient abstract icons), and 2–3 placeholder grey text blocks. NHS style.",
    "options": {"size":"A4 Portrait","style":"Illustrated"}
  },
  {
    "title": "Interpreter & Accessibility",
    "conciseText": "Headline: Interpreter Services\nBody:\n- Translation available\n- BSL support\n- Large print\nAsk at reception.",
    "expandedText": "Headline: We're Here to Support All Patients\nBody:\nSupport includes:\n- Telephone & face-to-face interpreters\n- British Sign Language (BSL)\n- Easy Read leaflets\n- Large print materials\nHow to request:\n- Ask at reception\n- Call 01604 123456\n- Email practice@nhs.net\nWe will record your needs to support you at future visits.",
    "designPrompt": "A4 NHS poster design with accessibility theme. Icons for language, BSL, large print. Each icon has grey placeholder bars underneath. Bold header box at top.",
    "options": {"size":"A4 Portrait","style":"Clean NHS info"}
  },
  {
    "title": "Complaints & Compliments",
    "conciseText": "Headline: Your Feedback Matters\nBody:\n- Write to Practice Manager\n- Email: practice@nhs.net\n- Call: 01604 123456",
    "expandedText": "Headline: Your Feedback Helps Us Improve\nBody:\nHow to share your views:\n- Write to the Practice Manager\n- Email: practice@nhs.net\n- Call 01604 123456\n- Feedback forms at reception\nWe aim to respond within 10 working days. If unsatisfied, you can escalate to NHS England or the Ombudsman.\nCompliments are shared with our staff team.",
    "designPrompt": "A4 poster layout with NHS blue header. Two-column design: one side suggestion box icon, other side smiling patient icon. Add grey bars for text areas. Clean accessible style.",
    "options": {"size":"A4 Portrait","style":"Minimal"}
  },
  {
    "title": "Patient Participation Group",
    "conciseText": "Headline: Join Our PPG\nBody:\nShape local services.\nMeet quarterly.\nEmail: ppg@nhs.net",
    "expandedText": "Headline: Join Our Patient Participation Group\nBody:\nWe meet quarterly to discuss practice services & improvements. Your voice matters!\nHow to get involved:\n- Email: ppg@nhs.net\n- Ask at reception\n- Sign up via www.mysurgery.co.uk\nPatients from all backgrounds welcome.",
    "designPrompt": "A4 poster layout with people/meeting icon. Large header box, 2–3 grey placeholder sections for text. NHS style, clean background.",
    "options": {"size":"A4 Portrait","style":"Illustrated"}
  },
  {
    "title": "Privacy Notice",
    "conciseText": "Headline: Your Data, Your Rights\nBody:\nWe collect data to provide care.\nYou have rights to access, correct, and know how data is used.",
    "expandedText": "Headline: Your Data, Your Rights\nBody:\nWe collect and store information to provide your care.\nYou have the right to:\n- See your medical record\n- Ask for corrections\n- Know how your data is used\nFor details visit www.mysurgery.co.uk/privacy or contact the Practice Manager.",
    "designPrompt": "A4 poster layout with lock/security icon. Bold NHS header bar, 3 placeholder text blocks beneath. Keep minimal and accessible.",
    "options": {"size":"A4 Portrait","style":"Clean NHS info"}
  },
  {
    "title": "Online Services",
    "conciseText": "Headline: Sign Up Today\nBody:\n- Order repeats\n- View results\n- Book appointments\nDownload NHS App.",
    "expandedText": "Headline: Sign Up for Online Services\nBody:\nDid you know you can:\n- Order prescriptions\n- View test results\n- Book & cancel appointments\nSimply download the NHS App or visit www.mysurgery.co.uk/online",
    "designPrompt": "Square tile design. Icons for phone, laptop, NHS App. Add 3 rectangular text placeholders below icons. Bold NHS header bar at top.",
    "options": {"size":"Square 1024","style":"Icon-led","qr":true}
  },
  {
    "title": "Results Turnaround",
    "conciseText": "Headline: Test Results\nBody:\nBloods: 5–7 days\nX-ray: 10–14 days\nCervical screening: 2–3 weeks",
    "expandedText": "Headline: Test Results – Please Allow Time\nBody:\nTypical result times:\n- Blood tests: 5–7 days\n- X-rays/Scans: 10–14 days\n- Cervical screening: 2–3 weeks\nWe will contact you if urgent. Otherwise, call after 11am for results.",
    "designPrompt": "A4 landscape layout. Table-style boxes (Bloods, X-ray, Cervical). Leave grey bars as placeholders instead of text. NHS header bar at top.",
    "options": {"size":"A4 Landscape","style":"Clean NHS info"}
  },
  {
    "title": "Phone Queue Tips",
    "conciseText": "Headline: Calling the Practice\nBody:\nBest time: 11am–3pm\nRepeat prescriptions: after 2pm\nUse NHS App for results.",
    "expandedText": "Headline: Calling the Practice\nBody:\n- Best time to call: 11am–3pm (shorter waits)\n- Prescription queries: after 2pm\n- For results: after 11am\nTip: Use NHS App to save time.",
    "designPrompt": "A4 poster design with phone icon header. Beneath, 3–4 grey rectangular text placeholders. Add clock icon and NHS App icon with space beside them.",
    "options": {"size":"A4 Portrait","style":"Icon-led"}
  },
  {
    "title": "New Patient Registration",
    "conciseText": "Headline: Register With Us\nBody:\nBring photo ID + proof of address\nOr register online at www.nhs.uk/find-a-gp",
    "expandedText": "Headline: Registering as a New Patient\nBody:\nTo register you will need:\n- Registration form\n- Photo ID\n- Proof of address\nHow to register:\n- Online at www.nhs.uk/find-a-gp\n- At reception (Mon–Fri)\nProcessing time: 5–7 working days\nYou may be invited for a health check.",
    "designPrompt": "A4 NHS-style poster. Header bar at top, ID card icon, house icon, online icon, each with placeholder boxes for text beneath.",
    "options": {"size":"A4 Portrait","style":"Minimal","qr":true}
  },
  {
    "title": "Travel Vaccinations",
    "conciseText": "Headline: Travel Vaccines\nBody:\nBook 6–8 weeks before travel\nSome NHS-funded, some private\nCall 01604 123456",
    "expandedText": "Headline: Planning to Travel Abroad?\nBody:\nBook 6–8 weeks before you travel.\nSome vaccines are free (Hep A, Typhoid, Cholera). Others must be paid privately (Rabies, Yellow Fever).\nCall 01604 123456 or book online.\nBring details of your trip & past vaccinations.",
    "designPrompt": "A4 portrait layout with globe/airplane icon. Header banner at top, 3–4 placeholder grey bars below. Add syringe icon to one side.",
    "options": {"size":"A4 Portrait","style":"Clean NHS info"}
  },
  {
    "title": "Same-Day Care Carousel",
    "conciseText": "Slide 1: Need help today?\nSlide 2: Pharmacy advice\nSlide 3: Nurse reviews\nSlide 4: GP complex problems\nSlide 5: NHS 111",
    "expandedText": "Slide 1: Need help today?\nSlide 2: Pharmacy: advice & medicines\nSlide 3: Nurse: dressings & reviews\nSlide 4: GP: ongoing or complex health issues\nSlide 5: NHS 111: urgent help when we're closed",
    "designPrompt": "Square social carousel style. 5 slides, each with large icon (Pharmacy, Nurse, GP, NHS 111). Beneath each icon, grey bar placeholder text. Keep NHS style.",
    "options": {"size":"Square 1024","style":"Icon-led","large_text":true}
  },
  {
    "title": "Staff Vacancy Tile",
    "conciseText": "Headline: We're Recruiting!\nBody:\nReceptionist, Band 3, 25 hrs/week\nApply by 30 Sept\nEmail practice@nhs.net",
    "expandedText": "Headline: Join Our Team\nBody:\nPosition: Receptionist (Band 3)\nHours: 25 per week, flexible shifts\nClosing date: 30 Sept\nApply: CV & cover letter to practice@nhs.net\nWe are an equal opportunities employer.",
    "designPrompt": "Square social tile. Bold header bar, person/briefcase icon, 3 rectangular placeholders for job details. NHS blue and white.",
    "options": {"size":"Square 1024","style":"Minimal"}
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
  
  // Text Overlay State
  const [useTextOverlay, setUseTextOverlay] = useState(true);
  const [currentQuickPick, setCurrentQuickPick] = useState<typeof QUICK_PICKS[0] | null>(null);
  const [layoutOnlyImage, setLayoutOnlyImage] = useState<string | null>(null);
  
  // Photo Editing State
  const [editMode, setEditMode] = useState(false);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  
  // Service Selection State
  const [useRunware, setUseRunware] = useState(true); // true = Runware, false = OpenAI GPT
  
  // UI State
  const [createOwnOpen, setCreateOwnOpen] = useState(true);
  const [quickPicksOpen, setQuickPicksOpen] = useState(false);
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [quickModalImage, setQuickModalImage] = useState<string | null>(null);
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);

  const handleEditPhotoUpload = (file: File | null) => {
    if (file) {
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a PNG, JPEG, or WebP image file');
        return;
      }
      
      // Validate file size (4MB limit for OpenAI)
      if (file.size > 4 * 1024 * 1024) {
        toast.error('Image file must be smaller than 4MB for editing');
        return;
      }
      
      setEditPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setEditPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setEditPhoto(null);
      setEditPhotoPreview(null);
    }
  };

  const handleEditModeToggle = (enabled: boolean) => {
    setEditMode(enabled);
    if (!enabled) {
      setEditPhoto(null);
      setEditPhotoPreview(null);
      setPrompt("");
    } else {
      setUseTextOverlay(false); // Disable text overlay in edit mode
      setCurrentQuickPick(null);
      setPrompt("Transform this image with AI. Describe how you want to modify it.");
    }
  };

  const handleQuickPick = (quickPick: typeof QUICK_PICKS[0]) => {
    // Store the quickpick data for overlay mode
    setCurrentQuickPick(quickPick);
    
    // Apply options
    if (quickPick.options.size) setSelectedSize(quickPick.options.size);
    if (quickPick.options.style) setSelectedStyle(quickPick.options.style);
    if (quickPick.options.large_text) setLargeText(quickPick.options.large_text);
    if (quickPick.options.qr) setIncludeQR(quickPick.options.qr);
    
    if (useTextOverlay && quickPick.designPrompt) {
      // For overlay mode, use just the design prompt for layout generation
      setPrompt(quickPick.designPrompt);
    } else {
      // Legacy mode: Determine which text to use based on size
      const useExpandedText = selectedSize.includes("A4") || selectedSize === "Banner";
      const selectedText = useExpandedText ? quickPick.expandedText : quickPick.conciseText;
      
      // Replace tokens with brand kit values
      const processedText = selectedText
        .replace(/{practice_name}/g, practiceName || "[Practice Name]")
        .replace(/{primary_colour}/g, primaryColour);
      
      // Create prompt with exact text instruction
      const finalPrompt = `Create a professional NHS-style poster/image layout. Insert the following text exactly as written, in clear large lettering, using the chosen style. Do not change or invent words.\n\nExact text to include:\n${processedText}`;
      
      setPrompt(finalPrompt);
    }
  };

  const assemblePrompt = () => {
    let finalPrompt = prompt;
    
    // Check if this is a Quick-Pick with a design prompt
    const quickPickUsed = QUICK_PICKS.find(qp => 
      prompt.includes(qp.conciseText.split('\n')[0].replace('Headline: ', '')) ||
      prompt.includes(qp.expandedText.split('\n')[0].replace('Headline: ', ''))
    );
    
    if (quickPickUsed && quickPickUsed.designPrompt) {
      // For Quick-Picks, use the design prompt as the base layout instruction
      finalPrompt = quickPickUsed.designPrompt + "\n\n" + finalPrompt;
    }
    
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

  // Helper function to convert image to PNG format with RGBA support
  const convertImageToPNG = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      // Validate file size (max 4MB)
      if (file.size > 4 * 1024 * 1024) {
        reject(new Error('Image file size must be under 4MB for editing'));
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      img.onload = () => {
        try {
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Clear canvas with transparent background to ensure alpha channel
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Set composite operation to ensure alpha channel preservation
          ctx.globalCompositeOperation = 'source-over';
          
          // Draw image to canvas (this preserves any existing alpha channel)
          ctx.drawImage(img, 0, 0);
          
          // For images without alpha channel, we ensure the canvas has RGBA data
          // The canvas automatically creates an alpha channel when we call toBlob
          canvas.toBlob((blob) => {
            if (blob) {
              // Create new File object with PNG format
              const pngFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.png'), {
                type: 'image/png',
                lastModified: Date.now()
              });
              console.log(`Image converted to PNG: ${file.name} -> ${pngFile.name} (${blob.size} bytes)`);
              resolve(pngFile);
            } else {
              reject(new Error('Failed to convert image to PNG'));
            }
          }, 'image/png', 1.0);
        } catch (error) {
          reject(new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image for conversion'));
      img.src = URL.createObjectURL(file);
    });
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

    // Check if in edit mode but no photo uploaded
    if (editMode && !editPhoto) {
      toast.error("Please upload a photo to edit");
      return;
    }

    setIsGenerating(true);
    setCurrentImage(null);
    setLayoutOnlyImage(null);

    try {
      // Determine size for API
      let apiSize = "1024x1024";
      if (selectedSize.includes("A4")) {
        apiSize = selectedSize.includes("Portrait") ? "1024x1536" : "1536x1024";
      } else if (selectedSize === "Banner") {
        apiSize = "1792x1024";
      }

      // Fix size mapping - OpenAI only supports specific sizes
      let validApiSize = apiSize;
      if (apiSize === "2480x3508" || apiSize === "1024x1536") {
        validApiSize = "1024x1792"; // A4 Portrait -> closest supported
      } else if (apiSize === "3508x2480") {
        validApiSize = "1792x1024"; // A4 Landscape -> closest supported
      } else if (apiSize !== "1024x1024" && apiSize !== "1024x1792" && apiSize !== "1792x1024") {
        validApiSize = "1024x1024"; // Default fallback
      }

      // For edit mode, OpenAI only supports square sizes
      if (editMode && !['1024x1024', '512x512', '256x256'].includes(validApiSize)) {
        console.log(`Edit mode: forcing square size. Original: ${validApiSize} -> 1024x1024`);
        validApiSize = '1024x1024';
        toast.info('Edit mode uses square format (1024x1024) for compatibility.');
      }

      // Create FormData for the advanced-image-generation function
      const formData = new FormData();
      
      if (editMode && editPhoto) {
        // Photo editing mode - convert to PNG if needed
        let imageToUpload = editPhoto;
        
        // Always convert all images to PNG with RGBA format for OpenAI compatibility
        console.log(`Converting ${editPhoto.type} to PNG with RGBA support for OpenAI compatibility`);
        toast.info('Converting image to PNG format with transparency support...');
        try {
          imageToUpload = await convertImageToPNG(editPhoto);
        } catch (error) {
          console.error('Image conversion failed:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toast.error(`Image conversion failed: ${errorMessage}`);
          setIsGenerating(false);
          return;
        }
        
        formData.append('prompt', prompt);
        formData.append('image', imageToUpload);
        formData.append('mode', 'edit');
        formData.append('size', validApiSize);
        formData.append('quality', 'high');
      } else {
        // Normal generation mode
        const finalPrompt = assemblePrompt();
        
        // For overlay mode with quick picks, generate layout-only image
        let enhancedPrompt;
        if (useTextOverlay && currentQuickPick) {
          enhancedPrompt = finalPrompt + "\n\nIMPORTANT: Generate layout only with grey placeholder rectangles. NO TEXT CONTENT. Use NHS colors and professional layout.";
        } else {
          // Add instruction for exact text usage to prevent lorem ipsum
          enhancedPrompt = finalPrompt + "\n\nIMPORTANT: Insert the following text exactly as written, in clear large lettering, using the chosen style. Do not change or invent words.";
        }
        
        formData.append('prompt', enhancedPrompt);
        formData.append('size', validApiSize);
        formData.append('quality', 'high');
        formData.append('mode', 'generation');
      }

      // Create FormData for the runware-image-generation function
      const requestFormData = new FormData();
      
      if (editMode && editPhoto) {
        // Photo editing mode - convert to PNG if needed
        let imageToUpload = editPhoto;
        
        // Always convert all images to PNG with RGBA format for compatibility
        console.log(`Converting ${editPhoto.type} to PNG with RGBA support for compatibility`);
        toast.info('Converting image to PNG format with transparency support...');
        try {
          imageToUpload = await convertImageToPNG(editPhoto);
        } catch (error) {
          console.error('Image conversion failed:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toast.error(`Image conversion failed: ${errorMessage}`);
          setIsGenerating(false);
          return;
        }
        
        requestFormData.append('prompt', prompt);
        requestFormData.append('image', imageToUpload);
        requestFormData.append('mode', 'edit');
        requestFormData.append('size', validApiSize);
        requestFormData.append('quality', 'high');
      } else {
        // Normal generation mode
        const finalPrompt = assemblePrompt();
        
        // For overlay mode with quick picks, generate layout-only image
        let enhancedPrompt;
        if (useTextOverlay && currentQuickPick) {
          enhancedPrompt = finalPrompt + "\n\nIMPORTANT: Generate layout only with grey placeholder rectangles. NO TEXT CONTENT. Use NHS colors and professional layout.";
        } else {
          // Add instruction for exact text usage to prevent lorem ipsum
          enhancedPrompt = finalPrompt + "\n\nIMPORTANT: Insert the following text exactly as written, in clear large lettering, using the chosen style. Do not change or invent words.";
        }
        
        requestFormData.append('prompt', enhancedPrompt);
        requestFormData.append('size', validApiSize);
        requestFormData.append('quality', 'high');
        requestFormData.append('mode', 'generation');
      }

      // Choose service based on toggle
      let serviceName, requestBody;
      
      if (useRunware) {
        // Use Runware service
        serviceName = 'runware-image-generation';
        requestBody = requestFormData;
      } else {
        // Use OpenAI service - convert FormData back to regular FormData for OpenAI
        serviceName = 'advanced-image-generation';
        requestBody = formData; // Use the original formData that was prepared for OpenAI
      }

      const { data, error } = await supabase.functions.invoke(serviceName, {
        body: requestBody
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate image');
      }

      if (data.success) {
        if (useTextOverlay && currentQuickPick && !editMode) {
          // Store as layout-only image for overlay mode
          setLayoutOnlyImage(data.imageData);
          setCurrentImage(data.imageData); // Also set as current for fallback
        } else {
          setCurrentImage(data.imageData);
        }
        
        // Add to history
        const newResult: ImageResult = {
          prompt: editMode ? `Edit: ${prompt}` : prompt,
          options: { size: selectedSize, style: selectedStyle, editMode },
          imageUrl: data.imageData,
          createdAt: new Date(),
          altText: editMode 
            ? `Edited image: ${prompt}`
            : `Poster for ${practiceName || 'GP practice'} about ${prompt.split('.')[0]}. ${selectedStyle} layout, high-contrast colours.`
        };
        
        setImageHistory(prev => [newResult, ...prev].slice(0, 12));
        const serviceName = useRunware ? "Runware" : "OpenAI GPT";
        toast.success(editMode ? `Photo edited successfully with ${serviceName}!` : `Image generated successfully with ${serviceName}!`);
      } else {
        throw new Error(data.error || "Failed to generate image");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      toast.error(error.message || (editMode ? "Failed to edit photo" : "Failed to generate image"));
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick Modal Generation
  const handleQuickGenerate = async () => {
    if (!quickPrompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsQuickGenerating(true);
    setQuickModalImage(null);

    try {
      const serviceName = useRunware ? 'runware-image-generation' : 'advanced-image-generation';
      const requestFormData = new FormData();
      
      requestFormData.append('prompt', quickPrompt);
      requestFormData.append('size', '1024x1024');
      requestFormData.append('quality', 'high');
      requestFormData.append('mode', 'generation');

      const { data, error } = await supabase.functions.invoke(serviceName, {
        body: useRunware ? requestFormData : requestFormData
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate image');
      }

      if (data.success) {
        setQuickModalImage(data.imageData);
        const serviceName = useRunware ? "Runware" : "OpenAI GPT";
        toast.success(`Quick image generated with ${serviceName}!`);
      } else {
        throw new Error(data.error || "Failed to generate image");
      }
    } catch (error: any) {
      console.error("Error in quick generation:", error);
      toast.error(error.message || "Failed to generate image");
    } finally {
      setIsQuickGenerating(false);
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
      {/* Main Content */}
      <div className="container mx-auto p-6">
        
        {/* Quick Generate Button */}
        <div className="mb-6 text-center">
          <Dialog open={quickModalOpen} onOpenChange={setQuickModalOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="animate-fade-in">
                <Zap className="mr-2 h-5 w-5" />
                Quick Generate
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Quick Image Generator
                </DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 h-[80vh]">
                {/* Left Side - Input */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="quick-prompt">Describe your image</Label>
                    <Textarea
                      id="quick-prompt"
                      value={quickPrompt}
                      onChange={(e) => setQuickPrompt(e.target.value)}
                      placeholder="A professional NHS poster about flu vaccinations with clean design..."
                      className="min-h-[200px] resize-none"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-md">
                    <Switch
                      id="quick-service-toggle"
                      checked={useRunware}
                      onCheckedChange={setUseRunware}
                    />
                    <Label htmlFor="quick-service-toggle" className="flex items-center gap-2">
                      <span className={useRunware ? 'font-medium' : 'text-muted-foreground'}>
                        {useRunware ? 'Runware (Fast)' : 'OpenAI GPT (Creative)'}
                      </span>
                    </Label>
                  </div>
                  
                  <Button 
                    onClick={handleQuickGenerate}
                    disabled={isQuickGenerating || !quickPrompt.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {isQuickGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        Generate Image
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Right Side - Output */}
                <div className="flex flex-col">
                  <Label className="mb-2">Generated Image</Label>
                  <div className="flex-1 border-2 border-dashed border-muted rounded-lg flex items-center justify-center bg-muted/10">
                    {quickModalImage ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={quickModalImage} 
                          alt="Generated image"
                          className="w-full h-full object-contain rounded-lg"
                        />
                        <div className="absolute bottom-4 right-4 space-x-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = quickModalImage;
                              link.download = `quick-generated-${Date.now()}.png`;
                              link.click();
                            }}
                          >
                            <Download className="mr-1 h-3 w-3" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-12 w-12 mx-auto mb-3" />
                        <p>Your generated image will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column - Prompt Composer */}
          <div className="space-y-6">
            
            {/* Photo Editing Mode */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    <CardTitle>Photo Editing Mode</CardTitle>
                  </div>
                  <Switch
                    id="edit-mode"
                    checked={editMode}
                    onCheckedChange={handleEditModeToggle}
                  />
                </div>
                {editMode && (
                  <p className="text-sm text-muted-foreground">
                    Upload a photo and transform it with AI prompts like "turn this into a cartoon" or "make it look vintage"
                  </p>
                )}
              </CardHeader>
              {editMode && (
                <CardContent className="space-y-4">
                  {/* Photo Upload */}
                  <div>
                    <Label>Upload Photo to Edit</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp"
                        onChange={(e) => handleEditPhotoUpload(e.target.files?.[0] || null)}
                        className="hidden"
                        id="edit-photo-upload"
                      />
                      <label htmlFor="edit-photo-upload" className="cursor-pointer">
                        {editPhotoPreview ? (
                          <div className="space-y-2">
                            <img
                              src={editPhotoPreview}
                              alt="Photo to edit"
                              className="max-h-32 mx-auto rounded"
                            />
                            <p className="text-sm text-muted-foreground">{editPhoto?.name}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                handleEditPhotoUpload(null);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Click to upload a photo to transform
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              PNG/JPG/WebP up to 4MB
                            </p>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Edit Prompt Examples */}
                  <div className="space-y-2">
                    <Label>Try these editing prompts:</Label>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        "Turn this into a cartoon style",
                        "Make it look like a vintage poster",
                        "Transform into a watercolor painting", 
                        "Create a professional headshot version",
                        "Add NHS branding elements"
                      ].map((example, idx) => (
                        <Button
                          key={idx}
                          variant="ghost"
                          size="sm"
                          className="h-auto p-2 text-left justify-start text-xs"
                          onClick={() => setPrompt(example)}
                        >
                          "{example}"
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Create Your Own */}
            <Card>
              <Collapsible open={createOwnOpen} onOpenChange={setCreateOwnOpen}>
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        <CardTitle>Create Your Own</CardTitle>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${createOwnOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="prompt">Describe what you need</Label>
                  <Textarea
                    id="prompt"
                    placeholder={editMode 
                      ? "Describe how you want to transform your photo (e.g., 'Turn this into a professional NHS poster style', 'Make it look like a cartoon', 'Add vintage filter effects')" 
                      : "What do you need? e.g., 'A4 poster: Phone queue tips with best times to call, clear steps, friendly tone.'"}
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
                         id="use-overlay"
                         checked={useTextOverlay}
                         onCheckedChange={setUseTextOverlay}
                       />
                       <Label htmlFor="use-overlay">Text overlay mode (recommended)</Label>
                     </div>
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

                 {/* Service Selection */}
                 <div className="space-y-3 p-4 border rounded-md bg-muted/30">
                   <Label className="text-sm font-medium">AI Service</Label>
                   <div className="flex items-center justify-between">
                     <div className="flex items-center space-x-3">
                       <span className={`text-sm ${!useRunware ? 'font-medium' : 'text-muted-foreground'}`}>
                         OpenAI GPT
                       </span>
                       <Switch
                         id="service-toggle"
                         checked={useRunware}
                         onCheckedChange={setUseRunware}
                       />
                       <span className={`text-sm ${useRunware ? 'font-medium' : 'text-muted-foreground'}`}>
                         Runware
                       </span>
                     </div>
                     <Badge variant={useRunware ? "default" : "secondary"} className="text-xs">
                       {useRunware ? "Faster, Better Image Editing" : "More Creative Text Generation"}
                     </Badge>
                   </div>
                 </div>

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim() || (editMode && !editPhoto)}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editMode ? "Editing..." : "Generating..."}
                    </>
                  ) : (
                    <>
                      <ImageIcon className="mr-2 h-4 w-4" />
                      {editMode ? "Transform Photo" : "Generate Image"}
                    </>
                  )}
                </Button>

                 {/* Compliance Helper */}
                 <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                   <strong>Compliance reminder:</strong> Please do not include patient names, dates of birth, addresses, or NHS numbers.
                 </div>
               </CardContent>
             </CollapsibleContent>
           </Collapsible>
         </Card>

         {/* Quick-Picks */}
         <Card>
           <Collapsible open={quickPicksOpen} onOpenChange={setQuickPicksOpen}>
             <CollapsibleTrigger className="w-full">
               <CardHeader className="hover:bg-muted/50 transition-colors">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Zap className="h-5 w-5" />
                     <CardTitle>Quick-Picks (Top 20)</CardTitle>
                   </div>
                   <ChevronDown className={`h-4 w-4 transition-transform ${quickPicksOpen ? 'rotate-180' : ''}`} />
                 </div>
               </CardHeader>
             </CollapsibleTrigger>
             <CollapsibleContent>
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
                          {quickPick.conciseText.substring(0, 80)}...
                        </div>
                      </div>
                    </Button>
                  ))}
                 </div>
               </CardContent>
             </CollapsibleContent>
           </Collapsible>
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
                  ) : useTextOverlay && layoutOnlyImage && currentQuickPick ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <TextOverlayPoster
                        backgroundImage={layoutOnlyImage}
                        headline={currentQuickPick.expandedText.split('\n')[0] || currentQuickPick.conciseText.split('\n')[0]}
                        body={currentQuickPick.expandedText.split('\n').slice(1).join('\n') || currentQuickPick.conciseText.split('\n').slice(1).join('\n')}
                        size={selectedSize}
                        className="max-w-full max-h-full"
                      />
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
                      {useTextOverlay && (
                        <p className="text-xs text-muted-foreground">
                          Select a Quick-Pick to see text overlay preview
                        </p>
                      )}
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