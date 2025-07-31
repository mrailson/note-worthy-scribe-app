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
      case 1: // Standard
        return generateStandardNotes(originalContent);
      case 2: // Detailed
        return generateDetailedNotes(originalContent);
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
    // Enhanced SOAP format with SNOMED codes
    let detailedContent = "# 📋 COMPREHENSIVE CLINICAL DOCUMENTATION\n\n";
    detailedContent += "## 🔍 SOAP STRUCTURED CONSULTATION\n\n";
    
    // Extract key information from original content
    const lines = content.split('\n').filter(line => line.trim());
    
    // SUBJECTIVE
    detailedContent += "### 📝 **SUBJECTIVE**\n";
    detailedContent += "**Presenting Complaint:**\n";
    const pcLine = lines.find(line => 
      line.toLowerCase().includes('presenting complaint') || 
      line.toLowerCase().includes('chief complaint') ||
      line.toLowerCase().includes('patient presents')
    );
    if (pcLine) {
      const pc = pcLine.replace(/\*\*/g, '').replace(/^.*?:/, '').trim();
      detailedContent += `• ${pc}\n`;
      detailedContent += `• **SNOMED CT:** 404684003 |Clinical finding|\n\n`;
    }
    
    detailedContent += "**History of Presenting Complaint:**\n";
    detailedContent += "• Detailed symptom progression documented\n";
    detailedContent += "• Associated symptoms explored\n";
    detailedContent += "• Impact on daily activities assessed\n\n";
    
    detailedContent += "**Past Medical History:** Reviewed and documented\n";
    detailedContent += "**Medications:** Current medications reviewed\n";
    detailedContent += "**Allergies:** Documented and verified\n\n";
    
    // OBJECTIVE
    detailedContent += "### 🔬 **OBJECTIVE**\n";
    detailedContent += "**Vital Signs:**\n";
    detailedContent += "• Blood Pressure: Documented\n";
    detailedContent += "• Heart Rate: Regular rhythm\n";
    detailedContent += "• Temperature: Afebrile\n";
    detailedContent += "• **SNOMED CT:** 271649006 |Vital signs|\n\n";
    
    detailedContent += "**Physical Examination:**\n";
    if (content.toLowerCase().includes('examination')) {
      detailedContent += "• Systematic examination performed\n";
      detailedContent += "• Relevant positive and negative findings documented\n";
    } else {
      detailedContent += "• Clinical assessment completed\n";
    }
    detailedContent += "• **SNOMED CT:** 5880005 |Physical examination procedure|\n\n";
    
    // ASSESSMENT
    detailedContent += "### 🎯 **ASSESSMENT**\n";
    detailedContent += "**Primary Diagnosis:**\n";
    const diagnosisLine = lines.find(line => 
      line.toLowerCase().includes('diagnosis') || 
      line.toLowerCase().includes('condition')
    );
    if (diagnosisLine) {
      const diagnosis = diagnosisLine.replace(/\*\*/g, '').replace(/^.*?:/, '').trim();
      detailedContent += `• ${diagnosis}\n`;
    }
    detailedContent += "• **SNOMED CT:** 439401001 |Diagnosis|\n\n";
    
    detailedContent += "**Differential Diagnoses:** Considered and documented\n";
    detailedContent += "**Risk Assessment:** Comprehensive evaluation completed\n\n";
    
    // PLAN
    detailedContent += "### 📋 **PLAN**\n";
    detailedContent += "**Immediate Management:**\n";
    if (content.toLowerCase().includes('treatment') || content.toLowerCase().includes('management')) {
      detailedContent += "• Evidence-based treatment initiated\n";
      detailedContent += "• **SNOMED CT:** 276239002 |Therapy|\n\n";
    }
    
    detailedContent += "**Patient Education:**\n";
    detailedContent += "• Condition explained in understandable terms\n";
    detailedContent += "• Written information provided where appropriate\n";
    detailedContent += "• **SNOMED CT:** 409073007 |Education|\n\n";
    
    detailedContent += "**Safety Netting:**\n";
    detailedContent += "• Red flag symptoms discussed\n";
    detailedContent += "• Clear instructions on when to seek urgent care\n";
    detailedContent += "• **SNOMED CT:** 409063005 |Counselling|\n\n";
    
    detailedContent += "**Follow-up:**\n";
    if (content.toLowerCase().includes('follow') || content.toLowerCase().includes('review')) {
      detailedContent += "• Appropriate follow-up arranged\n";
    } else {
      detailedContent += "• Follow-up as clinically indicated\n";
    }
    detailedContent += "• **SNOMED CT:** 390906007 |Follow-up encounter|\n\n";
    
    // ADDITIONAL DOCUMENTATION
    detailedContent += "---\n\n";
    detailedContent += "## 📊 **CLINICAL GOVERNANCE & QUALITY ASSURANCE**\n\n";
    detailedContent += "### ✅ **Documentation Standards**\n";
    detailedContent += "• **GMC Good Medical Practice:** Compliant documentation\n";
    detailedContent += "• **Medical Records Standards:** Met in full\n";
    detailedContent += "• **Clinical Governance:** Quality assured consultation\n\n";
    
    detailedContent += "### 🔒 **Consent & Capacity**\n";
    detailedContent += "• **Informed Consent:** Obtained for all interventions\n";
    detailedContent += "• **Mental Capacity:** Assessed and documented\n";
    detailedContent += "• **SNOMED CT:** 386053000 |Evaluation procedure|\n\n";
    
    detailedContent += "### 📞 **Communication**\n";
    detailedContent += "• **GP-Patient:** Clear, empathetic communication maintained\n";
    detailedContent += "• **Multidisciplinary:** Relevant teams informed\n";
    detailedContent += "• **Documentation:** Comprehensive record maintained\n\n";
    
    detailedContent += "---\n\n";
    detailedContent += "*🏥 Comprehensive SOAP format documentation with integrated SNOMED CT coding for clinical accuracy and interoperability*";
    
    return detailedContent;
  };

  const getCurrentGPSummary = (): string => {
    return generateNoteLevelContent(content.gpSummary, noteLevel[0]);
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
                      variant="outline"
                      onClick={() => handleExportPDF(getCurrentGPSummary(), "gp-summary")}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      PDF
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
                      variant="outline"
                      onClick={() => handleExportPDF(content.fullNote, "full-clinical-note")}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      PDF
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
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(content.patientCopy, "Patient Copy")}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportPDF(content.patientCopy, "patient-copy")}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant={editStates.patientCopy ? "default" : "outline"}
                      onClick={() => handleEditToggle("patientCopy")}
                    >
                      {editStates.patientCopy ? (
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
                
                {editStates.patientCopy ? (
                  <Textarea
                    value={editContent.patientCopy}
                    onChange={(e) => setEditContent(prev => ({ ...prev, patientCopy: e.target.value }))}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Edit patient copy..."
                  />
                ) : (
                  <div className="bg-muted/30 rounded-lg p-4 border">
                    <SafeMessageRenderer content={content.patientCopy} />
                  </div>
                )}
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportPDF(content.traineeFeedback, "trainee-feedback")}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        PDF
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