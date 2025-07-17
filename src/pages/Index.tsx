import { useState } from "react";
import { Header } from "@/components/Header";
import { LoginForm } from "@/components/LoginForm";
import { MeetingRecorder } from "@/components/MeetingRecorder";
import { MeetingSettings } from "@/components/MeetingSettings";
import { LiveTranscript } from "@/components/LiveTranscript";
import { MeetingSummary } from "@/components/MeetingSummary";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<"recording" | "summary">("recording");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState("00:00");
  const [wordCount, setWordCount] = useState(0);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [meetingSettings, setMeetingSettings] = useState({});

  const handleNewMeeting = () => {
    setCurrentView("recording");
    setTranscript("");
    setDuration("00:00");
    setWordCount(0);
  };

  const handleHelp = () => {
    // TODO: Implement help/about modal
    console.log("Help & About clicked");
  };

  const handleViewSummary = () => {
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
            />

            {/* Meeting Settings */}
            <MeetingSettings onSettingsChange={setMeetingSettings} />

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
            onBackToRecording={() => setCurrentView("recording")}
          />
        )}
      </div>
    </div>
  );
};

export default Index;
