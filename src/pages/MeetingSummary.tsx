import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, 
  Clock, 
  Users, 
  FileText, 
  CheckCircle, 
  Download, 
  Mail, 
  Edit3, 
  Play, 
  Save,
  FileDown,
  FilePlus2,
  Sparkles,
  Settings,
  ChevronDown,
  RotateCcw
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MeetingSettings } from "@/components/MeetingSettings";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from "docx";
import jsPDF from "jspdf";

interface MeetingData {
  id?: string;
  title: string;
  duration: string;
  wordCount: number;
  transcript: string;
  speakerCount: number;
  startTime: string;
  practiceName?: string;
}

export default function MeetingSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Editable summary content
  const [summaryContent, setSummaryContent] = useState({
    attendees: "",
    agenda: "",
    keyPoints: "",
    decisions: "",
    actionItems: "",
    nextSteps: "",
    additionalNotes: ""
  });
  
  // Email settings
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [attendeeEmails, setAttendeeEmails] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGeneratingMinutes, setIsGeneratingMinutes] = useState(false);
  const [aiGeneratedMinutes, setAiGeneratedMinutes] = useState<string | null>(null);
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [editableContent, setEditableContent] = useState<string>("");
  const [countdown, setCountdown] = useState(0);
  const [expectedDuration, setExpectedDuration] = useState(0);
  
  // Detail level and meeting settings
  const [detailLevel, setDetailLevel] = useState<'shorter' | 'standard' | 'detailed' | 'super-detailed'>('standard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [meetingSettings, setMeetingSettings] = useState({
    title: "",
    description: "",
    meetingType: "general",
    attendees: "",
    agenda: ""
  });

  useEffect(() => {
    const data = location.state as MeetingData & { extractedSettings?: any };
    if (data && !isSaved && !isSaving && !meetingData?.id) {
      setMeetingData(data);
      
      // Initialize meeting settings
      setMeetingSettings({
        title: data.title,
        description: data.extractedSettings?.description || "",
        meetingType: data.extractedSettings?.meetingType || "general",
        attendees: data.extractedSettings?.attendees || "",
        agenda: data.extractedSettings?.agenda || ""
      });
      
      // Auto-populate summary content from imported data
      if (data.extractedSettings) {
        setSummaryContent(prev => ({
          ...prev,
          attendees: data.extractedSettings.attendees || prev.attendees,
          agenda: data.extractedSettings.agenda || prev.agenda,
        }));
      }
      
      saveMeetingToDatabase(data);
    } else if (!data) {
      navigate('/');
    }
  }, [location.state, navigate, isSaved, isSaving, meetingData?.id]);

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGeneratingMinutes && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGeneratingMinutes, countdown]);

  // Calculate expected duration based on word count
  const calculateExpectedDuration = (wordCount: number): number => {
    if (wordCount >= 15000) return 60; // 60 seconds for 15,000+ words
    if (wordCount >= 5000) return 45;  // 45 seconds for 5,000-9,999 words
    return 30; // 30 seconds for less than 5,000 words
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const saveMeetingToDatabase = async (data: MeetingData) => {
    if (isSaving || isSaved) return;
    
    setIsSaving(true);
    try {
      if (!user) throw new Error('User not authenticated');

      // Check if meeting already exists with same start time and user
      const { data: existingMeeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('user_id', user.id)
        .eq('start_time', data.startTime)
        .eq('title', data.title)
        .single();

      if (existingMeeting) {
        console.log('Meeting already exists, skipping save');
        setMeetingData(prev => prev ? { ...prev, id: existingMeeting.id } : null);
        setIsSaved(true);
        return;
      }

      // Get default practice name
      let practiceName = "";
      try {
        const { data: practice } = await supabase
          .from('practice_details')
          .select('practice_name')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .single();
        practiceName = practice?.practice_name || "";
      } catch (error) {
        // No default practice found
      }

      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title: data.title,
          user_id: user.id,
          start_time: data.startTime,
          end_time: new Date().toISOString(),
          duration_minutes: Math.floor(parseInt(data.duration.split(':')[0]) + parseInt(data.duration.split(':')[1]) / 60),
          status: 'completed',
          meeting_type: 'consultation'
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      if (data.transcript && meeting) {
        const { error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: meeting.id,
            content: data.transcript,
            speaker_name: 'Multiple Speakers',
            timestamp_seconds: 0,
            confidence_score: 0.8
          });

        if (transcriptError) throw transcriptError;
      }

      setMeetingData(prev => prev ? { ...prev, id: meeting.id, practiceName } : null);
      setIsSaved(true);
      
      toast.success("Meeting saved successfully");
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error("Failed to save meeting data");
    } finally {
      setIsSaving(false);
    }
  };

  const continueMeeting = () => {
    navigate('/', { state: { continueMeeting: true, meetingData } });
  };

  const generateNHSSummaryContent = () => {
    // Use AI-generated content if available, otherwise fall back to form content
    if (aiGeneratedMinutes) {
      return aiGeneratedMinutes;
    }

    // Fallback to form-based content if no AI content exists
    const date = new Date(meetingData?.startTime || new Date()).toLocaleDateString('en-GB');
    const time = new Date(meetingData?.startTime || new Date()).toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return `NHS MEETING MINUTES

Meeting Title: ${meetingData?.title || 'General Meeting'}
Date: ${date}
Time: ${time}
Duration: ${meetingData?.duration || '00:00'}
${meetingData?.practiceName ? `Practice: ${meetingData.practiceName}` : ''}

ATTENDEES:
${summaryContent.attendees || 'Not specified'}

AGENDA:
${summaryContent.agenda || 'Not specified'}

KEY DISCUSSION POINTS:
${summaryContent.keyPoints || 'Not specified'}

DECISIONS MADE:
${summaryContent.decisions || 'Not specified'}

ACTION ITEMS:
${summaryContent.actionItems || 'Not specified'}

NEXT STEPS:
${summaryContent.nextSteps || 'Not specified'}

ADDITIONAL NOTES:
${summaryContent.additionalNotes || 'Not specified'}

---
Meeting recorded with Notewell AI Meeting Notes Service
Total words transcribed: ${meetingData?.wordCount || 0}
Speakers detected: ${meetingData?.speakerCount || 0}`;
  };

  const downloadDocx = async () => {
    try {
      const content = generateNHSSummaryContent();
      
      // If using AI content, we need to convert it properly for DOCX
      let docContent;
      if (aiGeneratedMinutes) {
        // Clean the AI content for DOCX format (remove HTML tags if any)
        docContent = content
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')  // Replace HTML entities
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
      } else {
        docContent = content;
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: aiGeneratedMinutes ? "AI Generated Meeting Minutes" : "NHS MEETING MINUTES",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),
            ...docContent.split('\n').map(line => 
              new Paragraph({
                children: [new TextRun(line)],
              })
            ),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${meetingData?.title || 'meeting'}_minutes.docx`);
      toast.success("DOCX file downloaded successfully");
    } catch (error) {
      console.error('Error generating DOCX:', error);
      toast.error("Failed to generate DOCX file");
    }
  };

  const downloadPDF = () => {
    try {
      const content = generateNHSSummaryContent();
      
      // Clean content for PDF (remove HTML tags if any)
      let pdfContent;
      if (aiGeneratedMinutes) {
        pdfContent = content
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ')  // Replace HTML entities
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');
      } else {
        pdfContent = content;
      }

      const pdf = new jsPDF();
      const lines = pdfContent.split('\n');
      let y = 20;
      
      pdf.setFontSize(16);
      pdf.text(aiGeneratedMinutes ? "AI Generated Meeting Minutes" : "NHS MEETING MINUTES", 105, y, { align: 'center' });
      y += 20;
      
      pdf.setFontSize(10);
      lines.forEach(line => {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }
        // Handle long lines by splitting them
        const splitLines = pdf.splitTextToSize(line, 170);
        splitLines.forEach((splitLine: string) => {
          if (y > 270) {
            pdf.addPage();
            y = 20;
          }
          pdf.text(splitLine, 20, y);
          y += 6;
        });
      });
      
      pdf.save(`${meetingData?.title || 'meeting'}_minutes.pdf`);
      toast.success("PDF file downloaded successfully");
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF file");
    }
  };

  const downloadTranscript = () => {
    if (!meetingData?.transcript) {
      toast.error("No transcript available");
      return;
    }

    const date = new Date(meetingData.startTime).toLocaleDateString('en-GB');
    const time = new Date(meetingData.startTime).toLocaleTimeString('en-GB');
    
    const transcriptContent = `MEETING TRANSCRIPT

Meeting: ${meetingData.title}
Date: ${date}
Start Time: ${time}
Duration: ${meetingData.duration}
Total Words: ${meetingData.wordCount}
Speakers: ${meetingData.speakerCount}
${meetingData.practiceName ? `Practice: ${meetingData.practiceName}` : ''}

---

${meetingData.transcript}

---
Generated by Notewell AI Meeting Notes Service`;

    const blob = new Blob([transcriptContent], { type: 'text/plain' });
    saveAs(blob, `${meetingData.title}_transcript.txt`);
    toast.success("Transcript downloaded successfully");
  };

  const sendEmail = async () => {
    if (!user?.email) {
      toast.error("User email not available");
      return;
    }

    setIsEmailLoading(true);
    try {
      const attendeeEmailList = attendeeEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const response = await supabase.functions.invoke('send-meeting-summary', {
        body: {
          userEmail: user.email,
          attendeeEmails: attendeeEmailList,
          meetingTitle: meetingData?.title || 'Meeting',
          meetingDate: new Date(meetingData?.startTime || new Date()).toLocaleDateString('en-GB'),
          duration: meetingData?.duration || '00:00',
          summary: generateNHSSummaryContent(),
          includeTranscript,
          transcript: includeTranscript ? meetingData?.transcript : undefined,
          practiceName: meetingData?.practiceName
        }
      });

      if (response.error) throw response.error;
      
      toast.success("Email sent successfully");
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error("Failed to send email");
    } finally {
      setIsEmailLoading(false);
    }
  };

  const generateAIMeetingMinutes = async (customDetailLevel?: string) => {
    if (!meetingData?.transcript) {
      toast.error("No transcript available for AI generation");
      return;
    }

    // Use custom detail level if provided, otherwise use current setting
    const levelToUse = customDetailLevel || detailLevel;

    // Calculate and set expected duration based on word count
    const duration = calculateExpectedDuration(meetingData.wordCount);
    setExpectedDuration(duration);
    setCountdown(duration);

    setIsGeneratingMinutes(true);
    try {
      const meetingDate = new Date(meetingData.startTime).toLocaleDateString('en-GB');
      const meetingTime = new Date(meetingData.startTime).toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const response = await supabase.functions.invoke('generate-meeting-minutes', {
        body: {
          transcript: meetingData.transcript,
          meetingTitle: meetingSettings.title || meetingData.title,
          meetingDate,
          meetingTime,
          detailLevel: levelToUse,
          meetingType: meetingSettings.meetingType,
          attendees: meetingSettings.attendees,
          agenda: meetingSettings.agenda,
          description: meetingSettings.description
        }
      });

      if (response.error) throw response.error;

      const { meetingMinutes } = response.data;
      
      // Store the full AI-generated document
      setAiGeneratedMinutes(meetingMinutes);

      toast.success("AI meeting minutes generated successfully!");
      
    } catch (error) {
      console.error('Error generating AI meeting minutes:', error);
      toast.error("Failed to generate AI meeting minutes");
    } finally {
      setIsGeneratingMinutes(false);
    }
  };

  const saveEditedContent = () => {
    setAiGeneratedMinutes(editableContent);
    setIsEditingDocument(false);
    toast.success("Changes saved successfully!");
  };

  const startEditing = () => {
    setEditableContent(aiGeneratedMinutes || "");
    setIsEditingDocument(true);
  };

  const cancelEditing = () => {
    setEditableContent("");
    setIsEditingDocument(false);
  };

  // Enhanced markdown-like rendering function
  const renderFormattedText = (text: string) => {
    if (!text) return text;
    
    let formatted = text;
    
    // Fix attendees section - convert bullet points to comma-separated names and remove "Other" sections
    formatted = formatted.replace(
      /(1️⃣ Attendees[\s\S]*?)(?=2️⃣|$)/i,
      (match) => {
        let attendeesSection = match;
        
        // Remove any "Other" related sections completely
        attendeesSection = attendeesSection.replace(/Other[^:]*:[\s\S]*?(?=\n\n|2️⃣|$)/gi, '');
        attendeesSection = attendeesSection.replace(/Other[^:]*[\s\S]*?(?=\n\n|2️⃣|$)/gi, '');
        
        // Remove bullet points and convert to comma-separated list
        attendeesSection = attendeesSection.replace(/^[•\-\*]\s*(.+)$/gm, '$1');
        
        // Split into lines and clean up
        const lines = attendeesSection.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.includes('1️⃣') && !line.toLowerCase().includes('other'))
          .filter(line => line.length > 2); // Remove very short lines
        
        if (lines.length > 0) {
          // Join names with commas and ensure proper formatting
          const cleanedNames = lines.join(', ').replace(/,\s*,/g, ',').replace(/,+/g, ',');
          attendeesSection = `1️⃣ Attendees\n${cleanedNames}\n\n`;
        }
        
        return attendeesSection;
      }
    );
    
    // Ensure proper spacing between emoji sections
    formatted = formatted.replace(/(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣)/g, '\n\n$1');
    
    // Convert #### headers (level 4)
    formatted = formatted.replace(/^#### (.*$)/gm, '<h4 class="text-base font-semibold mt-3 mb-2 text-gray-800">$1</h4>');
    
    // Convert ### headers (level 3)
    formatted = formatted.replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-800">$1</h3>');
    
    // Convert ## headers (level 2)
    formatted = formatted.replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-6 mb-3 text-gray-800">$1</h2>');
    
    // Convert # headers (level 1)
    formatted = formatted.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-8 mb-4 text-gray-800">$1</h1>');
    
    
    // Improve table formatting with minimal top spacing
    formatted = formatted.replace(/\|(.+)\|/g, (match, content) => {
      const cells = content.split('|').map(cell => cell.trim());
      const cellsHtml = cells.map(cell => 
        `<td class="border border-gray-300 px-3 py-2 text-sm">${cell}</td>`
      ).join('');
      return `<tr>${cellsHtml}</tr>`;
    });
    
    // Wrap table rows in proper table structure with minimal spacing before tables
    formatted = formatted.replace(/(<tr>.*<\/tr>\s*)+/g, (match) => {
      return `<table class="w-full border-collapse border border-gray-300 mt-1 mb-4">${match}</table>`;
    });
    
    // Remove excessive spacing before tables specifically in section 4
    formatted = formatted.replace(/(4️⃣[^<]*)<div class="mb-3"><\/div>\s*<table/g, '$1<table');
    
    // Convert **bold** to HTML bold
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Convert *italic* to HTML italic
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="italic">$1</em>');
    
    // Convert bullet points with better styling
    formatted = formatted.replace(/^[•\-\*] (.*$)/gm, '<div class="ml-6 mb-1 flex"><span class="mr-2">•</span><span>$1</span></div>');
    
    // Convert numbered lists
    formatted = formatted.replace(/^(\d+)\. (.*$)/gm, '<div class="ml-6 mb-1 flex"><span class="mr-2 font-medium">$1.</span><span>$2</span></div>');
    
    // Convert line breaks to proper spacing with reduced spacing before sections
    formatted = formatted.replace(/\n\n\n+/g, '\n\n'); // Remove excessive line breaks
    formatted = formatted.replace(/\n\n/g, '<div class="mb-3"></div>');
    formatted = formatted.replace(/\n/g, '<br />');
    
    // Clean up excessive spacing around emoji sections
    formatted = formatted.replace(/<div class="mb-3"><\/div>\s*(<div class="mb-3"><\/div>\s*)*(1️⃣|2️⃣|3️⃣|4️⃣|5️⃣)/g, '<div class="mb-4"></div>$2');
    
    return formatted;
  };

  if (!meetingData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{meetingData.title}</h1>
              <p className="text-muted-foreground">NHS Meeting Summary & Minutes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSaved && (
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Saved
              </Badge>
            )}
            <Button variant="outline" onClick={continueMeeting}>
              <Play className="h-4 w-4 mr-2" />
              Continue Meeting
            </Button>
          </div>
        </div>

        {/* Meeting Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.duration}</div>
              <div className="text-sm text-muted-foreground">Duration</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.wordCount}</div>
              <div className="text-sm text-muted-foreground">Words</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">{meetingData.speakerCount}</div>
              <div className="text-sm text-muted-foreground">Speakers</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-primary">100%</div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </CardContent>
          </Card>
        </div>

        {/* Detail Level Controls and Meeting Settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Detail Level Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Generation Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">Detail Level</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={detailLevel === 'shorter' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDetailLevel('shorter')}
                    className="text-xs"
                  >
                    Shorter
                  </Button>
                  <Button
                    variant={detailLevel === 'standard' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDetailLevel('standard')}
                    className="text-xs"
                  >
                    Standard
                  </Button>
                  <Button
                    variant={detailLevel === 'detailed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDetailLevel('detailed')}
                    className="text-xs"
                  >
                    More Detailed
                  </Button>
                  <Button
                    variant={detailLevel === 'super-detailed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDetailLevel('super-detailed')}
                    className="text-xs"
                  >
                    Super Detailed
                  </Button>
                </div>
              </div>
              
              {aiGeneratedMinutes && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Regenerate with Different Detail Level</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateAIMeetingMinutes('shorter')}
                      disabled={isGeneratingMinutes}
                      className="text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Shorter
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateAIMeetingMinutes('detailed')}
                      disabled={isGeneratingMinutes}
                      className="text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      More Detail
                    </Button>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                <strong>Standard:</strong> Balanced detail level (default)<br />
                <strong>Shorter:</strong> Concise key points only<br />
                <strong>More Detailed:</strong> Comprehensive coverage<br />
                <strong>Super Detailed:</strong> Extensive analysis
              </p>
            </CardContent>
          </Card>

          {/* Collapsible Meeting Settings */}
          <Card>
            <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Meeting Settings
                    </span>
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`}
                    />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <MeetingSettings
                    onSettingsChange={(settings) => setMeetingSettings(settings)}
                    initialSettings={{
                      title: meetingSettings.title,
                      description: meetingSettings.description,
                      meetingType: meetingSettings.meetingType
                    }}
                  />
                  {aiGeneratedMinutes && (
                    <div className="mt-4 pt-4 border-t">
                      <Button
                        onClick={() => generateAIMeetingMinutes()}
                        disabled={isGeneratingMinutes}
                        className="w-full"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Regenerate with Updated Settings
                      </Button>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* AI Generated Meeting Minutes Document View */}
          {aiGeneratedMinutes ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FilePlus2 className="h-5 w-5" />
                      AI Generated Meeting Minutes
                    </span>
                    <div className="flex gap-2">
                      {!isEditingDocument ? (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={startEditing}
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit Document
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setAiGeneratedMinutes(null)}
                          >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Summary View
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={saveEditedContent}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={cancelEditing}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditingDocument ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <Textarea
                        value={editableContent}
                        onChange={(e) => setEditableContent(e.target.value)}
                        className="min-h-[600px] font-mono text-sm resize-none border-0 shadow-none focus:ring-0"
                        placeholder="Edit your meeting minutes here..."
                      />
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                        <p className="font-medium mb-1">💡 Quick Edit Tips:</p>
                        <ul className="space-y-1">
                          <li>• Use **text** for bold formatting</li>
                          <li>• Use emoji sections like 1️⃣, 2️⃣ for clear structure</li>
                          <li>• Use | table | format | for neat tables</li>
                          <li>• Keep attendee names comma-separated</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm max-h-[800px] overflow-y-auto">
                      <div className="prose max-w-none">
                        <div 
                          className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800"
                          dangerouslySetInnerHTML={{ __html: renderFormattedText(aiGeneratedMinutes) }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions Panel - Only shown in document view */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Download Options */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Download Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button onClick={downloadDocx} className="w-full justify-start">
                      <FileDown className="h-4 w-4 mr-2" />
                      Download as DOCX
                    </Button>
                    <Button onClick={downloadPDF} className="w-full justify-start" variant="outline">
                      <FileDown className="h-4 w-4 mr-2" />
                      Download as PDF
                    </Button>
                    <Button onClick={downloadTranscript} className="w-full justify-start" variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Download Transcript (.txt)
                    </Button>
                  </CardContent>
                </Card>

                {/* Email Options */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Email Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="attendeeEmails">Attendee Emails (comma separated)</Label>
                      <Textarea
                        id="attendeeEmails"
                        placeholder="email1@example.com, email2@example.com"
                        value={attendeeEmails}
                        onChange={(e) => setAttendeeEmails(e.target.value)}
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeTranscript"
                        checked={includeTranscript}
                        onCheckedChange={(checked) => setIncludeTranscript(checked as boolean)}
                      />
                      <Label htmlFor="includeTranscript" className="text-sm">
                        Include full transcript in email
                      </Label>
                    </div>

                    <Button 
                      onClick={sendEmail} 
                      className="w-full"
                      disabled={isEmailLoading}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {isEmailLoading ? 'Sending...' : 'Send Email'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            /* Initial Summary View - Only AI Assistant and Transcript */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* AI Assistant */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => generateAIMeetingMinutes()}
                    className={`w-full ${isGeneratingMinutes ? 'animate-pulse' : 'hover-scale'}`}
                    disabled={isGeneratingMinutes || !meetingData.transcript}
                  >
                    <Sparkles className={`h-4 w-4 mr-2 ${isGeneratingMinutes ? 'animate-spin' : ''}`} />
                    {isGeneratingMinutes ? (
                      <span className="flex items-center gap-2">
                        Generating... 
                        {countdown > 0 && (
                          <span className="bg-white/20 px-2 py-1 rounded text-xs font-mono">
                            {formatTime(countdown)}
                          </span>
                        )}
                      </span>
                    ) : (
                      'Generate Meeting Minutes with AI'
                    )}
                  </Button>
                  
                  {isGeneratingMinutes && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-800">Processing transcript...</span>
                        <span className="text-xs text-blue-600">
                          {Math.round(((expectedDuration - countdown) / expectedDuration) * 100)}% complete
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${((expectedDuration - countdown) / expectedDuration) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-blue-600 mt-2">
                        Estimated time: {formatTime(expectedDuration)} ({meetingData.wordCount.toLocaleString()} words)
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    Uses AI to automatically extract attendees, agenda, key points, decisions, and action items from the transcript.
                  </p>
                </CardContent>
              </Card>

              {/* Meeting Transcript */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Meeting Transcript
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {meetingData.transcript ? (
                    <div className="bg-accent/30 p-4 rounded-lg max-h-60 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm">
                        {meetingData.transcript}
                      </pre>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No transcript available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}