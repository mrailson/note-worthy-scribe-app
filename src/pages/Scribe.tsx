import { useState, useEffect } from "react";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";

import { useScribeRecording } from "@/hooks/useScribeRecording";
import { useScribeSettings } from "@/hooks/useScribeSettings";
import { useScribeDocumentGeneration } from "@/hooks/useScribeDocumentGeneration";
import { useScribeHistory } from "@/hooks/useScribeHistory";

import { ScribeTabNavigation } from "@/components/scribe/ScribeTabNavigation";
import { ScribeRecordingControls } from "@/components/scribe/ScribeRecordingControls";
import { ScribeTranscriptPanel } from "@/components/scribe/ScribeTranscriptPanel";
import { ScribeSummaryPanel } from "@/components/scribe/ScribeSummaryPanel";
import { ScribeSettingsPanel } from "@/components/scribe/ScribeSettingsPanel";
import { ScribeHistoryPanel } from "@/components/scribe/ScribeHistoryPanel";

import { ScribeTab } from "@/types/scribe";

const Scribe = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const recording = useScribeRecording();
  const settings = useScribeSettings();
  const documents = useScribeDocumentGeneration();
  const history = useScribeHistory();
  
  const [activeTab, setActiveTab] = useState<ScribeTab>("recording");

  const handleGenerateNotes = () => {
    documents.generateNotes(recording.transcript, settings.settings.outputFormat);
  };

  const handleResetSession = () => {
    recording.resetRecording();
    documents.clearAllContent();
  };

  const handleLoadSession = async (sessionId: string) => {
    const session = await history.loadSession(sessionId);
    if (session) {
      recording.setTranscript(session.transcript);
      documents.setSummary(session.summary || "");
      documents.setActionItems(session.actionItems || "");
      documents.setKeyPoints(session.keyPoints || "");
      setActiveTab("summary");
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-background mobile-container safe-area-top safe-area-bottom">
      <SEO 
        title="Scribe | AI Transcription & Notes | NoteWell AI"
        description="AI-powered transcription and note generation. Real-time recording, automatic summaries, and action items extraction."
        canonical="https://www.gpnotewell.co.uk/scribe"
      />
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto px-2 py-2 sm:px-4 sm:py-6 lg:py-8 space-y-3 sm:space-y-6 max-w-6xl mobile-scroll">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ScribeTab)} className="w-full">
          <div className={`${isMobile ? 'sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b pb-2 mb-4' : ''}`}>
            <ScribeTabNavigation 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
              isMobile={isMobile}
            />
          </div>

          <TabsContent value="recording" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'}`}>
            <ScribeRecordingControls
              isRecording={recording.isRecording}
              isPaused={recording.isPaused}
              duration={recording.duration}
              connectionStatus={recording.connectionStatus}
              wordCount={recording.wordCount}
              currentConfidence={recording.currentConfidence}
              formatDuration={recording.formatDuration}
              transcript={recording.transcript}
              realtimeTranscripts={recording.realtimeTranscripts}
              onStartRecording={recording.startRecording}
              onStopRecording={recording.stopRecording}
              onPauseRecording={recording.pauseRecording}
              onResumeRecording={recording.resumeRecording}
              onResetSession={handleResetSession}
            />
            <ScribeTranscriptPanel
              transcript={recording.transcript}
              isRecording={recording.isRecording}
              realtimeTranscripts={recording.realtimeTranscripts}
              cleanedTranscript={recording.cleanedTranscript}
              isCleaningTranscript={recording.isCleaningTranscript}
              onTranscriptChange={recording.setTranscript}
              onCleanTranscript={recording.cleanTranscript}
            />
          </TabsContent>

          <TabsContent value="summary" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'}`}>
            <ScribeSummaryPanel
              transcript={recording.transcript}
              isGenerating={documents.isGenerating}
              summary={documents.summary}
              actionItems={documents.actionItems}
              keyPoints={documents.keyPoints}
              editStates={documents.editStates}
              editContent={documents.editContent}
              recordingDuration={recording.formatDuration(recording.duration)}
              onGenerateNotes={handleGenerateNotes}
              onStartEdit={documents.startEdit}
              onCancelEdit={documents.cancelEdit}
              onSaveEdit={documents.saveEdit}
              onEditContentChange={documents.setEditContent as any}
              onExportPDF={documents.exportToPDF}
              onExportWord={documents.exportToWord}
            />
          </TabsContent>

          <TabsContent value="history" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'}`}>
            <ScribeHistoryPanel
              sessions={history.sessions}
              isLoading={history.isLoading}
              onLoadSession={handleLoadSession}
              onDeleteSession={history.deleteSession}
              onRefresh={history.fetchSessions}
            />
          </TabsContent>

          <TabsContent value="settings" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'}`}>
            <ScribeSettingsPanel
              settings={settings.settings}
              onUpdateSetting={settings.updateSetting}
              onSaveSettings={settings.saveSettings}
              onResetSettings={settings.resetSettings}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Scribe;
