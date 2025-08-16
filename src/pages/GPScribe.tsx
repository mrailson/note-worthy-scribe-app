import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PatientTranslationModal from "@/components/PatientTranslationModal";
import { bus } from "@/lib/bus";

// Import extracted hooks
import { useGPScribeRecording } from "@/hooks/useGPScribeRecording";
import { useTranslationService } from "@/hooks/useTranslationService";
import { useConsultationGuidance } from "@/hooks/useConsultationGuidance";
import { useConsultationHistory } from "@/hooks/useConsultationHistory";
import { useGPScribeSettings } from "@/hooks/useGPScribeSettings";
import { useDocumentGeneration } from "@/hooks/useDocumentGeneration";

// Import extracted components
import { RecordingControls } from "@/components/gpscribe/RecordingControls";
import { TranscriptPanel } from "@/components/gpscribe/TranscriptPanel";
import { SummaryPanel } from "@/components/gpscribe/SummaryPanel";
import { TabNavigation } from "@/components/gpscribe/TabNavigation";
import { SettingsPanel } from "@/components/gpscribe/SettingsPanel";

// Import existing components
import { TranslationInterface } from "@/components/TranslationInterface";
import { MP3TranscriptionTest } from "@/components/MP3TranscriptionTest";
import { ConsultationHistory } from "@/components/ConsultationHistory";
import { PatientTranslationView } from "@/components/PatientTranslationView";
import AI4GPService from "@/components/AI4GPService";
import GPGenieVoiceAgent from "@/components/GPGenieVoiceAgent";

import { ActiveTab, ExpandDialog } from "@/types/gpscribe";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // Use extracted hooks
  const recording = useGPScribeRecording();
  const translation = useTranslationService();
  const guidance = useConsultationGuidance();
  const history = useConsultationHistory();
  const settings = useGPScribeSettings();
  const documents = useDocumentGeneration();
  
  // UI states
  const [activeTab, setActiveTab] = useState<ActiveTab>("consultation");
  const [showAIChat, setShowAIChat] = useState(false);
  const [expandDialog, setExpandDialog] = useState<ExpandDialog>({
    isOpen: false,
    title: "",
    content: ""
  });

  // Translation Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [msg, setMsg] = useState<any | null>(null);

  useEffect(() => {
    // Open modal when a translation is ready
    const unsubscribe = bus.on("TRANSLATION_READY", (m: any) => { 
      setMsg(m); 
      setModalOpen(true); 
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleClose = () => setModalOpen(false);

  // Clean transcript handler
  const handleCleanTranscript = async () => {
    if (!recording.transcript.trim()) {
      toast.error("No transcript to clean");
      return;
    }

    try {
      recording.setIsCleaningTranscript(true);
      
      const { data, error } = await supabase.functions.invoke('clean-transcript', {
        body: { transcript: recording.transcript }
      });

      if (error) throw error;

      recording.setCleanedTranscript(data.cleanedTranscript || recording.transcript);
      toast.success("Transcript cleaned successfully");
    } catch (error) {
      console.error('Clean transcript error:', error);
      toast.error('Failed to clean transcript');
    } finally {
      recording.setIsCleaningTranscript(false);
    }
  };

  // Generate summary handler
  const handleGenerateSummary = () => {
    documents.generateSummary(
      recording.transcript,
      settings.outputLevel,
      settings.showSnomedCodes,
      settings.formatForEmis,
      settings.formatForSystmOne,
      settings.consultationType
    );
  };

  // Generate referral letter handler
  const handleGenerateReferralLetter = () => {
    documents.generateReferralLetter(recording.transcript, settings.consultationType);
  };

  // Expand dialog handlers
  const handleExpandContent = (title: string, content: string) => {
    setExpandDialog({
      isOpen: true,
      title,
      content
    });
  };

  const handleCloseExpandDialog = () => {
    setExpandDialog({
      isOpen: false,
      title: "",
      content: ""
    });
  };

  // AI Chat handler
  const handleAIChatClick = () => {
    setShowAIChat(true);
  };

  // Edit content handlers
  const handleEditContentChange = (field: keyof typeof documents.editContent, value: string) => {
    documents.setEditContent(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Check authentication
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-background overflow-x-hidden">
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 max-w-6xl pb-28 sm:pb-6 mobile-container" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}>
        
        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)} className="w-full">
          <TabNavigation 
            activeTab={activeTab} 
            onTabChange={setActiveTab} 
            isMobile={isMobile}
          />

          {/* AI Chat Display in White Box */}
          {showAIChat && (
            <div className="mt-6 bg-card rounded-lg border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">GP Genie</h3>
                <button
                  onClick={() => setShowAIChat(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ✕
                </button>
              </div>
              <GPGenieVoiceAgent />
            </div>
          )}

          {/* Consultation Tab */}
          <TabsContent value="consultation" className="space-y-6 mt-6">
            <RecordingControls
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
            />
          </TabsContent>

          {/* Translation Tab */}
          <TabsContent value="translation" className="space-y-6 mt-6">
            <TranslationInterface
              transcript={recording.transcript}
              isRecording={recording.isRecording}
              onLanguageChange={translation.setTranslationLanguage}
            />
            <PatientTranslationView
              selectedLanguage={translation.translationLanguage}
              languageName={translation.translationLanguage !== 'none' ? 'Selected Language' : 'No Translation'}
              languageFlag={translation.translationLanguage !== 'none' ? '🌐' : '🚫'}
              isRecording={recording.isRecording}
              isMuted={translation.isMuted}
              onMuteToggle={() => translation.setIsMuted(!translation.isMuted)}
              realtimeTranscripts={recording.realtimeTranscripts}
            />
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6 mt-6">
            <SummaryPanel
              transcript={recording.transcript}
              isGenerating={documents.isGenerating}
              gpSummary={documents.gpSummary}
              fullNote={documents.fullNote}
              patientCopy={documents.patientCopy}
              traineeFeedback={documents.traineeFeedback}
              referralLetter={documents.referralLetter}
              editStates={documents.editStates}
              editContent={documents.editContent}
              expandDialog={expandDialog}
              onGenerateSummary={handleGenerateSummary}
              onGenerateReferralLetter={handleGenerateReferralLetter}
              onStartEdit={documents.startEdit}
              onCancelEdit={documents.cancelEdit}
              onSaveEdit={documents.saveEdit}
              onEditContentChange={handleEditContentChange}
              onExportPDF={documents.exportToPDF}
              onExportWord={documents.exportToWord}
              onExpandContent={handleExpandContent}
              onCloseExpandDialog={handleCloseExpandDialog}
            />
          </TabsContent>

          {/* Guidance Tab */}
          <TabsContent value="guidance" className="space-y-6 mt-6">
            <div className="text-center text-muted-foreground">
              <p>AI guidance features coming soon</p>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6 mt-6">
            <SettingsPanel
              consultationType={settings.consultationType}
              outputLevel={settings.outputLevel}
              showSnomedCodes={settings.showSnomedCodes}
              formatForEmis={settings.formatForEmis}
              formatForSystmOne={settings.formatForSystmOne}
              tickerEnabled={settings.tickerEnabled}
              showTranscriptTimestamps={settings.showTranscriptTimestamps}
              onConsultationTypeChange={settings.setConsultationType}
              onOutputLevelChange={settings.setOutputLevel}
              onShowSnomedCodesChange={settings.setShowSnomedCodes}
              onFormatForEmisChange={settings.setFormatForEmis}
              onFormatForSystmOneChange={settings.setFormatForSystmOne}
              onTickerEnabledChange={settings.setTickerEnabled}
              onShowTranscriptTimestampsChange={settings.setShowTranscriptTimestamps}
              onSaveSettings={settings.saveUserSettings}
              onResetSettings={settings.resetSettings}
            />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6 mt-6">
            <ConsultationHistory />
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-6 mt-6">
            <GPGenieVoiceAgent />
          </TabsContent>

        </Tabs>

        {/* Translation Modal */}
        {msg && (
          <PatientTranslationModal
            isOpen={modalOpen}
            onClose={handleClose}
            onAck={(id) => bus.emit("TRANSLATION_ACK", { id })}
            onBack={(id) => bus.emit("TRANSLATION_BACK", { id })}
            onPlay={(id) => bus.emit("TRANSLATION_PLAY", { id })}
            onPause={(id) => bus.emit("TRANSLATION_PAUSE", { id })}
            messageId={msg.messageId}
            sourceLang={msg.sourceLang}
            targetLang={msg.targetLang}
            originalText={msg.originalText}
            translatedText={msg.translatedText}
            audioUrl={msg.audioUrl}
            isStreaming={msg.isStreaming}
          />
        )}

        {/* Test Button (temporary) */}
        <button
          onClick={() => {
            const testPhrases = [
              {
                messageId: "demo1",
                sourceLang: "en",
                targetLang: "bn",
                originalText: "Hello, how are you feeling today?",
                translatedText: "হ্যালো, আজ আপনি কেমন অনুভব করছেন?",
                isStreaming: false
              },
              {
                messageId: "demo2", 
                sourceLang: "en",
                targetLang: "bn",
                originalText: "Can you describe your symptoms?",
                translatedText: "আপনি কি আপনার লক্ষণগুলি বর্ণনা করতে পারেন?",
                isStreaming: false
              },
              {
                messageId: "demo3",
                sourceLang: "en", 
                targetLang: "bn",
                originalText: "Let me examine you now.",
                translatedText: "এখন আমি আপনাকে পরীক্ষা করব।",
                isStreaming: false
              },
              {
                messageId: "demo4",
                sourceLang: "en",
                targetLang: "bn", 
                originalText: "Please take this medication twice daily.",
                translatedText: "অনুগ্রহ করে এই ওষুধটি দিনে দুইবার খান।",
                isStreaming: false
              }
            ];

            // Emit phrases in sequence with delays
            testPhrases.forEach((phrase, index) => {
              setTimeout(() => {
                bus.emit("TRANSLATION_READY", phrase);
              }, index * 3000); // 3 second intervals
            });
          }}
          className="fixed bottom-4 right-4 px-3 py-2 rounded-lg border bg-card text-card-foreground hover:bg-accent transition-colors"
        >
          Test Auto-Advance Translation
        </button>
      </div>
    </div>
  );
};

export default Index;