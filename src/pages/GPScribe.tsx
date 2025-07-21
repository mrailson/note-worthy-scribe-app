import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, MicOff, Wifi, WifiOff, Brain, Copy, Download, Mail, Save, Play, Pause, FileText, ChevronDown, ChevronUp, Lightbulb, AlertTriangle, BookOpen, Shield, BarChart3, Edit, Check, X, Send, Settings, Languages } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { RealtimeTranscriber, TranscriptData } from "@/utils/RealtimeTranscriber";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import jsPDF from 'jspdf';
import { consultationExamples, type ConsultationExample } from "@/data/consultationExamples";
import { TranslationInterface } from "@/components/TranslationInterface";

interface ConsultationGuidance {
  suggestedQuestions: string[];
  potentialRedFlags: string[];
  missedOpportunities: string[];
  safetyNetting: string[];
  consultationQuality: {
    score: number;
    feedback: string;
  };
}

const Index = () => {
  const { user, loading } = useAuth();
  const { toast: deprecatedToast } = useToast();
  const navigate = useNavigate();
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<TranscriptData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [wordCount, setWordCount] = useState(0);
  
  // UI states
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedExample, setSelectedExample] = useState<string>("");
  const [showExamples, setShowExamples] = useState(false);
  
  // New consultation setup states
  const [consultationType, setConsultationType] = useState<"face-to-face" | "telephone">("face-to-face");
  const [patientConsentObtained, setPatientConsentObtained] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState<string>('');
  
  // Guidance states - Removed guidance UI but keep for trainee feedback integration
  const [guidance, setGuidance] = useState<ConsultationGuidance | null>(null);
  const [isGuidanceLoading, setIsGuidanceLoading] = useState(false);
  const [autoGuidance, setAutoGuidance] = useState(true);
  
  // Output configuration - Will be loaded from user settings
  const [outputLevel, setOutputLevel] = useState<number>(3); // Default to Standard
  const [showSnomedCodes, setShowSnomedCodes] = useState(true); // Default to true
  const [formatForEmis, setFormatForEmis] = useState(true); // Default to true
  const [formatForSystmOne, setFormatForSystmOne] = useState(false);
  
  // User settings loading state
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // Generated outputs
  const [isGenerating, setIsGenerating] = useState(false);
  const [gpSummary, setGpSummary] = useState("");
  const [fullNote, setFullNote] = useState("");
  const [patientCopy, setPatientCopy] = useState("");
  const [traineeFeedback, setTraineeFeedback] = useState("");
  const [referralLetter, setReferralLetter] = useState("");
  
  // Edit states
  const [editStates, setEditStates] = useState({
    gpSummary: false,
    fullNote: false,
    patientCopy: false,
    traineeFeedback: false,
    referralLetter: false
  });
  
  // Temporary edit content
  const [editContent, setEditContent] = useState({
    gpSummary: "",
    fullNote: "",
    patientCopy: "",
    traineeFeedback: "",
    referralLetter: ""
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transciberRef = useRef<RealtimeTranscriber | null>(null);

  const outputLevels = [
    { value: 1, label: "Code", description: "GP shorthand only (e.g., 'URTI, 2/7, safety-netted')" },
    { value: 2, label: "Brief", description: "Concise summary with key points" },
    { value: 3, label: "Standard", description: "Complete clinical note" },
    { value: 4, label: "Detailed", description: "Comprehensive with examination findings" },
    { value: 5, label: "Full", description: "Complete with patient quotes and context" }
  ];

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load user settings on component mount
  const loadUserSettings = async () => {
    if (!user || settingsLoaded) return;

    try {
      const { data: settings, error } = await supabase
        .from('gp_scribe_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error loading user settings:', error);
        return;
      }

      if (settings) {
        setOutputLevel(settings.default_output_level);
        setShowSnomedCodes(settings.default_show_snomed_codes);
        setFormatForEmis(settings.default_format_for_emis);
        setFormatForSystmOne(settings.default_format_for_systmone);
      }
    } catch (error) {
      console.error('Error loading user settings:', error);
    } finally {
      setSettingsLoaded(true);
    }
  };

  // Save user settings when they change
  const saveUserSettings = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('gp_scribe_settings')
        .upsert({
          user_id: user.id,
          default_output_level: outputLevel,
          default_show_snomed_codes: showSnomedCodes,
          default_format_for_emis: formatForEmis,
          default_format_for_systmone: formatForSystmOne,
        });

      if (error) {
        console.error('Error saving user settings:', error);
      }
    } catch (error) {
      console.error('Error saving user settings:', error);
    }
  };

  const handleTranscript = (transcriptData: TranscriptData) => {
    if (isPaused) return;
    
    setRealtimeTranscripts(prev => {
      const filtered = prev.filter(t => 
        !(t.speaker === transcriptData.speaker && !t.isFinal)
      );
      const newTranscripts = [...filtered, transcriptData];
      
      if (transcriptData.isFinal) {
        const finalTranscripts = newTranscripts.filter(t => t.isFinal);
        const fullTranscript = finalTranscripts
          .map(t => `${t.speaker}: ${t.text}`)
          .join('\n');
        
        setTranscript(fullTranscript);
        
        const words = fullTranscript.split(' ').filter(word => word.length > 0);
        setWordCount(words.length);
        
        // Auto-trigger guidance if enabled and transcript is meaningful
        if (autoGuidance && fullTranscript.length > 200 && words.length > 30) {
          debounceGuidance(fullTranscript);
        }
      }
      
      return newTranscripts;
    });
  };

  // Debounced guidance function to avoid too many API calls
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceGuidance = (text: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      generateGuidance(text);
    }, 5000); // Wait 5 seconds after transcript stops changing
  };

  const handleTranscriptionError = (error: string) => {
    toast.error(`Transcription Error: ${error}`);
    setConnectionStatus("Error");
  };

  const handleStatusChange = (status: string) => {
    queueMicrotask(() => setConnectionStatus(status));
  };

  const startRecording = async () => {
    // Check if patient consent is obtained
    if (!patientConsentObtained) {
      toast.error("Please confirm that patient consent has been obtained before starting recording");
      return;
    }

    try {
      transciberRef.current = new RealtimeTranscriber(
        handleTranscript,
        handleTranscriptionError,
        handleStatusChange
      );
      
      await transciberRef.current.startTranscription();
      
      setIsRecording(true);
      setIsPaused(false);
      setRealtimeTranscripts([]);
      
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      toast.success(`Recording started for ${consultationType} consultation`);

    } catch (error) {
      toast.error("Failed to start recording");
    }
  };

  const pauseRecording = () => {
    setIsPaused(!isPaused);
    if (!isPaused) {
      toast.success("Recording paused");
    } else {
      toast.success("Recording resumed");
    }
  };

  const stopRecording = () => {
    if (transciberRef.current) {
      transciberRef.current.stopTranscription();
      transciberRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRecording(false);
    setIsPaused(false);
    toast.success("Recording stopped");
    
    // Auto-generate summary if there's meaningful content
    if (transcript && transcript.trim().length > 50) {
      setTimeout(() => generateSummary(), 1000);
    }
  };

  const loadExample = (exampleId: string) => {
    const example = consultationExamples.find(ex => ex.id === exampleId);
    if (example) {
      setTranscript(example.transcript);
      setWordCount(example.transcript.split(' ').filter(word => word.length > 0).length);
      setDuration(300); // 5 minutes example duration
      
      // Load the pre-defined clinical notes and trainee feedback
      setGpSummary(example.expectedNotes.gpSummary);
      setFullNote(example.expectedNotes.fullNote);
      setPatientCopy(example.expectedNotes.patientCopy);
      setTraineeFeedback(example.traineeFeedback);
      
      // Update edit content as well
      setEditContent({
        gpSummary: example.expectedNotes.gpSummary,
        fullNote: example.expectedNotes.fullNote,
        patientCopy: example.expectedNotes.patientCopy,
        traineeFeedback: example.traineeFeedback,
        referralLetter: ""
      });
      
      toast.success(`Loaded example: ${example.title} with supervisor feedback`);
      
      // Auto-generate guidance for the example
      generateGuidance(example.transcript);
    }
  };

  const generateGuidance = async (transcriptText?: string) => {
    const textToAnalyze = transcriptText || transcript;
    if (!textToAnalyze.trim()) {
      toast.error("No transcript available for guidance");
      return;
    }

    setIsGuidanceLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('gp-consultation-guidance', {
        body: {
          transcript: textToAnalyze
        }
      });

      if (error) throw error;

      setGuidance(data);
      
      if (!transcriptText) { // Only show toast for manual requests
        toast.success("Consultation guidance generated");
      }
    } catch (error: any) {
      console.error('Error generating guidance:', error);
      if (!transcriptText) { // Only show error for manual requests
        toast.error(`Error generating guidance: ${error.message}`);
      }
    } finally {
      setIsGuidanceLoading(false);
    }
  };

  const generateSummary = async () => {
    if (!transcript.trim()) {
      toast.error("No transcript available to generate summary");
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-gp-consultation-notes', {
        body: {
          transcript,
          outputLevel,
          showSnomedCodes,
          formatForEmis,
          formatForSystmOne,
          userId: user?.id
        }
      });

      if (error) throw error;

      setGpSummary(data.gpSummary || "");
      setFullNote(data.fullNote || "");
      setPatientCopy(data.patientCopy || "");
      setTraineeFeedback(data.traineeFeedback || "");
      setReferralLetter(data.referralLetter || "");
      
      // Update edit content as well
      setEditContent({
        gpSummary: data.gpSummary || "",
        fullNote: data.fullNote || "",
        patientCopy: data.patientCopy || "",
        traineeFeedback: data.traineeFeedback || "",
        referralLetter: data.referralLetter || ""
      });
      
      // Save to history
      await saveToHistory(data);
      
      toast.success("Clinical summary generated successfully");
    } catch (error: any) {
      toast.error(`Error generating summary: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveToHistory = async (summaryData: any) => {
    if (!user) return;

    try {
      // Create meeting record
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: `GP Consultation - ${new Date().toLocaleDateString()}`,
          description: "GP Scribe consultation notes",
          meeting_type: "gp_consultation",
          duration_minutes: Math.ceil(duration / 60),
          status: "completed"
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Save transcript
      if (transcript) {
        await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: meeting.id,
            content: transcript,
            speaker_name: "Consultation",
            timestamp_seconds: 0
          });
      }

      // Save summary
      await supabase
        .from('meeting_summaries')
        .insert({
          meeting_id: meeting.id,
          summary: summaryData.gpSummary,
          key_points: summaryData.fullNote ? [summaryData.fullNote] : [],
          action_items: summaryData.patientCopy ? [summaryData.patientCopy] : [],
          next_steps: summaryData.traineeFeedback ? [summaryData.traineeFeedback] : []
        });

    } catch (error: any) {
      console.error('Error saving to history:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      // Remove markdown formatting for clipboard
      const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
      await navigator.clipboard.writeText(cleanText);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Function to format text for display (convert markdown to JSX)
  const formatTextForDisplay = (text: string) => {
    if (!text) return null;
    
    // Split by double asterisks for bold
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Auto-regenerate GP Summary when output level changes
  const handleOutputLevelChange = async (newLevel: number) => {
    setOutputLevel(newLevel);
    
    // Auto-regenerate if there's content
    if (transcript && transcript.trim().length > 50) {
      setTimeout(() => generateSummary(), 500);
    }
  };

  // Edit functions
  const startEdit = (section: keyof typeof editStates) => {
    const currentContent = {
      gpSummary,
      fullNote,
      patientCopy,
      traineeFeedback,
      referralLetter
    };
    
    setEditContent(prev => ({
      ...prev,
      [section]: currentContent[section]
    }));
    
    setEditStates(prev => ({
      ...prev,
      [section]: true
    }));
  };

  const saveEdit = (section: keyof typeof editStates) => {
    const setters = {
      gpSummary: setGpSummary,
      fullNote: setFullNote,
      patientCopy: setPatientCopy,
      traineeFeedback: setTraineeFeedback,
      referralLetter: setReferralLetter
    };
    
    setters[section](editContent[section]);
    setEditStates(prev => ({
      ...prev,
      [section]: false
    }));
    
    toast.success("Changes saved");
  };

  const cancelEdit = (section: keyof typeof editStates) => {
    setEditStates(prev => ({
      ...prev,
      [section]: false
    }));
  };

  const generateReferralLetter = async () => {
    if (!transcript.trim()) {
      toast.error("No transcript available for referral letter");
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-referral-letter', {
        body: {
          transcript,
          gpSummary,
          fullNote,
          userId: user?.id
        }
      });

      if (error) throw error;

      setReferralLetter(data.referralLetter || "");
      setEditContent(prev => ({
        ...prev,
        referralLetter: data.referralLetter || ""
      }));
      
      toast.success("Referral letter generated");
    } catch (error: any) {
      toast.error(`Error generating referral letter: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAsPDF = (content: string, filename: string) => {
    // Remove markdown formatting for PDF
    const cleanContent = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(cleanContent, 180);
    doc.text(splitText, 10, 10);
    doc.save(`${filename}.pdf`);
    toast.success("PDF downloaded");
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'Connecting...':
        return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'Error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return 'default';
      case 'Connecting...':
        return 'secondary';
      case 'Error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Load user settings on component mount
  useEffect(() => {
    loadUserSettings();
  }, [user]);

  // Save user settings when they change
  useEffect(() => {
    if (settingsLoaded) {
      saveUserSettings();
    }
  }, [outputLevel, showSnomedCodes, formatForEmis, formatForSystmOne]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-background">
        <Header onNewMeeting={() => {}} />
        <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Please sign in to use GP Scribe</h2>
            <p className="text-muted-foreground">Authentication is required to access consultation note features.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-6xl">
        
        {/* Tab Navigation */}
        <Tabs defaultValue="consultation" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-muted/50 p-1 rounded-xl border border-border/50">
            <TabsTrigger 
              value="consultation" 
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/50 transition-all duration-200 font-medium"
            >
              Consultation
            </TabsTrigger>
            <TabsTrigger 
              value="examples" 
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/50 transition-all duration-200 font-medium"
            >
              Examples
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/50 transition-all duration-200 font-medium"
            >
              Settings
            </TabsTrigger>
            <TabsTrigger 
              value="translation" 
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/50 transition-all duration-200 font-medium"
            >
              <Languages className="h-4 w-4 mr-1" />
              Translation
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-border/50 transition-all duration-200 font-medium"
            >
              Previous
            </TabsTrigger>
          </TabsList>

        {/* Consultation Tab - Recording Interface */}
        <TabsContent value="consultation" className="space-y-4">
          <Card className="shadow-medium border-accent/20">
            <CardHeader className="pb-4">
              <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  GP Scribe - Consultation Notes
                </span>
                <Badge variant={getConnectionStatusColor() as any} className="flex items-center gap-1 text-xs">
                  {getConnectionStatusIcon()}
                  <span className="hidden sm:inline">{connectionStatus}</span>
                </Badge>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Consultation Setup - Enhanced Design */}
              <div className="bg-gradient-to-br from-primary/5 to-accent/10 rounded-xl p-6 border border-primary/20 shadow-subtle">
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  {/* Left Side - Setup Options */}
                  <div className="flex-1 space-y-6">
                    {/* Consultation Type */}
                    <div>
                      <h4 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Consultation Type
                      </h4>
                      <div className="flex gap-3">
                        <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          consultationType === "face-to-face" 
                            ? "border-primary bg-primary/10 shadow-sm" 
                            : "border-border hover:border-primary/50 bg-background"
                        }`}>
                          <input
                            type="radio"
                            name="consultationType"
                            value="face-to-face"
                            checked={consultationType === "face-to-face"}
                            onChange={(e) => setConsultationType(e.target.value as "face-to-face" | "telephone")}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            consultationType === "face-to-face" ? "border-primary" : "border-muted-foreground"
                          }`}>
                            {consultationType === "face-to-face" && (
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                            )}
                          </div>
                          <span className="text-sm font-medium">Face to Face</span>
                        </label>
                        
                        <label className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          consultationType === "telephone" 
                            ? "border-primary bg-primary/10 shadow-sm" 
                            : "border-border hover:border-primary/50 bg-background"
                        }`}>
                          <input
                            type="radio"
                            name="consultationType"
                            value="telephone"
                            checked={consultationType === "telephone"}
                            onChange={(e) => setConsultationType(e.target.value as "face-to-face" | "telephone")}
                            className="sr-only"
                          />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            consultationType === "telephone" ? "border-primary" : "border-muted-foreground"
                          }`}>
                            {consultationType === "telephone" && (
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                            )}
                          </div>
                          <span className="text-sm font-medium">Telephone</span>
                        </label>
                      </div>
                    </div>

                    {/* Patient Consent */}
                    <div>
                      <h4 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Patient Consent
                      </h4>
                      <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        patientConsentObtained 
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20" 
                          : "border-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:border-orange-500"
                      }`}>
                        <Checkbox 
                          id="patient-consent" 
                          checked={patientConsentObtained}
                          onCheckedChange={(checked) => setPatientConsentObtained(checked === true)}
                          className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium block">
                            Patient consent obtained for recording this consultation
                          </span>
                          <span className="text-xs text-muted-foreground mt-1 block">
                            Required before starting any recording session
                          </span>
                        </div>
                        {patientConsentObtained && (
                          <Check className="h-5 w-5 text-green-600" />
                        )}
                      </label>
                    </div>

                    {/* Recording Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-accent/20 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-primary">{formatDuration(duration)}</div>
                        <div className="text-sm text-muted-foreground">Duration</div>
                      </div>
                      <div className="bg-accent/20 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-primary">{wordCount}</div>
                        <div className="text-sm text-muted-foreground">Words</div>
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Recording Button */}
                  <div className="lg:border-l lg:border-primary/20 lg:pl-6 flex flex-col items-center">
                    <div className="flex flex-col items-center gap-4">
                      {!isRecording ? (
                        <Button 
                          onClick={startRecording}
                          disabled={!patientConsentObtained}
                          className={`shadow-elegant px-8 py-6 text-lg font-semibold min-h-[64px] rounded-xl transition-all duration-300 ${
                            patientConsentObtained 
                              ? "bg-gradient-primary hover:bg-primary-hover hover:shadow-glow hover:scale-105" 
                              : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                          }`}
                        >
                          <Mic className="h-6 w-6 mr-3" />
                          Start Recording
                        </Button>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <Button 
                            onClick={pauseRecording}
                            variant="secondary"
                            className="shadow-subtle px-8 py-4 text-lg font-medium min-h-[56px] rounded-xl"
                          >
                            {isPaused ? <Play className="h-5 w-5 mr-3" /> : <Pause className="h-5 w-5 mr-3" />}
                            {isPaused ? 'Resume' : 'Pause'}
                          </Button>
                          <Button 
                            onClick={stopRecording}
                            variant="destructive"
                            className="shadow-subtle px-8 py-4 text-lg font-medium min-h-[56px] rounded-xl"
                          >
                            <MicOff className="h-5 w-5 mr-3" />
                            Stop Recording
                          </Button>
                        </div>
                      )}
                      
                      {isRecording && (
                        <div className="flex items-center justify-center gap-3 text-primary animate-pulse bg-accent/20 rounded-lg p-4 mt-4">
                          <div className="w-3 h-3 bg-primary rounded-full"></div>
                          <span className="text-base font-medium">
                            {isPaused ? "Recording paused..." : "Recording consultation..."}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

          {/* Tab Content */}
          <Card className="shadow-medium border-accent/20">
            <CardContent className="p-6">

              {/* Consultation Examples Tab */}
              <TabsContent value="examples" className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Test Consultation Examples</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowExamples(!showExamples)}
                    >
                      {showExamples ? "Hide Examples" : "Show Examples"}
                    </Button>
                  </div>
                  
                  {showExamples && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {consultationExamples.map((example) => (
                        <Card key={example.id} className="cursor-pointer hover:shadow-md transition-shadow border-accent/20">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm sm:text-base">{example.title}</h4>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {example.description}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {example.type}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadExample(example.id)}
                                className="ml-2 shrink-0"
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Load
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Settings Tab - Combined Configuration and Settings */}
              <TabsContent value="settings" className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Output Configuration Section */}
                  <Card className="border-accent/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Output Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Output Level</label>
                        <Select value={outputLevel.toString()} onValueChange={(value) => handleOutputLevelChange(parseInt(value))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select output level" />
                          </SelectTrigger>
                          <SelectContent>
                            {outputLevels.map((level) => (
                              <SelectItem key={level.value} value={level.value.toString()}>
                                <div>
                                  <div className="font-medium">Level {level.value}: {level.label}</div>
                                  <div className="text-xs text-muted-foreground">{level.description}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Clinical Coding & Formatting</h4>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="snomed-codes" 
                            checked={showSnomedCodes}
                            onCheckedChange={(checked) => setShowSnomedCodes(checked === true)}
                          />
                          <label htmlFor="snomed-codes" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Include SNOMED CT codes
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="emis-format" 
                            checked={formatForEmis}
                            onCheckedChange={(checked) => setFormatForEmis(checked === true)}
                          />
                          <label htmlFor="emis-format" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Format for EMIS Web
                          </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="systmone-format" 
                            checked={formatForSystmOne}
                            onCheckedChange={(checked) => setFormatForSystmOne(checked === true)}
                          />
                          <label htmlFor="systmone-format" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Format for SystmOne
                          </label>
                        </div>
                      </div>

                      <Button
                        onClick={generateSummary}
                        disabled={!transcript.trim() || isGenerating}
                        className="w-full bg-gradient-primary hover:bg-primary-hover shadow-subtle text-lg font-medium py-4"
                      >
                        <Brain className="h-5 w-5 mr-3" />
                        {isGenerating ? "Generating Clinical Summary..." : "🧠 Generate Clinical Summary"}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Practice Settings Section */}
                  <Card className="border-accent/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Practice Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-6">
                        <h4 className="text-base font-semibold mb-3">GP Scribe Settings</h4>
                        <p className="text-muted-foreground mb-6 text-sm">
                          Configure your practice details, specialist services, and GP signature settings.
                        </p>
                        <Button
                          onClick={() => navigate('/gp-scribe/settings')}
                          className="flex items-center gap-2"
                        >
                          <Settings className="h-4 w-4" />
                          Open Settings
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Translation Tab */}
              <TabsContent value="translation" className="space-y-4">
                <TranslationInterface 
                  transcript={transcript}
                  isRecording={isRecording}
                  onLanguageChange={(languageCode) => setTranslationLanguage(languageCode)}
                />
              </TabsContent>

              {/* Previous Consultations Tab */}
              <TabsContent value="history" className="space-y-4">
                <div className="text-center py-8">
                  <h3 className="text-lg font-semibold mb-4">Previous Consultations</h3>
                  <p className="text-muted-foreground mb-6">
                    View and manage your previous consultation notes and recordings.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This feature is coming soon...
                  </p>
                </div>
              </TabsContent>
            </CardContent>
          </Card>

        {/* Transcript - Collapsible */}
        <Card className="shadow-medium border-accent/20">
          <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/10 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    Transcript
                    {wordCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {wordCount} words
                      </Badge>
                    )}
                  </span>
                  {isTranscriptOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="bg-secondary/50 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                  {transcript ? (
                    <pre className="whitespace-pre-wrap text-sm">{transcript}</pre>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Start recording or load an example to see transcription...
                    </p>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>


        {/* Generated Output */}
        {(gpSummary || fullNote || patientCopy || traineeFeedback || referralLetter) && (
          <Card className="shadow-medium border-accent/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generated Clinical Notes</span>
                <Button
                  onClick={generateReferralLetter}
                  disabled={!transcript.trim() || isGenerating}
                  variant="outline"
                  size="sm"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isGenerating ? "Generating..." : "Generate Referral"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="summary">🟦 GP Summary</TabsTrigger>
                  <TabsTrigger value="full">🟨 Full Note</TabsTrigger>
                  <TabsTrigger value="patient">🟩 Patient Copy</TabsTrigger>
                  <TabsTrigger value="trainee">🟣 Trainee Feedback</TabsTrigger>
                  <TabsTrigger value="referral">📄 Referral Letter</TabsTrigger>
                </TabsList>
                
                <TabsContent value="summary" className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Quick Pick Level:</label>
                      <Select value={outputLevel.toString()} onValueChange={(value) => handleOutputLevelChange(parseInt(value))}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {outputLevels.map((level) => (
                            <SelectItem key={level.value} value={level.value.toString()}>
                              {level.value}: {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit('gpSummary')}
                      disabled={editStates.gpSummary}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  
                  {editStates.gpSummary ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent.gpSummary}
                        onChange={(e) => setEditContent(prev => ({ ...prev, gpSummary: e.target.value }))}
                        className="min-h-[200px] bg-blue-50 dark:bg-blue-950/20"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit('gpSummary')}>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit('gpSummary')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
                      {formatTextForDisplay(gpSummary) || "No summary generated yet"}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(gpSummary)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(gpSummary, 'gp-summary')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="full" className="space-y-4">
                  <div className="flex items-center justify-end mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit('fullNote')}
                      disabled={editStates.fullNote}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  
                  {editStates.fullNote ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent.fullNote}
                        onChange={(e) => setEditContent(prev => ({ ...prev, fullNote: e.target.value }))}
                        className="min-h-[200px] bg-yellow-50 dark:bg-yellow-950/20"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit('fullNote')}>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit('fullNote')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
                      {formatTextForDisplay(fullNote) || "No full note generated yet"}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(fullNote)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(fullNote, 'full-note')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="patient" className="space-y-4">
                  <div className="flex items-center justify-end mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit('patientCopy')}
                      disabled={editStates.patientCopy}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  
                  {editStates.patientCopy ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent.patientCopy}
                        onChange={(e) => setEditContent(prev => ({ ...prev, patientCopy: e.target.value }))}
                        className="min-h-[200px] bg-green-50 dark:bg-green-950/20"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit('patientCopy')}>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit('patientCopy')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
                      {formatTextForDisplay(patientCopy) || "No patient copy generated yet"}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(patientCopy)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(patientCopy, 'patient-copy')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="trainee" className="space-y-4">
                  <div className="flex items-center justify-end mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit('traineeFeedback')}
                      disabled={editStates.traineeFeedback}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  
                  {editStates.traineeFeedback ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent.traineeFeedback}
                        onChange={(e) => setEditContent(prev => ({ ...prev, traineeFeedback: e.target.value }))}
                        className="min-h-[200px] bg-purple-50 dark:bg-purple-950/20"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit('traineeFeedback')}>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit('traineeFeedback')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                       
                       {/* Consultation Guidance Integration */}
                      {guidance && (
                        <div className="space-y-4 border-t pt-4">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Brain className="h-5 w-5 text-blue-500" />
                            Real-time Consultation Analysis
                            {isGuidanceLoading && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                            )}
                          </h4>
                          
                          {/* Consultation Quality Score */}
                          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-5 w-5 text-blue-500" />
                              <span className="font-medium">Quality Score:</span>
                            </div>
                            <Badge variant="outline" className="text-lg font-semibold">
                              {guidance.consultationQuality.score}/10
                            </Badge>
                            <div className="flex-1 text-sm text-muted-foreground">
                              {guidance.consultationQuality.feedback}
                            </div>
                          </div>

                          <div className="grid gap-4">
                            {/* Suggested Questions */}
                            {guidance.suggestedQuestions.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="font-medium flex items-center gap-2">
                                  <Brain className="h-4 w-4 text-blue-500" />
                                  Suggested Questions
                                </h5>
                                <ul className="space-y-1 text-sm">
                                  {guidance.suggestedQuestions.map((question, index) => (
                                    <li key={index} className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                      • {question}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Red Flags */}
                            {guidance.potentialRedFlags.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="font-medium flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                  Potential Red Flags
                                </h5>
                                <ul className="space-y-1 text-sm">
                                  {guidance.potentialRedFlags.map((flag, index) => (
                                    <li key={index} className="p-2 bg-red-50 dark:bg-red-950/20 rounded">
                                      ⚠️ {flag}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Missed Opportunities */}
                            {guidance.missedOpportunities.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="font-medium flex items-center gap-2">
                                  <BookOpen className="h-4 w-4 text-orange-500" />
                                  Consider Exploring
                                </h5>
                                <ul className="space-y-1 text-sm">
                                  {guidance.missedOpportunities.map((opportunity, index) => (
                                    <li key={index} className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                                      💡 {opportunity}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Safety Netting */}
                            {guidance.safetyNetting.length > 0 && (
                              <div className="space-y-2">
                                <h5 className="font-medium flex items-center gap-2">
                                  <Shield className="h-4 w-4 text-green-500" />
                                  Safety Netting
                                </h5>
                                <ul className="space-y-1 text-sm">
                                  {guidance.safetyNetting.map((safety, index) => (
                                    <li key={index} className="p-2 bg-green-50 dark:bg-green-950/20 rounded">
                                      🛡️ {safety}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(traineeFeedback)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(traineeFeedback, 'trainee-feedback')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
                
                <TabsContent value="referral" className="space-y-4">
                  <div className="flex items-center justify-end mb-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit('referralLetter')}
                      disabled={editStates.referralLetter}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                  
                  {editStates.referralLetter ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent.referralLetter}
                        onChange={(e) => setEditContent(prev => ({ ...prev, referralLetter: e.target.value }))}
                        className="min-h-[200px] bg-gray-50 dark:bg-gray-950/20"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit('referralLetter')}>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => cancelEdit('referralLetter')}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 dark:bg-gray-950/20 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: (referralLetter || "No referral letter generated yet")
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\n/g, '<br/>') 
                        }} 
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(referralLetter)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button size="sm" onClick={() => downloadAsPDF(referralLetter, 'referral-letter')}>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
        </Tabs>
      </div>
    </div>
  );
};

export default Index;