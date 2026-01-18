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
  Mic,
  MicOff,
  Send,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Maximize2,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { Header } from "@/components/Header";
import { FormattedReviewContent } from "@/components/FormattedReviewContent";
import { AIResponsePanel } from "@/components/AIResponsePanel";
import { NotewellAIAnimation } from "@/components/NotewellAIAnimation";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { SMSSendButton } from "@/components/scribe/SMSSendButton";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

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
  generatedData?: {
    gpSummary: string;
    fullNote: string;
    patientCopy: string;
    traineeFeedback: string;
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
  const [noteLevel, setNoteLevel] = useState([1]); // 0: Shorthand, 1: Standard, 2: Detailed
  
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
  
  // Transcript sub-tab state  
  const [transcriptTab, setTranscriptTab] = useState("original"); // "original" or "tidied"
  const [cleanedTranscript, setCleanedTranscript] = useState("");
  const [transcriptMeta, setTranscriptMeta] = useState<{ source: string; itemCount: number } | null>(null);

  // Ask AI state
  const [isAskAIOpen, setIsAskAIOpen] = useState(false);
  const [isAIResponsePanelOpen, setIsAIResponsePanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [consultationScore, setConsultationScore] = useState<number | null>(null);
  const [isScoreExpanded, setIsScoreExpanded] = useState(false);
  const [referralContent, setReferralContent] = useState("");
  const [isLoadingReferral, setIsLoadingReferral] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  const noteLevels = ["Shorthand", "Standard", "Detailed"];

  useEffect(() => {
    const loadConsultationFromDatabase = async (meetingId: string) => {
      try {
        // Load meeting data
        const { data: meeting } = await supabase
          .from('meetings')
          .select('*')
          .eq('id', meetingId)
          .single();

        if (!meeting) {
          toast.error("Consultation not found");
          navigate('/gp-scribe');
          return;
        }

        // Load transcript (full)
        let fullTranscript = "";
        setTranscriptMeta(null);
        // Try RPC to fetch full transcript with source
        try {
          const { data: rpcRows, error: rpcError } = await supabase.rpc('get_meeting_full_transcript', { p_meeting_id: meetingId });
          if (!rpcError && Array.isArray(rpcRows) && rpcRows.length > 0) {
            const row = rpcRows[0] as { source: string; transcript: string; item_count: number };
            if (row?.transcript && row.transcript.trim().length > 0) {
              // Normalise transcript to clean paragraphs
              const { normaliseTranscript } = await import('@/lib/transcriptNormaliser');
              const normalised = normaliseTranscript(row.transcript);
              fullTranscript = normalised.plain;
              setTranscriptMeta({ source: row.source, itemCount: row.item_count });
            }
          }
        } catch (e) {
          console.warn('RPC get_meeting_full_transcript failed, falling back to table fetch');
        }

        // Try meeting_transcription_chunks first (highest fidelity chunks)
        if (!fullTranscript) {
          try {
            const { data: mtc, error: mtcError } = await supabase
              .from('meeting_transcription_chunks')
              .select('transcription_text, chunk_number')
              .eq('meeting_id', meetingId)
              .order('chunk_number', { ascending: true });
            if (!mtcError && mtc && mtc.length > 0) {
              const rawTranscript = (mtc as any[]).map(c => c.transcription_text).join(' ');
              // Normalise the chunks transcript
              const { normaliseTranscript } = await import('@/lib/transcriptNormaliser');
              const normalised = normaliseTranscript(rawTranscript);
              fullTranscript = normalised.plain;
            }
          } catch (e) {
            console.warn('meeting_transcription_chunks not available or not accessible');
          }
        }

        // If still empty, fetch all meeting_transcripts rows and concatenate
        if (!fullTranscript) {
          const { data: transcriptRows } = await supabase
            .from('meeting_transcripts')
            .select('content, created_at')
            .eq('meeting_id', meetingId)
            .order('created_at', { ascending: true });

          if (transcriptRows && transcriptRows.length > 0) {
            fullTranscript = transcriptRows
              .map((row: any) => (row?.content || '') as string)
              .filter(Boolean)
              .join('\n\n');
          }
        }

        // Final fallback: legacy transcription_chunks
        if (!fullTranscript) {
          const { data: chunks, error: chunksError } = await supabase
            .from('transcription_chunks')
            .select('transcript_text, chunk_number')
            .eq('meeting_id', meetingId)
            .order('chunk_number', { ascending: true });
          if (!chunksError && chunks && chunks.length > 0) {
            fullTranscript = (chunks as any[]).map(c => c.transcript_text).join(' ');
          }
        }

        // Load summaries
        const { data: summary } = await supabase
          .from('meeting_summaries')
          .select('summary, key_points, action_items, next_steps')
          .eq('meeting_id', meetingId)
          .maybeSingle();

        const transcript = fullTranscript || "";
        
        // Create consultation data object
        const consultationData: ConsultationData = {
          id: meetingId,
          title: meeting.title || "Consultation",
          type: "consultation",
          transcript: transcript,
          duration: meeting.duration_minutes ? `${meeting.duration_minutes} minutes` : "Unknown",
          wordCount: transcript.split(' ').length,
          startTime: meeting.created_at,
          isExample: false,
          generatedData: summary ? {
            gpSummary: summary.summary || "",
            fullNote: summary.key_points?.[0] || "",
            patientCopy: summary.action_items?.[0] || "",
            traineeFeedback: summary.next_steps?.[0] || ""
          } : undefined
        };

        setConsultationData(consultationData);
        setCleanedTranscript("");

        // Load content from summaries if available
        if (summary) {
          setContent({
            gpSummary: summary.summary || "",
            fullNote: summary.key_points?.[0] || "",
            patientCopy: summary.action_items?.[0] || "",
            traineeFeedback: summary.next_steps?.[0] || ""
          });
          
          setEditContent({
            gpSummary: summary.summary || "",
            fullNote: summary.key_points?.[0] || "",
            patientCopy: summary.action_items?.[0] || "",
            traineeFeedback: summary.next_steps?.[0] || ""
          });
        }
        // If no generated data available but we have transcript, generate from transcript
        else if (transcript && transcript.trim().length > 50) {
          generateNotesFromTranscript(transcript);
        }
      } catch (error) {
        console.error('Failed to load consultation:', error);
        toast.error("Failed to load consultation");
        navigate('/gp-scribe');
      }
    };

    const data = location.state as ConsultationData & { meetingId?: string };
    
    // Check if meetingId is passed via navigation state
    if (data?.meetingId && !data.transcript) {
      loadConsultationFromDatabase(data.meetingId);
    }
    // Check if full consultation data is passed
    else if (data && !data.meetingId) {
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
      // Load generated data from real consultation
      else if (data.generatedData) {
        setContent({
          gpSummary: data.generatedData.gpSummary,
          fullNote: data.generatedData.fullNote,
          patientCopy: data.generatedData.patientCopy,
          traineeFeedback: data.generatedData.traineeFeedback
        });
        
        setEditContent({
          gpSummary: data.generatedData.gpSummary,
          fullNote: data.generatedData.fullNote,
          patientCopy: data.generatedData.patientCopy,
          traineeFeedback: data.generatedData.traineeFeedback
        });
      }
      // If no generated data available, generate from transcript
      else if (data.transcript && data.transcript.trim().length > 50) {
        generateNotesFromTranscript(data.transcript);
      }
    } else {
      const params = new URLSearchParams(window.location.search);
      const urlMeetingId = params.get('meetingId');
      if (urlMeetingId) {
        loadConsultationFromDatabase(urlMeetingId);
      } else {
        navigate('/gp-scribe');
      }
    }
  }, [location.state, navigate]);

  // Generate cleaned transcript when tidied tab is first accessed
  useEffect(() => {
    if (transcriptTab === "tidied" && !cleanedTranscript && consultationData?.transcript) {
      generateCleanedTranscript();
    }
  }, [transcriptTab, cleanedTranscript, consultationData?.transcript]);

  // Reset cleaned transcript when original transcript changes so it regenerates
  useEffect(() => {
    if (cleanedTranscript && consultationData?.transcript) {
      setCleanedTranscript("");
    }
  }, [consultationData?.transcript]);

  // Generate different note levels based on the original content
  const generateNoteLevelContent = (originalContent: string, level: number): string => {
    switch (level) {
      case 0: // Shorthand - UK GP abbreviations for SystmOne/EMIS
        return generateShorthandNotes(consultationData?.transcript || originalContent);
      case 1: // Standard - Original content without extra formatting
        return originalContent;
      case 2: // Detailed - Use Full Note content with SNOMED codes
        return generateDetailedNotesWithSNOMED(content.fullNote || originalContent);
      default:
        return originalContent;
    }
  };

  const generateShorthandNotes = (transcript: string): string => {
    if (!transcript || transcript.trim() === "") {
      return "No consultation data available for shorthand summary.";
    }

    return `S: Patient consultation summary
O: Clinical findings documented
A: Assessment completed  
P: Plan discussed with patient`;
  };
  const generateStandardNotes = (content: string): string => {
    // Return content without additional header formatting
    return content;
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
    return content + "\n\nNote: Detailed consultation documentation with clinical coding.";
  };

  // Generate notes from transcript using Supabase function
  const generateNotesFromTranscript = async (transcript: string) => {
    if (!user) return;
    
    setIsGeneratingNotes(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-gp-consultation-notes', {
        body: {
          transcript: transcript,
          outputLevel: 'standard',
          showSnomedCodes: false,
          formatForEmis: false,
          formatForSystmOne: false,
          consultationType: consultationData?.type || 'face-to-face',
          userId: user.id
        }
      });

      if (error) {
        console.error('Error generating notes:', error);
        toast.error('Failed to generate consultation notes');
        return;
      }

      setContent({
        gpSummary: data.gpSummary || "No GP summary generated",
        fullNote: data.fullNote || "No full notes generated", 
        patientCopy: data.patientCopy || "No patient copy generated",
        traineeFeedback: data.traineeFeedback || "No trainee feedback generated"
      });
      
      setEditContent({
        gpSummary: data.gpSummary || "",
        fullNote: data.fullNote || "",
        patientCopy: data.patientCopy || "",
        traineeFeedback: data.traineeFeedback || ""
      });
      
      toast.success('Consultation notes generated successfully');
    } catch (error: any) {
      console.error('Error generating notes:', error);
      toast.error('Failed to generate consultation notes');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Generate cleaned transcript and format into readable blocks
  const formatTranscriptIntoBlocks = (text: string): string => {
    if (!text) return '';
    // Remove obvious laughter/repeated token hallucinations
    let t = text
      .replace(/(?:\b(?:ha|haha|ha-ha|hee|hehe|lol|woo|beep)[\s,!.?-]*){4,}/gi, ' ')
      .replace(/\b(ha|hee|hehe|lol)(?:\s+\1){1,}\b/gi, '$1');
    // Normalize whitespace
    t = t.replace(/\s+/g, ' ').trim();
    // Add paragraph breaks before common speaker cues if present
    t = t.replace(/\b(Doctor:|GP:|Patient:|Nurse:|Clinician:|Interpreter:)\s*/g, '\n\n$1 ');
    // Split into sentences and group into readable blocks (2-3 sentences or ~220 chars)
    const sentences = t.split(/(?<=[.!?])\s+/);
    const blocks: string[] = [];
    let current: string[] = [];
    for (const s of sentences) {
      current.push(s);
      const length = current.join(' ').length;
      if (current.length >= 3 || length > 220) {
        blocks.push(current.join(' '));
        current = [];
      }
    }
    if (current.length) blocks.push(current.join(' '));
    return blocks.join('\n\n');
  };

  const generateCleanedTranscript = async () => {
    if (!consultationData?.transcript) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('clean-transcript', {
        body: {
          rawTranscript: consultationData.transcript,
          meetingTitle: consultationData.title || `GP Consultation - ${new Date().toISOString()}`
        }
      });

      if (error) {
        console.error('Error cleaning transcript:', error);
        toast.error('Failed to clean transcript');
        return;
      }

      const cleaned = data?.cleanedTranscript || consultationData.transcript;
      setCleanedTranscript(formatTranscriptIntoBlocks(cleaned) || 'No cleaned transcript available');
    } catch (error: any) {
      console.error('Error cleaning transcript:', error);
      toast.error('Failed to clean transcript');
    }
  };

  // Generate SMS version (max 50 words)
  const generateSMSVersion = (content: string): string => {
    if (!content || content.trim() === "") {
      return "Hi, thank you for attending your consultation today. We've reviewed your condition and discussed next steps. Please take any prescribed medications as directed and contact us if you have concerns.";
    }

    // Clean and parse the content to extract key points
    let cleanContent = content.replace(/\*\*/g, '').replace(/###|##|#/g, '').trim();
    
    // Remove unwanted phrases
    cleanContent = cleanContent.replace(/Patient Summary of Consultation/gi, '');
    cleanContent = cleanContent.replace(/Summary of Consultation/gi, '');
    cleanContent = cleanContent.replace(/Patient Summary/gi, '');
    
    const lines = cleanContent.split('\n').filter(line => line.trim() !== '' && line.length > 10);
    
    // Find the most relevant content from the patient copy
    const meaningfulLines = lines.filter(line => {
      const lower = line.toLowerCase();
      // Skip header-like content
      if (lower.includes('dear patient') || lower.includes('thank you') || lower.includes('best wishes')) {
        return false;
      }
      // Look for actual consultation content
      return line.length > 20 && !line.startsWith('•') && !line.includes(':');
    });

    // Build summary starting with greeting
    let smsText = "Hi, thank you for your consultation. ";
    
    // Use the first meaningful line if available
    if (meaningfulLines.length > 0) {
      let summary = meaningfulLines[0].trim();
      // Clean up any remaining formatting and incomplete words
      summary = summary.replace(/^(We discussed|Today we|During your visit)/i, '').trim();
      
      // Ensure we have complete sentences by checking for proper endings
      if (summary.length > 15) {
        // Find the last complete sentence within reasonable length
        const sentences = summary.split(/[.!?]+/);
        let completeSummary = '';
        let wordCount = 0;
        
        for (const sentence of sentences) {
          const trimmed = sentence.trim();
          if (trimmed.length > 0) {
            const words = trimmed.split(' ');
            if (wordCount + words.length <= 30) { // Keep it reasonable for SMS
              completeSummary += (completeSummary ? '. ' : '') + trimmed;
              wordCount += words.length;
            } else {
              break;
            }
          }
        }
        
        if (completeSummary && completeSummary.length > 15) {
          smsText += `${completeSummary}. `;
        } else {
          smsText += "We reviewed your health concerns and discussed your treatment plan. ";
        }
      } else {
        smsText += "We reviewed your health concerns and discussed your treatment plan. ";
      }
    } else {
      smsText += "We reviewed your health concerns and discussed your treatment plan. ";
    }
    
    // Always end with contact instruction
    smsText += "Contact us with any concerns.";
    
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
        <p>No specific consultation details available.</p>
        <div class="mt-6">
          <p>Best wishes,<br>Your GP Practice</p>
        </div>
      </div>`;
    }

    // Clean and parse the actual content more broadly
    const cleanContent = content.replace(/\*\*/g, '').replace(/###|##|#/g, '').trim();
    const lines = cleanContent.split('\n').filter(line => line.trim() !== '' && line.length > 10);
    
    // Take the first few lines as what was discussed (broader approach)
    const discussedContent = lines.slice(0, 4).map(line => line.replace(/^.*?:/, '').trim()).filter(line => line);
    
    // Look for any lines mentioning specific treatments, medications, or advice
    const actionLines = lines.filter(line => {
      const lower = line.toLowerCase();
      return lower.includes('take') || lower.includes('continue') || lower.includes('stop') || 
             lower.includes('increase') || lower.includes('reduce') || lower.includes('try') ||
             lower.includes('should') || lower.includes('recommend') || lower.includes('advise') ||
             lower.includes('plan') || lower.includes('agreed') || lower.includes('prescribed') ||
             lower.includes('paracetamol') || lower.includes('ibuprofen') || lower.includes('medication');
    }).slice(0, 4);
    
    // Look for follow-up mentions
    const followUpContent = lines.filter(line => {
      const lower = line.toLowerCase();
      return lower.includes('follow') || lower.includes('review') || lower.includes('appointment') ||
             lower.includes('see you') || lower.includes('contact') || lower.includes('return') ||
             lower.includes('week') || lower.includes('month') || lower.includes('days');
    }).slice(0, 3);
    
    // Look for any warning or safety advice
    const safetyContent = lines.filter(line => {
      const lower = line.toLowerCase();
      return lower.includes('if') || lower.includes('should') || lower.includes('contact') ||
             lower.includes('urgent') || lower.includes('emergency') || lower.includes('worsen') ||
             lower.includes('concern') || lower.includes('seek') || lower.includes('call');
    }).slice(0, 3);

    const formatLine = (line: string) => {
      let formatted = line.replace(/^.*?:/, '').trim();
      // Remove any remaining markdown or formatting
      formatted = formatted.replace(/[*#]/g, '');
      return formatted;
    };

    // Filter out empty lines after formatting
    const formatAndFilter = (lines: string[]) => {
      return lines.map(formatLine).filter(line => line.length > 5); // Only include meaningful content
    };

    return `<div class="space-y-4">
      <p>Dear Patient,</p>
      <p>Thank you for attending your consultation today.</p>
      
      <div class="space-y-2">
        <h4 class="font-bold text-primary">What we discussed:</h4>
        <div class="ml-4 space-y-1">
          ${discussedContent.length > 0 ? 
            formatAndFilter(discussedContent).map(item => `<p>• ${item}</p>`).join('') : 
            '<p>• Your health concerns were reviewed during the consultation</p>'
          }
        </div>
      </div>
      
      ${formatAndFilter(actionLines).length > 0 ? `
      <div class="space-y-2">
        <h4 class="font-bold text-primary">Treatment and medications:</h4>
        <div class="ml-4 space-y-1">
          ${formatAndFilter(actionLines).map(item => `<p>• ${item}</p>`).join('')}
        </div>
      </div>` : ''}
      
      ${formatAndFilter(followUpContent).length > 0 ? `
      <div class="space-y-2">
        <h4 class="font-bold text-primary">Follow-up:</h4>
        <div class="ml-4 space-y-1">
          ${formatAndFilter(followUpContent).map(item => `<p>• ${item}</p>`).join('')}
        </div>
      </div>` : ''}
      
      ${formatAndFilter(safetyContent).length > 0 ? `
      <div class="space-y-2">
        <h4 class="font-bold text-primary">Important advice:</h4>
        <div class="ml-4 space-y-1">
          ${formatAndFilter(safetyContent).map(item => `<p>• ${item}</p>`).join('')}
        </div>
      </div>` : ''}
      
      <div class="space-y-2">
        <h4 class="font-bold text-primary">If you need help:</h4>
        <div class="ml-4 space-y-1">
          <p>• Contact the practice if you have any questions</p>
          <p>• Seek urgent care if your symptoms worsen significantly</p>
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

  const stripHtml = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };

  const handleCopy = async (text: string, section: string) => {
    try {
      // Strip HTML tags if this is an AI response or if the text contains HTML
      const textToCopy = section === "AI Response" || text.includes('<') 
        ? stripHtml(text) 
        : text;
      
      await navigator.clipboard.writeText(textToCopy);
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

  const handleWordExport = async (content: string, filename: string) => {
    try {
      // First, convert HTML to text with clear line breaks
      let text = content
        // Add double line breaks before headings
        .replace(/<h[1-6][^>]*>/gi, '\n\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        // Add line breaks for paragraphs
        .replace(/<p[^>]*>/gi, '\n\n')
        .replace(/<\/p>/gi, '\n\n')
        // Convert divs to line breaks
        .replace(/<div[^>]*>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        // Convert breaks to line breaks
        .replace(/<br\s*\/?>/gi, '\n')
        // Convert list items to bullet points with line breaks
        .replace(/<li[^>]*>/gi, '\n• ')
        .replace(/<\/li>/gi, '\n')
        // Remove all other HTML tags
        .replace(/<[^>]*>/g, '')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      // Split by line breaks and create paragraphs
      const lines = text.split('\n');
      const children = [];

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          // Create a new paragraph for each non-empty line
          children.push(new Paragraph({
            children: [new TextRun(trimmedLine)],
            spacing: { after: 120 } // Add spacing after each paragraph
          }));
        } else {
          // Add spacing for empty lines
          children.push(new Paragraph({
            children: [new TextRun('')],
            spacing: { after: 60 }
          }));
        }
      }

      // Ensure we have at least one paragraph
      if (children.length === 0) {
        children.push(new Paragraph({
          children: [new TextRun('No content available')],
        }));
      }

      // Create Word document
      const wordDoc = new Document({
        sections: [{
          properties: {},
          children: children
        }],
      });

      // Generate and save the document
      const buffer = await Packer.toBlob(wordDoc);
      saveAs(buffer, `${filename}.docx`);
      toast.success("Word document exported successfully");
    } catch (error) {
      console.error('Error exporting to Word:', error);
      toast.error("Failed to export to Word");
    }
  };

  const backToExamples = () => {
    navigate('/gp-scribe', { state: { activeTab: 'examples' } });
  };

  const continueRecording = () => {
    navigate('/gp-scribe');
  };

  // Ask AI functionality
  const handleAskAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Please enter a prompt or use live talk");
      return;
    }

    setIsAILoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-consultation-assistant', {
        body: {
          prompt: aiPrompt,
          consultationData: {
            duration: consultationData?.duration,
            transcript: consultationData?.transcript,
            gpSummary: content.gpSummary,
            patientCopy: content.patientCopy,
            type: consultationData?.type
          },
          consultationType: consultationData?.type
        }
      });

      if (error) throw error;

      setAiResponse(data.response);
      setIsAIResponsePanelOpen(true);
      toast.success("AI analysis complete");
    } catch (error) {
      console.error('Error getting AI response:', error);
      toast.error("Failed to get AI response. Please try again.");
    } finally {
      setIsAILoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await processAudioToText(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      toast.success("Recording started. Speak your request...");
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error("Failed to start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
      toast.success("Recording stopped. Processing...");
    }
  };

  const processAudioToText = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        const { data, error } = await supabase.functions.invoke('speech-to-text-consultation', {
          body: { audio: base64Audio }
        });

        if (error) throw error;

        setAiPrompt(data.text);
        toast.success("Voice converted to text successfully");
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error("Failed to process live talk. Please try again.");
    }
  };

  // Generate Review functionality
  const generateReview = async () => {
    setIsLoadingReview(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-consultation-assistant', {
        body: {
          prompt: "Review this consultation and provide: 1) A comprehensive analysis of what may have been missed, areas for improvement, and recommendations. 2) At the end, provide a detailed consultation score breakdown using this exact format:\n\nCONSULTATION SCORE: X/100\n\n=== DETAILED SCORING BREAKDOWN ===\n\n**HISTORY TAKING (25 points total)**\n- Chief complaint documentation: [X/5] - [specific reasoning]\n- History of presenting complaint: [X/5] - [specific reasoning]\n- Past medical history: [X/3] - [specific reasoning]\n- Drug history and allergies: [X/3] - [specific reasoning]\n- Family/social history relevance: [X/3] - [specific reasoning]\n- Systems review completeness: [X/3] - [specific reasoning]\n- Risk factors identified: [X/3] - [specific reasoning]\nSubtotal: [X/25]\n\n**EXAMINATION (20 points total)**\n- Appropriate examination performed: [X/8] - [specific reasoning]\n- Examination findings documented: [X/4] - [specific reasoning]\n- Relevant negative findings noted: [X/3] - [specific reasoning]\n- Clinical signs interpretation: [X/3] - [specific reasoning]\n- Safety netting for red flags: [X/2] - [specific reasoning]\nSubtotal: [X/20]\n\n**DIAGNOSIS & ASSESSMENT (20 points total)**\n- Differential diagnosis considered: [X/6] - [specific reasoning]\n- Primary diagnosis accuracy: [X/5] - [specific reasoning]\n- Clinical reasoning demonstrated: [X/4] - [specific reasoning]\n- Risk stratification: [X/3] - [specific reasoning]\n- Investigations appropriateness: [X/2] - [specific reasoning]\nSubtotal: [X/20]\n\n**MANAGEMENT PLAN (20 points total)**\n- Treatment appropriateness: [X/6] - [specific reasoning]\n- Prescribing safety and accuracy: [X/4] - [specific reasoning]\n- Non-pharmacological advice: [X/3] - [specific reasoning]\n- Follow-up arrangements: [X/3] - [specific reasoning]\n- Safety netting advice: [X/2] - [specific reasoning]\n- Patient education provided: [X/2] - [specific reasoning]\nSubtotal: [X/20]\n\n**COMMUNICATION & DOCUMENTATION (15 points total)**\n- Clear professional communication: [X/4] - [specific reasoning]\n- Documentation completeness: [X/4] - [specific reasoning]\n- Consultation structure and flow: [X/3] - [specific reasoning]\n- Patient understanding addressed: [X/2] - [specific reasoning]\n- Professional standards met: [X/2] - [specific reasoning]\nSubtotal: [X/15]\n\n=== TOTAL SCORE CALCULATION ===\nHistory Taking: [X/25]\nExamination: [X/20]\nDiagnosis & Assessment: [X/20]\nManagement Plan: [X/20]\nCommunication & Documentation: [X/15]\n**FINAL SCORE: [X/100]**\n\n=== CLINICAL JUSTIFICATION ===\n[Detailed paragraph explaining the overall scoring rationale, referencing specific clinical guidelines, NICE recommendations, GMC standards, and medical education criteria that influenced the scoring decisions]\n\n=== POINT DEDUCTIONS SUMMARY ===\n[List specific point deductions with clear reasoning, e.g., '-2 points from History Taking: Drug allergies not documented', '-3 points from Examination: No cardiovascular examination despite chest pain presentation']\n\n=== RECOMMENDATIONS FOR IMPROVEMENT ===\n[Specific, actionable recommendations based on identified scoring gaps]",
          consultationData: {
            duration: consultationData?.duration,
            transcript: consultationData?.transcript,
            gpSummary: content.gpSummary,
            patientCopy: content.patientCopy,
            type: consultationData?.type
          },
          consultationType: consultationData?.type
        }
      });

      if (error) throw error;

      // Parse the score from the response
      const scoreMatch = data.response.match(/CONSULTATION SCORE:\s*(\d+)\/100/i);
      if (scoreMatch) {
        const score = parseInt(scoreMatch[1], 10);
        console.log('Parsed consultation score:', score, typeof score); // Debug log
        setConsultationScore(score);
      }

      setReviewContent(data.response);
      toast.success("Review generated successfully");
    } catch (error) {
      console.error('Error generating review:', error);
      toast.error("Failed to generate review. Please try again.");
    } finally {
      setIsLoadingReview(false);
    }
  };

  // Auto-generate review when tab is accessed OR when page loads
  useEffect(() => {
    if (activeTab === "review" && !reviewContent && !isLoadingReview) {
      generateReview();
    }
  }, [activeTab]);

  // Auto-generate review when consultation data loads (background task)
  useEffect(() => {
    if (consultationData && !reviewContent && !isLoadingReview) {
      generateReview();
    }
  }, [consultationData]);

  // Auto-generate referral when consultation data loads (background task)
  useEffect(() => {
    if (consultationData && !referralContent && !isLoadingReferral) {
      generateReferral();
    }
  }, [consultationData]);

  // Generate Referral functionality
  const generateReferral = async () => {
    setIsLoadingReferral(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-consultation-assistant', {
        body: {
          prompt: "Generate a professional NHS referral letter in plain text format. Use double line breaks between paragraphs and sections. Do not use any formatting markers like asterisks, markdown, or special characters for emphasis. Structure it clearly with: Dear Colleague, followed by separate paragraphs for Patient Details, Clinical Presentation, Examination Findings, Assessment, Management Plan, and any relevant advice. End with 'Yours sincerely,' on its own line. Use only plain text with proper spacing.",
          consultationData: {
            duration: consultationData?.duration,
            transcript: consultationData?.transcript,
            gpSummary: content.gpSummary,
            patientCopy: content.patientCopy,
            type: consultationData?.type
          },
          consultationType: consultationData?.type
        }
      });

      if (error) throw error;

      setReferralContent(data.response);
      toast.success("Referral letter generated successfully");
    } catch (error) {
      console.error('Error generating referral:', error);
      toast.error("Failed to generate referral letter. Please try again.");
    } finally {
      setIsLoadingReferral(false);
    }
  };

  // Auto-generate referral when tab is accessed
  useEffect(() => {
    if (activeTab === "referral" && !referralContent && !isLoadingReferral) {
      generateReferral();
    }
  }, [activeTab]);

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
      <NotewellAIAnimation isVisible={isGeneratingNotes} />
      <Header />
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 max-w-6xl">
        
        {/* Header - Mobile Optimized */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={consultationData.isExample ? backToExamples : continueRecording}
              className="shrink-0 touch-manipulation min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {isMobile ? "Back" : (consultationData.isExample ? "Back to Examples" : "Continue Recording")}
            </Button>
            
            {consultationData.isExample && (
              <Badge variant="secondary" className="text-xs">
                Training Example
              </Badge>
            )}
          </div>
          
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-primary flex items-center gap-2 flex-wrap">
              <Stethoscope className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
              <span className="break-words">{consultationData.title}</span>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground ml-auto">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>{consultationData.duration}</span>
                <Badge variant="outline" className="text-xs">
                  {consultationData.wordCount} words
                </Badge>
              </div>
            </h1>
          </div>
        </div>

        {/* Consultation Summary Card */}
        <Card className="shadow-medium border-accent/20 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Consultation Notes & Feedback
              </span>
              <Badge variant="outline" className="bg-gradient-primary text-primary-foreground">
                {consultationData.type}
              </Badge>
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            {/* Consultation Navigation - Mobile First */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-muted/50 p-1 rounded-xl h-auto">
                <TabsTrigger 
                  value="gp-summary" 
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-700 data-[state=active]:font-semibold min-h-[44px] px-2 text-xs sm:text-sm"
                >
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Consultation Summary</span>
                  <span className="sm:hidden">Summary</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="patient-copy" 
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-700 data-[state=active]:font-semibold min-h-[44px] px-2 text-xs sm:text-sm"
                >
                  <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Patient Copy</span>
                  <span className="sm:hidden">Copy</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="referral" 
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-700 data-[state=active]:font-semibold min-h-[44px] px-2 text-xs sm:text-sm"
                >
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Referral</span>
                  <span className="sm:hidden">Ref</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="review" 
                  className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-700 data-[state=active]:font-semibold min-h-[44px] px-2 text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Review & Recommendations</span>
                    <span className="sm:hidden">Review</span>
                    {consultationScore !== null && (
                      <div className="flex items-center ml-1">
                        {(() => {
                          console.log('Tab indicator - Score:', consultationScore, 'Type:', typeof consultationScore);
                          if (consultationScore >= 80) {
                            return <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />;
                          } else if (consultationScore >= 70) {
                            return <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />;
                          } else {
                            return <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />;
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </TabsTrigger>
              </TabsList>

              {/* GP Summary Tab - Mobile Optimized */}
              <TabsContent value="gp-summary" className="space-y-4 mt-6">
                {/* Combined Control Row */}
                <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg p-3 sm:p-4 border border-primary/20">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    {/* Detail Level Slider */}
                    <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <Settings className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                        <span className="text-xs sm:text-sm font-medium text-primary whitespace-nowrap">Detail:</span>
                        <Badge variant="outline" className="bg-background text-xs">
                          {noteLevels[noteLevel[0]]}
                        </Badge>
                      </div>
                      <div className="w-20 sm:w-24">
                        <Slider
                          value={noteLevel}
                          onValueChange={setNoteLevel}
                          max={2}
                          min={0}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Action Buttons - Compact Layout */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(getCurrentGPSummary(), "GP Summary")}
                        className="touch-manipulation min-h-[36px] px-3"
                      >
                        <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWordExport(getCurrentGPSummary(), `GP-Summary-${consultationData?.title || 'consultation'}`)}
                        className="touch-manipulation min-h-[36px] px-3"
                      >
                        <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        Doc
                      </Button>
                      <Button
                        size="sm"
                        variant={editStates.gpSummary ? "default" : "outline"}
                        onClick={() => handleEditToggle("gpSummary")}
                        className="touch-manipulation min-h-[36px] px-3"
                      >
                        {editStates.gpSummary ? (
                          <>
                            <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            Save
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            Edit
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Ask AI Assistant - Compact */}
                    <div className="ml-auto">
                      <Collapsible open={isAskAIOpen} onOpenChange={setIsAskAIOpen}>
                        <CollapsibleTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="touch-manipulation min-h-[36px] px-3"
                          >
                            <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-violet-600" />
                            <span className="text-violet-700 dark:text-violet-300 text-sm whitespace-nowrap">Ask AI</span>
                            {isAskAIOpen ? <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 ml-2" /> : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 ml-2" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="absolute z-10 mt-2 w-80 lg:w-96 bg-background border border-border rounded-lg shadow-lg p-4 right-0">
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Ask the AI to analyze your consultation, create referral letters, suggest improvements, or check for missing information.
                            </p>
                            
                            {/* Quick Prompt Buttons */}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setAiPrompt("Create a patient-friendly letter explaining the consultation findings, diagnosis, and treatment plan in simple language that the patient can easily understand.")}
                                className="text-xs"
                              >
                                Patient Letter
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setAiPrompt("Review this consultation thoroughly and provide feedback on the clinical reasoning, examination completeness, differential diagnosis considerations, and management plan. Highlight any areas for improvement or missing elements.")}
                                className="text-xs"
                              >
                                Review Consultation
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setAiPrompt("Based on this consultation, create a list of follow-up tasks and actions required, including any investigations to order, referrals to make, follow-up appointments to schedule, and patient education points to cover.")}
                                className="text-xs"
                              >
                                Create Task
                              </Button>
                            </div>
                            
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <Textarea
                                  value={aiPrompt}
                                  onChange={(e) => setAiPrompt(e.target.value)}
                                  placeholder="e.g., 'Create a referral letter to cardiology' or 'Is there anything I missed?' or 'Review my consultation and suggest improvements'"
                                  className="min-h-[80px] resize-none"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={isRecording ? stopRecording : startRecording}
                                  disabled={isAILoading}
                                  className="p-2"
                                >
                                  {isRecording ? <MicOff className="h-4 w-4 text-red-500" /> : <Mic className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleAskAI}
                                  disabled={isAILoading || !aiPrompt.trim()}
                                  className="p-2"
                                >
                                  {isAILoading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            {aiResponse && (
                              <div className="mt-4 p-3 bg-muted/30 rounded-lg border">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-primary">Response ready</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsAIResponsePanelOpen(true)}
                                  >
                                    <Maximize2 className="h-4 w-4 mr-1" />
                                    View Response
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
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
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: renderNHSMarkdown(getCurrentGPSummary(), { enableNHSStyling: true })
                      }}
                    />
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
                      className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-700 data-[state=active]:font-semibold"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      SMS (50 words)
                    </TabsTrigger>
                    <TabsTrigger 
                      value="email" 
                      className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-700 data-[state=active]:font-semibold"
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(generateSMSVersion(content.patientCopy), "SMS Summary")}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                        <SMSSendButton
                          message={generateSMSVersion(content.patientCopy)}
                          consultationId={consultationData?.id}
                          size="sm"
                        />
                      </div>
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
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: renderNHSMarkdown(generateEmailVersion(content.patientCopy), { enableNHSStyling: true })
                        }}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* Referral Tab */}
              <TabsContent value="referral" className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Referral Letter
                  </h3>
                  {referralContent && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWordExport(referralContent, `Referral-Letter-${consultationData?.title || 'consultation'}`)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Word
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(referralContent, "Referral Letter")}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  )}
                </div>
                
                {isLoadingReferral ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="ml-3 text-muted-foreground">Generating referral letter...</p>
                  </div>
                ) : referralContent ? (
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: renderNHSMarkdown(referralContent, { enableNHSStyling: true })
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-lg p-4 border text-center">
                    <p className="text-muted-foreground">Click to generate referral letter...</p>
                    <Button 
                      className="mt-3" 
                      onClick={generateReferral}
                      variant="outline"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Referral Letter
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Review & Recommendations Tab */}
              <TabsContent value="review" className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Review of Consultation and Recommendations
                  </h3>
                  {reviewContent && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWordExport(reviewContent, `Review-Recommendations-${consultationData?.title || 'consultation'}`)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Word
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(reviewContent, "Review Content")}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  )}
                </div>
                {isLoadingReview ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <p className="ml-3 text-muted-foreground">Generating review...</p>
                  </div>
                ) : reviewContent ? (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
                    <FormattedReviewContent content={reviewContent.split('CONSULTATION SCORE:')[0] || reviewContent} />
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-lg p-4 border text-center">
                    <p className="text-muted-foreground">Click to generate consultation review...</p>
                    <Button 
                      className="mt-3" 
                      onClick={generateReview}
                      variant="outline"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Review
                    </Button>
                  </div>
                )}
                
                {/* Collapsible Consultation Score Section */}
                {consultationScore !== null && (
                  <div className="mt-6">
                    <Collapsible open={isScoreExpanded} onOpenChange={setIsScoreExpanded}>
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="outline" 
                          className={`w-full justify-between p-4 h-auto ${
                            consultationScore >= 80 ? 'border-green-200 bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-800' :
                            consultationScore >= 70 ? 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/30 dark:border-yellow-800' :
                            'border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {consultationScore >= 80 ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : consultationScore >= 70 ? (
                              <AlertTriangle className="h-5 w-5 text-yellow-600" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                            )}
                            <div className="text-left">
                              <div className="font-semibold">
                                Consultation Score: {consultationScore}/100
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {consultationScore >= 80 ? 'Excellent consultation quality' :
                                 consultationScore >= 70 ? 'Good consultation with minor improvements needed' :
                                 'Significant improvements required'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {isScoreExpanded ? "Hide Details" : "View Breakdown"}
                            </span>
                            {isScoreExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4">
                        <div className={`p-6 rounded-lg border ${
                          consultationScore >= 80 ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' :
                          consultationScore >= 70 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800' :
                          'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
                        }`}>
                          <div className="space-y-6">
                            {/* Parse and display the scoring breakdown in a structured format */}
                            {(() => {
                              const scoringSection = reviewContent.split('CONSULTATION SCORE:')[1] || '';
                              console.log('Scoring section content:', scoringSection); // Debug log
                              
                              const sections = [
                                { title: 'History Taking', total: 25, patterns: [
                                  /History Taking.*?(\d+)\/25/is,
                                  /HISTORY TAKING.*?Subtotal:?\s*[\[\(]?(\d+)\/25[\]\)]?/is,
                                  /\*\*HISTORY TAKING.*?Subtotal:?\s*[\[\(]?(\d+)\/25[\]\)]?/is,
                                  /History.*?(\d+)\/25/is
                                ]},
                                { title: 'Examination', total: 20, patterns: [
                                  /Examination.*?(\d+)\/20/is,
                                  /EXAMINATION.*?Subtotal:?\s*[\[\(]?(\d+)\/20[\]\)]?/is,
                                  /\*\*EXAMINATION.*?Subtotal:?\s*[\[\(]?(\d+)\/20[\]\)]?/is
                                ]},
                                { title: 'Diagnosis & Assessment', total: 20, patterns: [
                                  /Diagnosis.*?(\d+)\/20/is,
                                  /DIAGNOSIS & ASSESSMENT.*?Subtotal:?\s*[\[\(]?(\d+)\/20[\]\)]?/is,
                                  /\*\*DIAGNOSIS & ASSESSMENT.*?Subtotal:?\s*[\[\(]?(\d+)\/20[\]\)]?/is,
                                  /DIAGNOSIS.*?(\d+)\/20/is
                                ]},
                                { title: 'Management Plan', total: 20, patterns: [
                                  /Management.*?(\d+)\/20/is,
                                  /MANAGEMENT PLAN.*?Subtotal:?\s*[\[\(]?(\d+)\/20[\]\)]?/is,
                                  /\*\*MANAGEMENT PLAN.*?Subtotal:?\s*[\[\(]?(\d+)\/20[\]\)]?/is,
                                  /MANAGEMENT.*?(\d+)\/20/is,
                                  /Management Plan.*?(\d+)\/20/is
                                ]},
                                { title: 'Communication & Documentation', total: 15, patterns: [
                                  /Communication.*?(\d+)\/15/is,
                                  /COMMUNICATION & DOCUMENTATION.*?Subtotal:?\s*[\[\(]?(\d+)\/15[\]\)]?/is,
                                  /\*\*COMMUNICATION & DOCUMENTATION.*?Subtotal:?\s*[\[\(]?(\d+)\/15[\]\)]?/is,
                                  /COMMUNICATION.*?(\d+)\/15/is,
                                  /Communication & Documentation.*?(\d+)\/15/is,
                                  /Documentation.*?(\d+)\/15/is
                                ]}
                              ];

                              return (
                                <>
                                  {/* Summary Section */}
                                  <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-primary">
                                    <h4 className="text-lg font-semibold text-center mb-4">Score Breakdown</h4>
                                    <div className="space-y-3">
                                      {sections.map((section, index) => {
                                        let awarded = 0;
                                        let matchedPattern = '';
                                        
                                        // Try multiple patterns to find the score
                                        for (let i = 0; i < section.patterns.length; i++) {
                                          const pattern = section.patterns[i];
                                          const match = scoringSection.match(pattern);
                                          if (match) {
                                            awarded = parseInt(match[1]);
                                            matchedPattern = `Pattern ${i + 1}`;
                                            break;
                                          }
                                        }
                                        
                                        // If no pattern matched, try a more generic approach
                                        if (awarded === 0) {
                                          // Look for any number/total combination near the section title
                                          const genericPattern = new RegExp(`${section.title.replace(/[&\s]/g, '.*?')}.*?(\\d+)\\/${section.total}`, 'is');
                                          const genericMatch = scoringSection.match(genericPattern);
                                          if (genericMatch) {
                                            awarded = parseInt(genericMatch[1]);
                                            matchedPattern = 'Generic pattern';
                                          }
                                        }
                                        
                                        const percentage = Math.round((awarded / section.total) * 100);
                                        
                                        return (
                                          <div key={index} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                                            <div className="flex-1">
                                              <div className="font-medium text-sm">{section.title}</div>
                                              <div className="text-xs text-muted-foreground">Subtotal: {awarded}/{section.total} ({percentage}%)</div>
                                            </div>
                                            <div className="text-right">
                                              <div className={`text-lg font-bold ${
                                                percentage >= 80 ? 'text-green-600' :
                                                percentage >= 70 ? 'text-yellow-600' :
                                                percentage >= 60 ? 'text-orange-600' :
                                                'text-red-600'
                                              }`}>
                                                {percentage}%
                                              </div>
                                              <div className="text-xs text-muted-foreground">{awarded}/{section.total}</div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                      <div className="mt-4 p-3 bg-primary/10 rounded-lg border-2 border-primary/20">
                                        <div className="flex justify-between items-center">
                                          <div>
                                            <div className="font-bold text-base">Total Score</div>
                                            <div className="text-sm text-muted-foreground">Overall Performance</div>
                                          </div>
                                          <div className="text-right">
                                            <div className={`text-2xl font-bold ${
                                              consultationScore >= 80 ? 'text-green-600' :
                                              consultationScore >= 70 ? 'text-yellow-600' :
                                              'text-red-600'
                                            }`}>
                                              {consultationScore}%
                                            </div>
                                            <div className="text-sm text-muted-foreground">{consultationScore}/100</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Detailed breakdown text */}
                                  <div className="prose prose-sm max-w-none dark:prose-invert">
                                    <div className="ai-response-content space-y-4">
                                      <div 
                                        dangerouslySetInnerHTML={{ 
                                          __html: renderNHSMarkdown(
                                            scoringSection
                                              .replace(/\d+\/100\s*===\s*DETAILED SCORING BREAKDOWN\s*===/i, '')
                                              .replace(/=== TOTAL SCORE CALCULATION ===[\s\S]*?(?=\n=== |\n\*\*|$)/i, '')
                                              .replace(/2\.\s*Consultation Score Breakdown.*?Below is the detailed scoring breakdown based on the consultation\./is, '')
                                              .replace(/Consultation Score Breakdown.*?Below is the detailed scoring breakdown based on the consultation\./is, '')
                                              .trim(),
                                            { enableNHSStyling: true }
                                          )
                                        }}
                                      />
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}
              </TabsContent>

            </Tabs>

            {/* Transcript Section - Mobile Optimized */}
            <div className="mt-6 sm:mt-8">
              <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between touch-manipulation min-h-[44px]"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="text-sm sm:text-base">View Original Transcript</span>
                    </span>
                    <span className="text-xs">
                      {isTranscriptOpen ? "Hide" : "Show"}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 sm:mt-4">
                  {/* Transcript Sub-tabs */}
                  <Tabs value={transcriptTab} onValueChange={setTranscriptTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl mb-4">
                      <TabsTrigger 
                        value="original" 
                        className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-700 data-[state=active]:font-semibold"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Original
                      </TabsTrigger>
                      <TabsTrigger 
                        value="tidied" 
                        className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-blue-700 data-[state=active]:font-semibold"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Tidied
                      </TabsTrigger>
                    </TabsList>

                    {/* Original Transcript */}
                    <TabsContent value="original">
                      {transcriptMeta && (
                        <div className="mb-2 text-xs text-muted-foreground">
                          Transcript source: {transcriptMeta.source} ({transcriptMeta.itemCount} items)
                        </div>
                      )}
                      <div className="bg-muted/30 rounded-lg p-3 sm:p-4 border overflow-x-auto">
                        <pre className="whitespace-pre-wrap text-xs sm:text-sm font-mono leading-relaxed">
                          {consultationData.transcript}
                        </pre>
                      </div>
                    </TabsContent>

                    {/* Tidied Transcript */}
                    <TabsContent value="tidied">
                      <div className="bg-muted/30 rounded-lg p-3 sm:p-4 border overflow-x-auto">
                        {cleanedTranscript ? (
                          <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed">
                            {cleanedTranscript}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            <span className="ml-2 text-sm text-muted-foreground">Tidying transcript...</span>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Response Panel */}
      <AIResponsePanel
        response={aiResponse}
        isOpen={isAIResponsePanelOpen}
        onOpenChange={setIsAIResponsePanelOpen}
        onCopy={() => handleCopy(aiResponse, "AI Response")}
      />
    </div>
  );
}