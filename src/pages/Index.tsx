import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";
import { MeetingRecorder } from "@/components/MeetingRecorder";
import { MeetingSettings } from "@/components/MeetingSettings";
import { LiveTranscript } from "@/components/LiveTranscript";
import { MeetingSummary } from "@/components/MeetingSummary";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const editMeetingId = searchParams.get('edit');
  
  const [currentView, setCurrentView] = useState<"recording" | "summary">("recording");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState("00:00");
  const [wordCount, setWordCount] = useState(0);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [meetingSettings, setMeetingSettings] = useState({
    title: "",
    description: "",
    meetingType: "general"
  });
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);

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
        meetingType: meeting.meeting_type
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

      toast({
        title: "Meeting Loaded",
        description: `Loaded meeting: ${meeting.title}`,
      });
    } catch (error: any) {
      toast({
        title: "Error Loading Meeting",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveMeeting = async () => {
    if (!user || !meetingSettings.title) return null;

    try {
      const meetingData = {
        user_id: user.id,
        title: meetingSettings.title,
        description: meetingSettings.description || null,
        meeting_type: meetingSettings.meetingType,
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration_minutes: parseDurationToMinutes(duration),
        status: 'completed'
      };

      if (currentMeetingId) {
        // Update existing meeting
        const { data, error } = await supabase
          .from('meetings')
          .update(meetingData)
          .eq('id', currentMeetingId)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new meeting
        const { data, error } = await supabase
          .from('meetings')
          .insert(meetingData)
          .select()
          .single();

        if (error) throw error;
        setCurrentMeetingId(data.id);
        return data;
      }
    } catch (error: any) {
      toast({
        title: "Error Saving Meeting",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
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
      meetingType: "general"
    });
    // Clear URL parameters
    window.history.replaceState({}, '', '/');
  };

  const handleHelp = () => {
    // TODO: Implement help/about modal
    console.log("Help & About clicked");
  };

  const handleViewSummary = async () => {
    // Save meeting before viewing summary
    await saveMeeting();
    setCurrentView("summary");
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
        <Header onNewMeeting={handleNewMeeting} onHelp={handleHelp} />
        <div className="container mx-auto px-4 py-8">
          <LoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-background">
      <Header onNewMeeting={handleNewMeeting} onHelp={handleHelp} />
      
      <div className="container mx-auto px-4 py-8 space-y-6">
        {currentView === "recording" ? (
          <>
            {/* Meeting Recorder */}
            <MeetingRecorder
              onTranscriptUpdate={setTranscript}
              onDurationUpdate={setDuration}
              onWordCountUpdate={setWordCount}
              initialSettings={meetingSettings}
            />

            {/* Meeting Settings */}
            <MeetingSettings 
              onSettingsChange={setMeetingSettings}
              initialSettings={meetingSettings}
            />

            {/* Live Transcript and Import */}
            <LiveTranscript
              transcript={transcript}
              showTimestamps={showTimestamps}
              onTimestampsToggle={setShowTimestamps}
            />

            {/* Show Summary Button when there's content */}
            {transcript && (
              <div className="flex justify-center">
                <button
                  onClick={handleViewSummary}
                  className="px-6 py-3 bg-gradient-primary text-white rounded-lg hover:bg-primary-hover shadow-medium transition-all"
                >
                  View Meeting Summary
                </button>
              </div>
            )}
          </>
        ) : (
          <MeetingSummary
            duration={duration}
            wordCount={wordCount}
            transcript={transcript}
            meetingSettings={meetingSettings}
            currentMeetingId={currentMeetingId}
            onBackToRecording={() => setCurrentView("recording")}
            onSave={saveMeeting}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
