import { useState, useEffect } from "react";
import { useSearchParams, useLocation, useNavigate, Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { LoginForm } from "@/components/LoginForm";
import { MeetingRecorder } from "@/components/MeetingRecorder";
import { MeetingSettings } from "@/components/MeetingSettings";
import { LiveTranscript } from "@/components/LiveTranscript";
import { MeetingSummary } from "@/components/MeetingSummary";
import { ServiceOverview } from "@/components/ServiceOverview";
import { DemoVideoSection } from "@/components/DemoVideoSection";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMeetingAutoClose } from "@/hooks/useMeetingAutoClose";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { ImportedTranscript } from "@/utils/FileImporter";
import { Building2 } from "lucide-react";
const Index = () => {
  const {
    user,
    loading,
    hasModuleAccess
  } = useAuth();
  const isMobile = useIsMobile();

  // Enable meeting auto-close service (runs every 5 minutes)
  useMeetingAutoClose({
    enabled: !!user,
    intervalMinutes: 5
  });
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
      navigate('/ai4gp', {
        replace: true
      });
    }
  }, [user, loading, editMeetingId, hasModuleAccess, navigate]);
  const loadMeetingForEditing = async (meetingId: string) => {
    try {
      const {
        data: meeting,
        error: meetingError
      } = await supabase.from('meetings').select('*').eq('id', meetingId).eq('user_id', user?.id).single();
      if (meetingError) throw meetingError;

      // Load transcripts - try chunks first (higher fidelity), then fallback to meeting_transcripts
      let fullTranscript = "";

      // Try to reconstruct from chunks
      const {
        data: chunks,
        error: chunksError
      } = await supabase.from('meeting_transcription_chunks').select('transcription_text').eq('meeting_id', meetingId).order('chunk_number', {
        ascending: true
      });
      if (!chunksError && chunks && chunks.length > 0) {
        console.log(`📦 Reconstructing from ${chunks.length} chunks...`);

        // Import segment merge utilities
        const {
          mergeByTimestamps,
          segmentsToPlainText
        } = await import('@/lib/segmentMerge');
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
        const {
          data: transcripts,
          error: transcriptError
        } = await supabase.from('meeting_transcripts').select('*').eq('meeting_id', meetingId).order('timestamp_seconds', {
          ascending: true
        });
        if (transcriptError) throw transcriptError;
        fullTranscript = transcripts?.map(t => t.content).join('\n') || "";
      }

      // Load summary
      const {
        data: summary,
        error: summaryError
      } = await supabase.from('meeting_summaries').select('*').eq('meeting_id', meetingId).maybeSingle();

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
      speakerCount: 1,
      // Default speaker count
      startTime: new Date().toISOString(),
      extractedSettings: importedTranscript?.extractedSettings
    };
    navigate('/meeting-summary', {
      state: meetingData
    });
  };
  if (loading) {
    return <div className="min-h-[100dvh] bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>;
  }
  if (!user) {
    return <div className="min-h-[100dvh] bg-gradient-background">
        <Header onNewMeeting={handleNewMeeting} />
        <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8 max-w-6xl">
          <MaintenanceBanner />
          
          {/* Two-column layout: Welcome content left, Login right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left Column: Welcome Content */}
            <div className="space-y-8">
              {/* Hero Section */}
              <div className="text-center lg:text-left space-y-4 animate-fade-in">
                
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                  Welcome to Notewell AI
                </h1>
                
              </div>

              {/* Combined Demo & Complaints Section */}
              <div className="space-y-4">
                <div className="text-center lg:text-left">
                  <h2 className="text-xl font-semibold text-foreground mb-1">
                    See Notewell AI Complaints Service in Action
                  </h2>
                  
                  <Link to="/demos" className="inline-flex items-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow border border-border">
                    View Complaints Service System
                  </Link>
                </div>

                {/* Complaints Management Details */}
                <div className="p-4 border border-border rounded-lg bg-card">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1">Complaints Management System</h3>
                      <p className="text-sm text-muted-foreground">
                        Comprehensive patient complaint management system with automated workflows and NHS compliance
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 ml-11">
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span>Automated complaint tracking</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span>Response template library</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span>NHS compliance monitoring</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span>Performance analytics</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span>Multi-channel complaint capture</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right Column: Login Form */}
            <div className="lg:sticky lg:top-8 h-fit">
              <LoginForm />
            </div>
          </div>

          {/* Full-width sections below */}
          <div className="space-y-8">

            {/* CSO Training Section - Refined */}
            <div className="animate-fade-in">
              <Link to="/usingai_nhs" className="block">
                <div className="p-6 border border-border rounded-lg bg-card hover:shadow-lg transition-all hover:border-primary/50">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        Using AI in Your GP Practice & CSO Training
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Watch our explainer video and access free CSO training resources for NHS practices
                      </p>
                    </div>
                    <div className="sm:ml-auto self-center">
                      <span className="inline-flex items-center px-3 py-1.5 bg-primary/10 text-primary rounded-md font-medium text-sm hover:bg-primary/20 transition-colors">
                        View Resources →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>

            {/* Service Overview */}
            <ServiceOverview />
          </div>
        </div>
      </div>;
  }
  return <div className="min-h-[100dvh] bg-gradient-background">
      <SEO title="NoteWell AI | AI-Powered GP Documentation & Practice Management" description="Transform your GP practice with AI-powered meeting notes, consultation transcription, and comprehensive practice management tools designed for NHS primary care." canonical="https://www.gpnotewell.co.uk/" keywords="GP practices, AI meeting notes, NHS primary care, clinical documentation, practice management, GP surgery software, medical recording" />
      <Header onNewMeeting={handleNewMeeting} />
      
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-4xl">
          <MaintenanceBanner />
          
          <MeetingRecorder onTranscriptUpdate={setTranscript} onDurationUpdate={setDuration} onWordCountUpdate={setWordCount} initialSettings={meetingSettings} />
        </div>

        {/* Discreet floating icon for Executive Overview - mobile only */}
        {isMobile && user && <Link to="/executive-overview" className="fixed bottom-32 right-4 z-40 flex items-center justify-center w-11 h-11 rounded-full bg-background border border-border shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95" aria-label="Executive Overview">
            <Building2 className="w-5 h-5 text-primary" />
          </Link>}
    </div>;
};
export default Index;