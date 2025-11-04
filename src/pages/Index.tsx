import { useState, useEffect } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { LoginForm } from "@/components/LoginForm";
import { MeetingRecorder } from "@/components/MeetingRecorder";
import { MeetingSettings } from "@/components/MeetingSettings";
import { LiveTranscript } from "@/components/LiveTranscript";
import { MeetingSummary } from "@/components/MeetingSummary";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMeetingAutoClose } from "@/hooks/useMeetingAutoClose";
import { toast } from "sonner";
import { ImportedTranscript } from "@/utils/FileImporter";
import StandaloneTranscriptionViewer from "@/components/standalone/StandaloneTranscriptionViewer";

const Index = () => {
  const { user, loading, hasModuleAccess } = useAuth();
  
  // Enable meeting auto-close service (runs every 5 minutes)
  useMeetingAutoClose({ enabled: !!user, intervalMinutes: 5 });
  
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const editMeetingId = searchParams.get('edit');
  
  const [currentView, setCurrentView] = useState<"recording" | "summary">("recording");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState("00:00");
  const [wordCount, setWordCount] = useState(0);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [meetingSettings, setMeetingSettings] = useState({
    title: "",
    description: "",
    meetingType: "general",
    attendees: "",
    practiceId: "",
    meetingFormat: "teams"
  });
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [importedTranscript, setImportedTranscript] = useState<ImportedTranscript | null>(null);

  // Check for continue meeting state and active tab
  useEffect(() => {
    const state = location.state as any;
    if (state?.continueMeeting && state?.meetingData) {
      setMeetingSettings({
        title: state.meetingData.title || "Continued Meeting",
        description: "Meeting continued from previous session",
        meetingType: "general",
        attendees: "",
        practiceId: "",
        meetingFormat: "teams"
      });
      toast.success("Meeting session restored. You can continue recording.");
    }
  }, [location.state]);

  // Load meeting for editing if editMeetingId is provided
  useEffect(() => {
    if (editMeetingId && user) {
      loadMeetingForEditing(editMeetingId);
    }
  }, [editMeetingId, user]);

  // Conditional homepage redirect: AI4GP users → AI4GP, others → Meeting Manager
  useEffect(() => {
    if (user && !loading && !editMeetingId && hasModuleAccess('ai4gp_access')) {
      navigate('/ai4gp', { replace: true });
    }
  }, [user, loading, editMeetingId, hasModuleAccess, navigate]);

  const loadMeetingForEditing = async (meetingId: string) => {
    try {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .eq('user_id', user?.id)
        .single();

      if (meetingError) throw meetingError;

      // Load transcripts - try chunks first (higher fidelity), then fallback to meeting_transcripts
      let fullTranscript = "";
      
      // Try to reconstruct from chunks
      const { data: chunks, error: chunksError } = await supabase
        .from('meeting_transcription_chunks')
        .select('transcription_text')
        .eq('meeting_id', meetingId)
        .order('chunk_number', { ascending: true });
      
      if (!chunksError && chunks && chunks.length > 0) {
        console.log(`📦 Reconstructing from ${chunks.length} chunks...`);
        
        // Import segment merge utilities
        const { mergeByTimestamps, segmentsToPlainText } = await import('@/lib/segmentMerge');
        let allSegments: any[] = [];
        
        for (const chunk of chunks) {
          try {
            // Try to parse as JSON segments
            const parsed = JSON.parse(chunk.transcription_text);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
              allSegments = mergeByTimestamps(allSegments, parsed);
            }
          } catch {
            // Legacy plain text - append directly
            fullTranscript = fullTranscript + (fullTranscript ? ' ' : '') + chunk.transcription_text;
          }
        }
        
        // Convert segments to text if we have any
        if (allSegments.length > 0) {
          fullTranscript = segmentsToPlainText(allSegments);
          console.log(`✅ Reconstructed from ${allSegments.length} segments`);
        }
      }
      
      // Fallback to meeting_transcripts if chunks didn't work
      if (!fullTranscript) {
        const { data: transcripts, error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('timestamp_seconds', { ascending: true });

        if (transcriptError) throw transcriptError;
        fullTranscript = transcripts?.map(t => t.content).join('\n') || "";
      }

      // Load summary
      const { data: summary, error: summaryError } = await supabase
        .from('meeting_summaries')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle();

      // Set meeting data
      setMeetingSettings({
        title: meeting.title,
        description: meeting.description || "",
        meetingType: meeting.meeting_type,
        attendees: "",
        practiceId: meeting.practice_id || "",
        meetingFormat: "teams"
      });
      
      setCurrentMeetingId(meetingId);
      setDuration(meeting.duration_minutes ? `${Math.floor(meeting.duration_minutes / 60).toString().padStart(2, '0')}:${(meeting.duration_minutes % 60).toString().padStart(2, '0')}` : "00:00");
      
      // Set reconstructed transcript
      setTranscript(fullTranscript);
      setWordCount(fullTranscript.split(' ').filter(word => word.length > 0).length);

      if (summary) {
        setCurrentView("summary");
      }

      toast.success(`Meeting loaded: ${meeting.title}`);
    } catch (error: any) {
      toast.error(`Error loading meeting: ${error.message}`);
    }
  };

  const handleAudioImported = (audioFile: File) => {
    // Handle the imported audio file
    // This could be extended to process the audio file for transcription
    toast.success(`Audio file imported: ${audioFile.name}`);
    console.log("Audio file imported:", audioFile);
  };

  const handleTranscriptImported = (importedTranscript: ImportedTranscript) => {
    // Set the imported transcript content
    setTranscript(importedTranscript.content);
    setWordCount(importedTranscript.wordCount);
    
    // Set duration if available
    if (importedTranscript.duration) {
      setDuration(importedTranscript.duration);
    }
    
    setImportedTranscript(importedTranscript);
    
    toast.success(`Transcript imported successfully! ${importedTranscript.wordCount} words loaded.`);
  };

  const parseDurationToMinutes = (duration: string): number => {
    const [hours, minutes] = duration.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  };

  const handleNewMeeting = () => {
    setCurrentView("recording");
    setTranscript("");
    setDuration("00:00");
    setWordCount(0);
    setCurrentMeetingId(null);
    setMeetingSettings({
      title: "",
      description: "",
      meetingType: "general",
      attendees: "",
      practiceId: "",
      meetingFormat: "teams"
    });
    // Clear URL parameters
    window.history.replaceState({}, '', '/');
  };


  const handleViewSummary = () => {
    // Navigate to the dedicated summary page with the meeting data
    const meetingData = {
      title: meetingSettings.title || "General Meeting",
      duration,
      wordCount,
      transcript,
      speakerCount: 1, // Default speaker count
      startTime: new Date().toISOString(),
      extractedSettings: importedTranscript?.extractedSettings
    };

    navigate('/meeting-summary', { 
      state: meetingData 
    });
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
          <MaintenanceBanner />
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-background">
      <SEO 
        title="NoteWell AI | AI-Powered GP Documentation & Practice Management"
        description="Transform your GP practice with AI-powered meeting notes, consultation transcription, and comprehensive practice management tools designed for NHS primary care."
        canonical="https://www.gpnotewell.co.uk/"
        keywords="GP practices, AI meeting notes, NHS primary care, clinical documentation, practice management, GP surgery software, medical recording"
      />
      <Header onNewMeeting={handleNewMeeting} />
      
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-4xl">
          <MaintenanceBanner />
          
          <MeetingRecorder
            onTranscriptUpdate={setTranscript}
            onDurationUpdate={setDuration}
            onWordCountUpdate={setWordCount}
            initialSettings={meetingSettings}
          />
        </div>

      {/* Standalone transcription viewer */}
      <StandaloneTranscriptionViewer />
    </div>
  );
};

export default Index;
