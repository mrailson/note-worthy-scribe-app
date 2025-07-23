import { useState, useEffect } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";
import { MeetingRecorder } from "@/components/MeetingRecorder";
import { MeetingSettings } from "@/components/MeetingSettings";
import { LiveTranscript } from "@/components/LiveTranscript";
import { MeetingSummary } from "@/components/MeetingSummary";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { ImportedTranscript } from "@/utils/FileImporter";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const { user, loading } = useAuth();
  
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const editMeetingId = searchParams.get('edit');
  const isMobile = useIsMobile();
  
  const [currentView, setCurrentView] = useState<"recording" | "summary">("recording");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState("00:00");
  const [wordCount, setWordCount] = useState(0);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [meetingSettings, setMeetingSettings] = useState({
    title: "",
    description: "",
    meetingType: "general",
    attendees: ""
  });
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [importedTranscript, setImportedTranscript] = useState<ImportedTranscript | null>(null);

  // Check for continue meeting state
  useEffect(() => {
    const state = location.state as any;
    if (state?.continueMeeting && state?.meetingData) {
      setMeetingSettings({
        title: state.meetingData.title || "Continued Meeting",
        description: "Meeting continued from previous session",
        meetingType: "general",
        attendees: ""
      });
      // Only show meeting session restored toast on desktop
      if (!isMobile) {
        toast.success("Meeting session restored. You can continue recording.");
      }
    }
  }, [location.state]);

  // Load meeting for editing if editMeetingId is provided
  useEffect(() => {
    if (editMeetingId && user) {
      loadMeetingForEditing(editMeetingId);
    }
  }, [editMeetingId, user]);

  const loadMeetingForEditing = async (meetingId: string) => {
    try {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .eq('user_id', user?.id)
        .single();

      if (meetingError) throw meetingError;

      // Load transcripts
      const { data: transcripts, error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('timestamp_seconds', { ascending: true });

      if (transcriptError) throw transcriptError;

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
        attendees: ""
      });
      
      setCurrentMeetingId(meetingId);
      setDuration(meeting.duration_minutes ? `${Math.floor(meeting.duration_minutes / 60).toString().padStart(2, '0')}:${(meeting.duration_minutes % 60).toString().padStart(2, '0')}` : "00:00");
      
      // Reconstruct transcript
      const fullTranscript = transcripts?.map(t => t.content).join('\n') || "";
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
      attendees: ""
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
        <Header onNewMeeting={handleNewMeeting} />
        <div className="container mx-auto px-3 py-6 sm:px-4 sm:py-8">
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={handleNewMeeting} />
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-4xl">
        <>
          {/* Meeting Recorder with integrated tabs */}
          <MeetingRecorder
            onTranscriptUpdate={setTranscript}
            onDurationUpdate={setDuration}
            onWordCountUpdate={setWordCount}
            initialSettings={meetingSettings}
          />

          {/* Show Summary Button when there's content */}
          {transcript && (
            <div className="flex justify-center pt-4">
              <button
                onClick={handleViewSummary}
                className="w-full sm:w-auto px-6 py-4 bg-gradient-primary text-white rounded-lg hover:bg-primary-hover shadow-medium transition-all text-lg font-medium touch-manipulation min-h-[48px]"
              >
                View Meeting Summary
              </button>
            </div>
          )}
        </>
      </div>
    </div>
  );
};

export default Index;
