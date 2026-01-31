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
import { useIsMobile, useIsIPhone } from "@/hooks/use-mobile";
import { showToast } from "@/utils/toastWrapper";
import { ImportedTranscript } from "@/utils/FileImporter";
import { Building2, ExternalLink, MessageSquare, FileText, Play } from "lucide-react";
const Index = () => {
  const {
    user,
    loading,
    hasModuleAccess
  } = useAuth();
  const isMobile = useIsMobile();
  const isIPhone = useIsIPhone();

  // Enable meeting auto-close service (runs every 5 minutes)
  useMeetingAutoClose({
    enabled: !!user,
    intervalMinutes: 5
  });
  const [searchParams] = useSearchParams();

  // Handle magic link tokens from URL hash
  useEffect(() => {
    const handleMagicLink = async () => {
      // Skip if user just logged out (prevent auto re-login)
      const justLoggedOut = sessionStorage.getItem('just_logged_out');
      if (justLoggedOut) {
        sessionStorage.removeItem('just_logged_out');
        // Clear any tokens from URL
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        return;
      }
      
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      if (accessToken && refreshToken && type === 'magiclink') {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('Magic link session error:', error);
            showToast.error('The magic link has expired or is invalid. Please request a new one.', { section: 'security' });
          } else {
            // Clear the hash from URL
            window.history.replaceState(null, '', window.location.pathname);
            showToast.success('Welcome! You have successfully logged in.', { section: 'security' });
          }
        } catch (err) {
          console.error('Magic link error:', err);
          showToast.error('Failed to process magic link. Please try again.', { section: 'security' });
        }
      }
    };
    
    handleMagicLink();
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const editMeetingId = searchParams.get('edit');
  const autoStart = searchParams.get('autoStart') === 'true';
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
      const data = state.meetingData;
      
      // Set meeting settings from the continued meeting
      setMeetingSettings({
        title: data.title || "Continued Meeting",
        description: data.description || "Meeting continued from previous session",
        meetingType: data.meeting_type || "general",
        attendees: data.attendees || "",
        practiceId: "",
        meetingFormat: data.meeting_format || "teams"
      });
      
      // Set existing transcript and duration if available
      if (data.existingTranscript) {
        const sessionMarker = `\n\n[Session 2 - ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}]\n\n`;
        setTranscript(data.existingTranscript + sessionMarker);
        setWordCount(data.existingTranscript.split(' ').filter((word: string) => word.length > 0).length);
      }
      
      // Set current meeting ID for appending
      if (data.id) {
        setCurrentMeetingId(data.id);
      }
      
      // Clear the navigation state to prevent re-triggering on refresh
      window.history.replaceState({}, '', '/');
      
      showToast.success(`Continuing "${data.title}". Press the mic button to start recording.`, { section: 'meeting_manager' });
      
      // Scroll to the recorder section on mobile
      setTimeout(() => {
        const recorderElement = document.getElementById('meeting-recorder');
        if (recorderElement) {
          recorderElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // Fallback: scroll to top where recorder is
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [location.state]);

  // Load meeting for editing if editMeetingId is provided
  useEffect(() => {
    if (editMeetingId && user) {
      loadMeetingForEditing(editMeetingId);
    }
  }, [editMeetingId, user]);

  // Conditional homepage redirect: AI4GP users → AI4GP, others → Meeting Manager
  // Skip redirect if user is continuing a meeting
  useEffect(() => {
    const state = location.state as any;
    const isContinuingMeeting = state?.continueMeeting;
    
    if (user && !loading && !editMeetingId && !isContinuingMeeting && hasModuleAccess('ai4gp_access')) {
      navigate('/ai4gp', {
        replace: true
      });
    }
  }, [user, loading, editMeetingId, location.state, hasModuleAccess, navigate]);
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
      showToast.success(`Meeting loaded: ${meeting.title}`, { section: 'meeting_manager' });
    } catch (error: any) {
      showToast.error(`Error loading meeting: ${error.message}`, { section: 'meeting_manager' });
    }
  };
  const handleAudioImported = (audioFile: File) => {
    // Handle the imported audio file
    // This could be extended to process the audio file for transcription
    showToast.success(`Audio file imported: ${audioFile.name}`, { section: 'meeting_manager' });
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
    showToast.success(`Transcript imported successfully! ${importedTranscript.wordCount} words loaded.`, { section: 'meeting_manager' });
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
          
          {/* Two-column layout: Login first on mobile, then welcome content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Login Form - appears first on mobile, right on desktop */}
            <div className="lg:sticky lg:top-8 h-fit lg:order-2">
              <LoginForm />
            </div>

            {/* Welcome Content - appears second on mobile, left on desktop */}
            <div className="space-y-6 lg:order-1">
              {/* Service Cards */}
              <div className="space-y-4">
                {/* First Time Training Video */}
                <div className="p-4 border border-primary/30 rounded-lg bg-primary/5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Play className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1">First Time to Notewell AI?</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Learn how to login and navigate the basic features
                      </p>
                      <Link 
                        to="/training"
                        className="inline-flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                      >
                        <span>Watch 2 min training video</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Complaints Management System */}
                <div className="p-4 border border-border rounded-lg bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1">Complaints Management System</h3>
                      <p className="text-sm text-muted-foreground">
                        Comprehensive patient complaint management with automated workflows and NHS compliance
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 ml-11 mb-3">
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
                  </ul>
                  <div className="pt-3 border-t border-border ml-11">
                    <a 
                      href="https://www.loom.com/share/58d3d16963224dddac2ea8211bd2b90d" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      <span>🎬</span>
                      <span>Watch Training Video</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Ask AI (GP & Practice Management) */}
                <div className="p-4 border border-border rounded-lg bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1">Ask AI (GP & Practice Management)</h3>
                      <p className="text-sm text-muted-foreground">
                        Role-aware AI support for NHS primary care teams, combining GP clinical information tools and Practice Manager operational support in a single, secure service.
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 ml-11 mb-3">
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      <span>GP & Practice Manager modes with role-specific prompts</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      <span>NHS guidance, policy, and reference support</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      <span>Complaints, governance, workforce and operational queries</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      <span>Document drafting, analysis and structured responses</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      <span>Audio and meeting content support (where enabled)</span>
                    </li>
                  </ul>
                  {/* Role switcher explanation */}
                  <p className="text-xs text-muted-foreground ml-11 mb-3 italic">
                    Users can switch between GP and Practice Manager views to access prompts and tools relevant to their role.
                  </p>
                  {/* Safety Guardrail */}
                  <div className="ml-11 pt-2 border-t border-border space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>🔒</span>
                      <span>Information support only · No patient data · No automatic clinical system write-back · Human review required</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Outputs are designed to support professional judgement, not replace it.
                    </p>
                  </div>
                </div>

                {/* Meeting Recording & Management */}
                <div className="p-4 border border-border rounded-lg bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-1">Meeting Recording & Management</h3>
                      <p className="text-sm text-muted-foreground">
                        Professional meeting transcription and management for Practice Managers and administrative teams
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 ml-11">
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      <span>Partnership meeting transcription</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      <span>Automated meeting summaries</span>
                    </li>
                    <li className="flex items-center gap-2 text-xs">
                      <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      <span>Action item tracking</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Who is this for? Section */}
              <div className="mt-6 p-4 bg-accent/30 rounded-lg border border-accent">
                <h3 className="text-sm font-semibold text-foreground mb-3 text-center">Who uses Notewell?</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-background rounded-lg">
                    <div className="text-lg mb-1">🧑‍⚕️</div>
                    <h4 className="text-xs font-semibold text-foreground mb-1">GPs & Clinicians</h4>
                    <p className="text-xs text-muted-foreground">Structured support, references, admin reduction</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <div className="text-lg mb-1">🗂</div>
                    <h4 className="text-xs font-semibold text-foreground mb-1">Practice Managers</h4>
                    <p className="text-xs text-muted-foreground">Complaints, meetings, governance</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <div className="text-lg mb-1">🧩</div>
                    <h4 className="text-xs font-semibold text-foreground mb-1">PCNs & Neighbourhoods</h4>
                    <p className="text-xs text-muted-foreground">Shared workflows, consistency, oversight</p>
                  </div>
                </div>
              </div>

              {/* Governance Trust Bar */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-success/10 text-success rounded-full border border-success/20">
                  ✅ NHS DSPT aligned
                </span>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-success/10 text-success rounded-full border border-success/20">
                  ✅ No automatic EMIS/S1 write-back
                </span>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-success/10 text-success rounded-full border border-success/20">
                  ✅ Human review required
                </span>
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-success/10 text-success rounded-full border border-success/20">
                  ✅ UK-hosted & encrypted
                </span>
              </div>
            </div>
          </div>

          {/* Service Overview - without the duplicate cards */}
          <ServiceOverview />
        </div>
        
      </div>;
  }
  return <div className="min-h-[100dvh] bg-gradient-background">
      <SEO title="NoteWell AI | AI-Powered GP Documentation & Practice Management" description="Transform your GP practice with AI-powered meeting notes, consultation transcription, and comprehensive practice management tools designed for NHS primary care." canonical="https://www.gpnotewell.co.uk/" keywords="GP practices, AI meeting notes, NHS primary care, clinical documentation, practice management, GP surgery software, medical recording" />
      <Header onNewMeeting={handleNewMeeting} />
      
        <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-4xl">
          <MaintenanceBanner />
          
          <div id="meeting-recorder">
            <MeetingRecorder 
              onTranscriptUpdate={setTranscript} 
              onDurationUpdate={setDuration} 
              onWordCountUpdate={setWordCount} 
              initialSettings={meetingSettings} 
              autoStart={autoStart}
              continueMeetingId={currentMeetingId}
              existingTranscript={transcript}
              existingDuration={parseInt(duration.split(':')[0]) * 60 + parseInt(duration.split(':')[1] || '0')}
              forceRecorderTab={!!(location.state as any)?.continueMeeting}
              onContinuationComplete={() => {
                setCurrentMeetingId(null);
                setTranscript('');
                setDuration('00:00');
                setWordCount(0);
              }}
            />
          </div>
        </div>

        {/* Discreet floating icon for Executive Overview - mobile only (hidden on iPhone) */}
        {isMobile && user && !isIPhone && <Link to="/executive-overview" className="fixed bottom-32 right-4 z-40 flex items-center justify-center w-11 h-11 rounded-full bg-background border border-border shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95" aria-label="Executive Overview">
            <Building2 className="w-5 h-5 text-primary" />
          </Link>}
    </div>;
};
export default Index;