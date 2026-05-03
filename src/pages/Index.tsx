import { useState, useEffect, useRef } from "react";
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
import { PodcastPlayer } from "@/components/PodcastPlayer";
import { useNavigationBlocker } from "@/hooks/useNavigationBlocker";
import { NavigationBlockerDialog } from "@/components/NavigationBlockerDialog";

import { DemoVideoSection } from "@/components/DemoVideoSection";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMeetingAutoClose } from "@/hooks/useMeetingAutoClose";
import { useIsMobile, useIsIPhone } from "@/hooks/use-mobile";
import { showToast } from "@/utils/toastWrapper";
import { ImportedTranscript } from "@/utils/FileImporter";
import { Building2, ExternalLink, MessageSquare, FileText, Play, Newspaper, FlaskConical } from "lucide-react";
const Index = () => {
  const {
    user,
    loading,
    hasModuleAccess,
    isSystemAdmin
  } = useAuth();
  const isMobile = useIsMobile();
  const isIPhone = useIsIPhone();
  const { showBlockerDialog, confirmLeave, cancelLeave } = useNavigationBlocker();

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

  // Redirect mobile users to the dedicated mobile recorder
  useEffect(() => {
    if (window.innerWidth <= 768) {
      navigate("/new-recorder", { replace: true });
    }
  }, []);
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

  // Default home page redirect based on user preference (Index is single source of truth)
  const [homePageChecked, setHomePageChecked] = useState(false);
  const homePageRedirectDone = useRef(false);

  useEffect(() => {
    if (!user || loading || homePageRedirectDone.current) {
      if (!loading && !user) setHomePageChecked(true);
      return;
    }

    let cancelled = false;
    const state = location.state as any;
    const isContinuingMeeting = state?.continueMeeting;
    const isFromHome = searchParams.get('from') === 'home';

    // If user clicked Home button or is continuing/editing a meeting, skip redirect
    if (isFromHome || isContinuingMeeting || editMeetingId) {
      if (isFromHome) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('from');
        const newSearch = newParams.toString();
        window.history.replaceState({}, '', newSearch ? `/?${newSearch}` : '/');
      }
      setHomePageChecked(true);
      homePageRedirectDone.current = true;
      return;
    }

    const checkHomePage = async () => {
      const startTime = Date.now();

      while (!cancelled && Date.now() - startTime < 2000) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('default_home_page_desktop, default_home_page_mobile')
            .eq('user_id', user.id)
            .maybeSingle();

          const preference = isMobile
            ? (data as any)?.default_home_page_mobile
            : (data as any)?.default_home_page_desktop;

          console.log('Index redirect check - profile:', data, 'preference:', preference, 'from:', searchParams.get('from'));

          // Profile loaded: decide once and stop waiting
          if (data) {
            if (preference && preference !== '/') {
              homePageRedirectDone.current = true;
              navigate(preference, { replace: true });
              return;
            }
            break;
          }

          // Any non-empty error falls back safely to normal home
          if (error) {
            console.error('Error checking home page preference:', error);
            break;
          }
        } catch (err) {
          console.error('Error checking home page preference:', err);
          break;
        }

        // Brief retry while waiting for profile creation/availability
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (!cancelled) {
        setHomePageChecked(true);
        homePageRedirectDone.current = true;
      }
    };

    checkHomePage();

    return () => {
      cancelled = true;
    };
  }, [user, loading, editMeetingId, location.state, searchParams, navigate, isMobile]);
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
    const isMobileScreen = window.innerWidth < 768;
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobileScreen || isMobileUserAgent) {
      navigate('/new-recorder');
      return;
    }
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
  if (loading || (user && !homePageChecked)) {
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

                {/* News & Updates */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Newspaper className="h-4 w-4" />
                    Latest News & Updates
                  </h3>
                  <a 
                    href="https://gpnotewell.co.uk/planning-studio"
                    className="block p-4 border border-primary/20 rounded-lg bg-primary/5 hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-accent-foreground">New</span>
                          <span className="text-[10px] text-muted-foreground">April 2026</span>
                        </div>
                        <h4 className="font-semibold text-base mb-1 group-hover:text-[hsl(var(--primary))] transition-colors">NHC Planning Studio — free planning aid for ICBs and PCNs</h4>
                        <p className="text-sm text-muted-foreground">
                          A hands-on tool for scoping Neighbourhood Health Centre schemes ahead of the 28 May 2026 NHS England pipeline submission deadline. Sizes service tiers to your population, compares integrated vs unintegrated models, displays sample floor plans, and runs a 21-question readiness self-assessment — all grounded in NHS England PRN02455 and PRN02463.
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] font-medium mt-2">
                          Open the Planning Studio →
                        </span>
                      </div>
                    </div>
                  </a>
                  <a 
                    href="/documents/DES27/des-2627-briefing.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 border border-primary/20 rounded-lg bg-primary/5 hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-accent-foreground">New</span>
                          <span className="text-[10px] text-muted-foreground">March 2026</span>
                        </div>
                        <h4 className="font-semibold text-base mb-1 group-hover:text-[hsl(var(--primary))] transition-colors">Network Contract DES 2026/27 — PCN Briefing</h4>
                        <p className="text-sm text-muted-foreground">
                          Full breakdown of the 2026/27 Network Contract DES changes, service specifications and key dates for PCNs.
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] font-medium mt-2">
                          Read briefing <ExternalLink className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </a>
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
                
                {/* Podcast Player */}
                <div className="mt-4">
                  <PodcastPlayer 
                    src="/audio/notewell-podcast.mp3" 
                    title="Notewell AI: A Responsible Revolution in Admin Tasks"
                  />
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

              {/* Legal Links */}
              <div className="mt-3 flex justify-center gap-4">
                <a href="/privacy-notice" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                  Privacy Notice
                </a>
                <a href="/accessibility-statement" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                  Accessibility Statement
                </a>
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
      <NavigationBlockerDialog open={showBlockerDialog} onStay={cancelLeave} onLeave={confirmLeave} />
      
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

        {/* Admin tools — mobile only, admin only */}
        {isMobile && user && isSystemAdmin && (
          <div className="md:hidden px-4 pb-24 pt-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Admin tools</div>
            <Link
              to="/admin/pipeline-tests"
              className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm active:bg-muted"
            >
              <FlaskConical className="h-4 w-4 text-primary" />
              <span>Pipeline Tests</span>
            </Link>
          </div>
        )}
    </div>;
};
export default Index;