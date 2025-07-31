import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { 
  ArrowLeft, 
  Clock, 
  FileText, 
  Download, 
  Mail, 
  Edit3, 
  Save,
  Copy,
  CheckCircle,
  Users,
  Stethoscope,
  BookOpen,
  MessageSquare,
  Lightbulb,
  Settings,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SafeMessageRenderer } from "@/components/SafeMessageRenderer";
import { useIsMobile } from "@/hooks/use-mobile";
import jsPDF from "jspdf";

interface ConsultationData {
  id: string;
  title: string;
  type: string;
  transcript: string;
  duration: string;
  wordCount: number;
  startTime: string;
  isExample: boolean;
  exampleData?: {
    gpSummary: string;
    fullNote: string;
    patientCopy: string;
    traineeFeedback: string;
    guidance: any;
  };
}

export default function ConsultationSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  const [consultationData, setConsultationData] = useState<ConsultationData | null>(null);
  const [activeTab, setActiveTab] = useState("gp-summary");
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [noteLevel, setNoteLevel] = useState([1]); // 0: Coded, 1: Standard, 2: Detailed
  
  // Edit states
  const [editStates, setEditStates] = useState({
    gpSummary: false,
    fullNote: false,
    patientCopy: false,
    traineeFeedback: false
  });
  
  // Content states
  const [content, setContent] = useState({
    gpSummary: "",
    fullNote: "",
    patientCopy: "",
    traineeFeedback: ""
  });
  
  // Temporary edit content
  const [editContent, setEditContent] = useState({
    gpSummary: "",
    fullNote: "",
    patientCopy: "",
    traineeFeedback: ""
  });

  // Patient copy sub-tab state
  const [patientCopyTab, setPatientCopyTab] = useState("sms"); // "sms" or "email"

  const noteLevels = ["Coded", "Standard", "Detailed"];

  useEffect(() => {
    const data = location.state as ConsultationData;
    if (data) {
      setConsultationData(data);
      
      // Load example data if this is an example
      if (data.isExample && data.exampleData) {
        setContent({
          gpSummary: data.exampleData.gpSummary,
          fullNote: data.exampleData.fullNote,
          patientCopy: data.exampleData.patientCopy,
          traineeFeedback: data.exampleData.traineeFeedback
        });
        
        setEditContent({
          gpSummary: data.exampleData.gpSummary,
          fullNote: data.exampleData.fullNote,
          patientCopy: data.exampleData.patientCopy,
          traineeFeedback: data.exampleData.traineeFeedback
        });
      }
    } else {
      navigate('/gp-scribe');
    }
  }, [location.state, navigate]);

  // Generate different note levels based on the original content
  const generateNoteLevelContent = (originalContent: string, level: number): string => {
    switch (level) {
      case 0: // Coded Notes (original standard content)
        return originalContent;
      case 1: // Standard - Use same formatting as Detailed
        return generateDetailedNotes(content.fullNote || originalContent);
      case 2: // Detailed - Use Full Note content with SNOMED codes
        return generateDetailedNotesWithSNOMED(content.fullNote || originalContent);
      default:
        return originalContent;
    }
  };

  const generateStandardNotes = (content: string): string => {
    // Enhanced standard format with better structure
    let standardContent = "**CLINICAL CONSULTATION NOTES**\n\n";
    standardContent += content;
    standardContent += "\n\n---\n*Standard clinical documentation format*";
    
    return standardContent;
  };

  const generateDetailedNotes = (content: string): string => {
    // Use Full Note content with better formatting and layout
    if (!content || content.trim() === "") {
      return "No consultation data available to format.";
    }

    // Apply better formatting to the Full Note content
    let formattedContent = content;
    
    // Clean up any existing markdown formatting
    formattedContent = formattedContent.replace(/\*\*\*(.*?)\*\*\*/g, '**$1**'); // Convert triple asterisk to double
    
    // Convert headers to HTML with blue styling and bold text
    formattedContent = formattedContent.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-primary mt-6 mb-3 border-b border-border pb-2">$1</h3>');
    formattedContent = formattedContent.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-primary mt-8 mb-4">$1</h2>');
    formattedContent = formattedContent.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-primary mt-8 mb-6">$1</h1>');
    
    // Convert bold text
    formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
    
    // Make section headers ending with colons bold (more specific pattern)
    formattedContent = formattedContent.replace(/^([A-Z][A-Za-z\s]*[A-Za-z]):(?=\s*$|<br>)/gm, '<strong class="font-bold text-foreground">$1:</strong>');
    
    // Convert bullet points with proper spacing
    formattedContent = formattedContent.replace(/^• (.*$)/gm, '<div class="flex items-start gap-2 mb-2"><span class="text-primary mt-1">•</span><span>$1</span></div>');
    
    // Convert line breaks to proper spacing
    formattedContent = formattedContent.replace(/\n\n/g, '<div class="mb-4"></div>');
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    
    return formattedContent;
  };

  const generateDetailedNotesWithSNOMED = (content: string): string => {
    // Use Full Note content with better formatting and add SNOMED codes
    if (!content || content.trim() === "") {
      return "No consultation data available to format.";
    }

    // Apply better formatting to the Full Note content
    let formattedContent = content;
    
    // Clean up any existing markdown formatting
    formattedContent = formattedContent.replace(/\*\*\*(.*?)\*\*\*/g, '**$1**'); // Convert triple asterisk to double
    
    // Convert headers to HTML with blue styling and bold text
    formattedContent = formattedContent.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold text-primary mt-6 mb-3 border-b border-border pb-2">$1</h3>');
    formattedContent = formattedContent.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-primary mt-8 mb-4">$1</h2>');
    formattedContent = formattedContent.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-primary mt-8 mb-6">$1</h1>');
    
    // Convert bold text
    formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
    
    // Make section headers ending with colons bold (more specific pattern)
    formattedContent = formattedContent.replace(/^([A-Z][A-Za-z\s]*[A-Za-z]):(?=\s*$|<br>)/gm, '<strong class="font-bold text-foreground">$1:</strong>');
    
    // Convert bullet points with proper spacing
    formattedContent = formattedContent.replace(/^• (.*$)/gm, '<div class="flex items-start gap-2 mb-2"><span class="text-primary mt-1">•</span><span>$1</span></div>');
    
    // Convert line breaks to proper spacing
    formattedContent = formattedContent.replace(/\n\n/g, '<div class="mb-4"></div>');
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    
    // Add relevant SNOMED codes based on consultation content
    const relevantCodes = generateRelevantSNOMEDCodes(content);
    if (relevantCodes.length > 0) {
      formattedContent += `<div class="mb-4"></div><hr class="my-6 border-border"><div class="mb-4"></div>

<h3 class="text-lg font-bold text-primary mt-6 mb-3 border-b border-border pb-2">Relevant SNOMED CT Codes</h3>

${relevantCodes.map(code => `<code class="px-2 py-1 bg-muted rounded text-sm font-mono">${code.code}</code> ${code.description}<br>`).join('')}`;
    }
    
    return formattedContent;
  };

  const generateRelevantSNOMEDCodes = (content: string): Array<{code: string, description: string}> => {
    const lowerContent = content.toLowerCase();
    const codes: Array<{code: string, description: string}> = [];
    
    // Encounter type (always include)
    if (lowerContent.includes('face to face') || lowerContent.includes('f2f')) {
      codes.push({ code: '185316007', description: 'Face to face consultation' });
    } else if (lowerContent.includes('telephone') || lowerContent.includes('phone')) {
      codes.push({ code: '185317003', description: 'Telephone consultation' });
    } else {
      codes.push({ code: '185349003', description: 'Encounter for check up' });
    }
    
    // Common conditions based on content
    if (lowerContent.includes('blood pressure') || lowerContent.includes('hypertension') || lowerContent.includes('bp')) {
      codes.push({ code: '38341003', description: 'Hypertensive disorder' });
    }
    
    if (lowerContent.includes('diabetes') || lowerContent.includes('blood sugar') || lowerContent.includes('glucose')) {
      codes.push({ code: '73211009', description: 'Diabetes mellitus' });
    }
    
    if (lowerContent.includes('depression') || lowerContent.includes('mental health') || lowerContent.includes('mood')) {
      codes.push({ code: '35489007', description: 'Depressive disorder' });
    }
    
    if (lowerContent.includes('medication') || lowerContent.includes('prescription') || lowerContent.includes('treatment')) {
      codes.push({ code: '182836005', description: 'Review of medication' });
    }
    
    if (lowerContent.includes('follow up') || lowerContent.includes('follow-up') || lowerContent.includes('review')) {
      codes.push({ code: '390906007', description: 'Follow-up encounter' });
    }
    
    // Return max 4 most relevant codes
    return codes.slice(0, 4);
  };

  // Generate SMS version (max 50 words)
  const generateSMSVersion = (content: string): string => {
    if (!content || content.trim() === "") {
      return "Hi, thank you for attending your consultation today. We've reviewed your condition and discussed next steps. Please take any prescribed medications as directed and contact us if you have concerns.";
    }

    const lines = content.split('\n').filter(line => line.trim() !== '');
    const mainPoints = lines.slice(0, 3).map(line => 
      line.replace(/\*\*/g, '').replace(/###|##|#/g, '').replace(/^.*?:/, '').trim()
    ).filter(point => point.length > 10);

    let smsText = "Hi, thank you for your consultation today. ";
    
    if (mainPoints.length > 0) {
      smsText += mainPoints[0].substring(0, 100) + ". ";
    }
    
    smsText += "Please contact us if you have any concerns.";
    
    // Trim to max 50 words
    const words = smsText.split(' ');
    if (words.length > 50) {
      return words.slice(0, 47).join(' ') + '...';
    }
    
    return smsText;
  };

  // Generate Email version
  const generateEmailVersion = (content: string): string => {
    if (!content || content.trim() === "") {
      return `<div class="space-y-4">
        <p>Dear Patient,</p>
        <p>Thank you for attending your consultation today.</p>
        
        <div class="space-y-2">
          <h4 class="font-bold text-primary">What we discussed:</h4>
          <p class="ml-4">• Your current health concerns were reviewed and addressed.</p>
        </div>
        
        <div class="space-y-2">
          <h4 class="font-bold text-primary">What was agreed:</h4>
          <p class="ml-4">• We've established a plan for your ongoing care.</p>
        </div>
        
        <div class="space-y-2">
          <h4 class="font-bold text-primary">Medications:</h4>
          <p class="ml-4">• Please continue any current medications as prescribed.</p>
        </div>
        
        <div class="space-y-2">
          <h4 class="font-bold text-primary">Follow-up:</h4>
          <p class="ml-4">• We'll be in touch regarding any necessary follow-up appointments.</p>
        </div>
        
        <div class="space-y-2">
          <h4 class="font-bold text-primary">Safety netting:</h4>
          <div class="ml-4 space-y-1">
            <p>• Please contact us immediately if your symptoms worsen</p>
            <p>• Seek urgent care if you develop any concerning new symptoms</p>
            <p>• Don't hesitate to call if you have questions about your care</p>
          </div>
        </div>
        
        <div class="mt-6">
          <p>Best wishes,<br>Your GP Practice</p>
        </div>
      </div>`;
    }

    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    // Extract relevant sections
    const discussed = lines.filter(line => 
      line.toLowerCase().includes('discussed') || 
      line.toLowerCase().includes('reviewed') ||
      line.toLowerCase().includes('complaint') ||
      line.toLowerCase().includes('concern')
    ).slice(0, 2);

    const agreed = lines.filter(line => 
      line.toLowerCase().includes('plan') || 
      line.toLowerCase().includes('agreed') ||
      line.toLowerCase().includes('decision')
    ).slice(0, 2);

    const medications = lines.filter(line => 
      line.toLowerCase().includes('medication') || 
      line.toLowerCase().includes('prescription') ||
      line.toLowerCase().includes('treatment')
    ).slice(0, 2);

    const followUp = lines.filter(line => 
      line.toLowerCase().includes('follow') || 
      line.toLowerCase().includes('appointment') ||
      line.toLowerCase().includes('review')
    ).slice(0, 1);

    return `<div class="space-y-4">
      <p>Dear Patient,</p>
      <p>Thank you for attending your consultation today.</p>
      
      <div class="space-y-2">
        <h4 class="font-bold text-primary">What we discussed:</h4>
        <div class="ml-4 space-y-1">
          ${discussed.length > 0 ? 
            discussed.map(item => `<p>• ${item.replace(/\*\*/g, '').replace(/^.*?:/, '').trim()}</p>`).join('') : 
            '<p>• Your current health concerns were reviewed</p>'
          }
        </div>
      </div>
      
      <div class="space-y-2">
        <h4 class="font-bold text-primary">What was agreed:</h4>
        <div class="ml-4 space-y-1">
          ${agreed.length > 0 ? 
            agreed.map(item => `<p>• ${item.replace(/\*\*/g, '').replace(/^.*?:/, '').trim()}</p>`).join('') : 
            '<p>• A comprehensive care plan has been established</p>'
          }
        </div>
      </div>
      
      <div class="space-y-2">
        <h4 class="font-bold text-primary">Medications:</h4>
        <div class="ml-4 space-y-1">
          ${medications.length > 0 ? 
            medications.map(item => `<p>• ${item.replace(/\*\*/g, '').replace(/^.*?:/, '').trim()}</p>`).join('') : 
            '<p>• Please continue current medications as prescribed</p>'
          }
        </div>
      </div>
      
      <div class="space-y-2">
        <h4 class="font-bold text-primary">Follow-up:</h4>
        <div class="ml-4 space-y-1">
          ${followUp.length > 0 ? 
            followUp.map(item => `<p>• ${item.replace(/\*\*/g, '').replace(/^.*?:/, '').trim()}</p>`).join('') : 
            '<p>• No immediate follow-up required</p>'
          }
        </div>
      </div>
      
      <div class="space-y-2">
        <h4 class="font-bold text-primary">Safety netting:</h4>
        <div class="ml-4 space-y-1">
          <p>• Please contact us if your symptoms worsen or change</p>
          <p>• Seek immediate medical attention if you develop concerning symptoms</p>
          <p>• Don't hesitate to call if you have any questions about your care</p>
        </div>
      </div>
      
      <div class="mt-6">
        <p>Best wishes,<br>Your GP Practice</p>
      </div>
    </div>`;
  };

  const getCurrentGPSummary = (): string => {
    const markdownContent = generateNoteLevelContent(content.gpSummary, noteLevel[0]);
    return convertMarkdownToHTML(markdownContent);
  };

  // Convert basic markdown to HTML for proper rendering
  const convertMarkdownToHTML = (markdown: string): string => {
    let html = markdown;
    
    // Convert headers
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-primary mt-6 mb-3 border-b border-border pb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold text-primary mt-8 mb-4">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-primary mt-8 mb-6">$1</h1>');
    
    // Convert bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
    
    // Convert horizontal rules
    html = html.replace(/^---$/gm, '<hr class="my-6 border-border">');
    
    // Convert bullet points with proper spacing
    html = html.replace(/^• (.*$)/gm, '<div class="flex items-start gap-2 mb-2"><span class="text-primary mt-1">•</span><span>$1</span></div>');
    
    // Convert checkmarks
    html = html.replace(/✅/g, '<span class="text-green-600">✅</span>');
    
    // Convert line breaks to proper spacing
    html = html.replace(/\n\n/g, '<div class="mb-4"></div>');
    html = html.replace(/\n/g, '<br>');
    
    // Convert code blocks (SNOMED codes)
    html = html.replace(/`([^`]+)`/g, '<code class="px-2 py-1 bg-muted rounded text-sm font-mono">$1</code>');
    
    // Convert italic text for final summary
    html = html.replace(/\*(.*?)\*/g, '<em class="text-muted-foreground text-sm italic">$1</em>');
    
    return html;
  };

  const handleEditToggle = (section: keyof typeof editStates) => {
    const isEditing = editStates[section];
    
    if (isEditing) {
      // Save changes
      setContent(prev => ({
        ...prev,
        [section]: editContent[section]
      }));
      toast.success("Changes saved");
    } else {
      // Start editing
      setEditContent(prev => ({
        ...prev,
        [section]: content[section]
      }));
    }
    
    setEditStates(prev => ({
      ...prev,
      [section]: !isEditing
    }));
  };

  const handleCopy = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${section} copied to clipboard`);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleExportPDF = (content: string, filename: string) => {
    try {
      const doc = new jsPDF();
      const cleanContent = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
      const splitText = doc.splitTextToSize(cleanContent, 180);
      doc.text(splitText, 10, 10);
      doc.save(`${filename}.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      toast.error("Failed to export PDF");
    }
  };

  const backToExamples = () => {
    navigate('/gp-scribe', { state: { activeTab: 'examples' } });
  };

  const continueRecording = () => {
    navigate('/gp-scribe');
  };

  if (!consultationData) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading consultation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 max-w-6xl">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={consultationData.isExample ? backToExamples : continueRecording}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {isMobile ? "Back" : (consultationData.isExample ? "Back to Examples" : "Continue Recording")}
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
                <Stethoscope className="h-5 w-5 sm:h-6 sm:w-6" />
                {consultationData.title}
              </h1>
              {consultationData.isExample && (
                <Badge variant="secondary" className="mt-1">
                  Training Example
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{consultationData.duration}</span>
            <Badge variant="outline" className="ml-2">
              {consultationData.wordCount} words
            </Badge>
          </div>
        </div>

        {/* Consultation Summary Card */}
        <Card className="shadow-medium border-accent/20 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Consultation Notes & Feedback
              </span>
              <Badge variant="outline" className="bg-gradient-primary text-primary-foreground">
                {consultationData.type}
              </Badge>
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            {/* Consultation Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger 
                  value="gp-summary" 
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Users className="h-4 w-4 mr-1 lg:mr-2" />
                  <span className="hidden sm:inline">GP Summary</span>
                  <span className="sm:hidden">Summary</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="full-note" 
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4 mr-1 lg:mr-2" />
                  <span className="hidden sm:inline">Full Note</span>
                  <span className="sm:hidden">Full</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="patient-copy" 
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <MessageSquare className="h-4 w-4 mr-1 lg:mr-2" />
                  <span className="hidden sm:inline">Patient Copy</span>
                  <span className="sm:hidden">Patient</span>
                </TabsTrigger>
                {consultationData.isExample && (
                  <TabsTrigger 
                    value="trainee-feedback" 
                    className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <BookOpen className="h-4 w-4 mr-1 lg:mr-2" />
                    <span className="hidden sm:inline">Trainee Feedback</span>
                    <span className="sm:hidden">Feedback</span>
                  </TabsTrigger>
                )}
              </TabsList>

              {/* GP Summary Tab */}
              <TabsContent value="gp-summary" className="space-y-4 mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">GP Summary</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Adjust the detail level using the slider below
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(getCurrentGPSummary(), "GP Summary")}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant={editStates.gpSummary ? "default" : "outline"}
                      onClick={() => handleEditToggle("gpSummary")}
                    >
                      {editStates.gpSummary ? (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </>
                      ) : (
                        <>
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Note Level Slider */}
                <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg p-4 border border-primary/20">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">Detail Level:</span>
                      <Badge variant="outline" className="bg-background">
                        {noteLevels[noteLevel[0]]}
                      </Badge>
                    </div>
                    <div className="flex-1 max-w-md">
                      <Slider
                        value={noteLevel}
                        onValueChange={setNoteLevel}
                        max={2}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Coded</span>
                        <span>Standard</span>
                        <span>Detailed</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {editStates.gpSummary ? (
                  <Textarea
                    value={editContent.gpSummary}
                    onChange={(e) => setEditContent(prev => ({ ...prev, gpSummary: e.target.value }))}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Edit GP summary..."
                  />
                ) : (
                  <div className="bg-muted/30 rounded-lg p-4 border">
                    <SafeMessageRenderer content={getCurrentGPSummary()} />
                  </div>
                )}
              </TabsContent>

              {/* Full Note Tab */}
              <TabsContent value="full-note" className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-primary">Full Clinical Note</h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(content.fullNote, "Full Note")}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant={editStates.fullNote ? "default" : "outline"}
                      onClick={() => handleEditToggle("fullNote")}
                    >
                      {editStates.fullNote ? (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </>
                      ) : (
                        <>
                          <Edit3 className="h-4 w-4 mr-1" />
                          Edit
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                {editStates.fullNote ? (
                  <Textarea
                    value={editContent.fullNote}
                    onChange={(e) => setEditContent(prev => ({ ...prev, fullNote: e.target.value }))}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Edit full clinical note..."
                  />
                ) : (
                  <div className="bg-muted/30 rounded-lg p-4 border">
                    <SafeMessageRenderer content={content.fullNote} />
                  </div>
                )}
              </TabsContent>

              {/* Patient Copy Tab */}
              <TabsContent value="patient-copy" className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-primary">Patient Copy</h3>
                </div>
                
                {/* Patient Copy Sub-tabs */}
                <Tabs value={patientCopyTab} onValueChange={setPatientCopyTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl">
                    <TabsTrigger 
                      value="sms" 
                      className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      SMS (50 words)
                    </TabsTrigger>
                    <TabsTrigger 
                      value="email" 
                      className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email Format
                    </TabsTrigger>
                  </TabsList>

                  {/* SMS Version */}
                  <TabsContent value="sms" className="space-y-4 mt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-md font-semibold text-primary">SMS Short Summary</h4>
                        <p className="text-sm text-muted-foreground">Maximum 50 words for text message</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(generateSMSVersion(content.patientCopy), "SMS Summary")}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                    
                    <div className="bg-muted/30 rounded-lg p-4 border">
                      <div className="text-sm font-mono">
                        {generateSMSVersion(content.patientCopy)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Word count: {generateSMSVersion(content.patientCopy).split(' ').length} words
                      </div>
                    </div>
                  </TabsContent>

                  {/* Email Version */}
                  <TabsContent value="email" className="space-y-4 mt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-md font-semibold text-primary">Email Summary</h4>
                        <p className="text-sm text-muted-foreground">Formatted overview with sections</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(generateEmailVersion(content.patientCopy), "Email Summary")}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                    
                    <div className="bg-muted/30 rounded-lg p-4 border">
                      <SafeMessageRenderer content={generateEmailVersion(content.patientCopy)} />
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* Trainee Feedback Tab */}
              {consultationData.isExample && (
                <TabsContent value="trainee-feedback" className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      Supervisor Feedback for Trainees
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(content.traineeFeedback, "Trainee Feedback")}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <SafeMessageRenderer content={content.traineeFeedback} />
                  </div>
                </TabsContent>
              )}
            </Tabs>

            {/* Transcript Section */}
            <div className="mt-8">
              <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      View Original Transcript
                    </span>
                    <span className="text-xs">
                      {isTranscriptOpen ? "Hide" : "Show"}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="bg-muted/30 rounded-lg p-4 border max-h-[400px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {consultationData.transcript}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}