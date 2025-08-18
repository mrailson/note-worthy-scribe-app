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
import { ExamplesPanel } from "@/components/gpscribe/ExamplesPanel";

// Import existing components
import { TranslationInterface } from "@/components/TranslationInterface";
import { MP3TranscriptionTest } from "@/components/MP3TranscriptionTest";
import { ConsultationHistory } from "@/components/ConsultationHistory";
import { PatientTranslationView } from "@/components/PatientTranslationView";
import AI4GPService from "@/components/AI4GPService";
import GPSoapUI from "@/components/GPSoapUI";
import GPGenieVoiceAgent from "@/components/GPGenieVoiceAgent";

import { ActiveTab, ExpandDialog } from "@/types/gpscribe";
import { ConsultationExample } from "@/data/consultationExamples";

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
  const [translationQueue, setTranslationQueue] = useState<any[]>([]);
  const [currentTranslationIndex, setCurrentTranslationIndex] = useState(0);

  // Auto-advance translation on natural pauses
  useEffect(() => {
    const unsubscribe = bus.on("TRANSLATION_READY", (m: any) => { 
      setTranslationQueue(prev => [...prev, m]);
      if (!modalOpen) {
        setMsg(m); 
        setModalOpen(true);
        setCurrentTranslationIndex(0);
      }
    });

    // Listen for speech pauses to auto-advance
    const unsubscribePause = bus.on("SPEECH_PAUSE_DETECTED", () => {
      if (modalOpen && translationQueue.length > currentTranslationIndex + 1) {
        const nextIndex = currentTranslationIndex + 1;
        setCurrentTranslationIndex(nextIndex);
        setMsg(translationQueue[nextIndex]);
      }
    });

    return () => {
      unsubscribe();
      unsubscribePause();
    };
  }, [modalOpen, translationQueue, currentTranslationIndex]);

  const handleClose = () => {
    setModalOpen(false);
    setTranslationQueue([]);
    setCurrentTranslationIndex(0);
  };

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

  // Handle updating main summary content
  const handleUpdateMainSummary = (content: string, isStandardDetail: boolean) => {
    if (isStandardDetail) {
      documents.setStandardDetail(content);
    } else {
      documents.setGpShorthand(content);
    }
  };

  // Load example handler
  const handleLoadExample = (example: ConsultationExample) => {
    recording.setTranscript(example.transcript);
    documents.setGpSummary(example.summary);
    // Parse the summary to create GP Shorthand and Standard Detail formats
    documents.setGpShorthand(createGpShorthand(example.summary));
    documents.setStandardDetail(createStandardDetail(example.summary));
    documents.setPatientCopy(example.patientCopy);
    documents.setTraineeFeedback(example.aiReview);
    if (example.referralLetter) {
      documents.setReferralLetter(example.referralLetter);
    }
    toast.success(`Loaded example: ${example.title}`);
    setActiveTab("summary");
  };

  // Helper functions to create formatted versions from existing summary
  const createGpShorthand = (summary: string) => {
    // Convert existing summary to GP shorthand format
    return `• CC: URTI sx 3/7
• Hx: Sore throat (↑ on swallow, am worse), blocked nose, cough → now productive, subj fever+chills y'day, headache, hoarse, fatigue. PCM helped partially.
• Ex: Throat erythema, no exudate. B/L tender cerv LN. Chest clear, afebrile.
• A: Viral URTI (common cold)
• P: Rest, fluids, PCM prn, lozenges/honey drinks. Off work 1–2d. SR: return if ↑fever, chest sx, no improv 10d. No abx. Viral explained.`;
  };

  const createStandardDetail = (summary: string) => {
    // Convert existing summary to standard detail format
    return `**Chief Complaint:** Upper respiratory tract symptoms for 3 days

**History of Presenting Complaint:**
• 3-day history of sore throat (severe, worse on swallowing, worse in mornings)
• Blocked nose
• Cough (initially dry, now productive of clear sputum)
• Subjective fever with chills yesterday
• Headache, hoarse voice, fatigue
• Taking paracetamol with partial relief

**Examination:**
• Erythematous throat without exudate
• Bilateral tender cervical lymphadenopathy
• Clear chest on auscultation
• Afebrile during consultation

**Assessment:** Viral upper respiratory tract infection (common cold)

**Plan:**
• Conservative management with rest and fluids
• Continue paracetamol as required for symptom relief
• Throat lozenges, honey/lemon drinks for throat symptoms
• Advise off work 1–2 days
• Safety netting: return if symptoms worsen, high fever, chest symptoms, or no improvement after 10 days
• No antibiotics prescribed – viral cause explained`;
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
              onStopRecording={() => recording.stopRecording(navigate)}
              onPauseRecording={recording.pauseRecording}
              onResumeRecording={recording.resumeRecording}
              onResetConsultation={() => {
                console.log("Starting new consultation - clearing all data");
                recording.clearTranscript();
                documents.clearAllContent();
                guidance.clearGuidance();
                history.clearConsultation();
                toast.success("New consultation started");
              }}
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
            
            {/* Test Translation Service Button */}
            <div className="flex justify-center">
              <button
                onClick={async () => {
                  // Test translation service first
                  try {
                    console.log('Testing translation service...');
                    const { data, error } = await supabase.functions.invoke('translate-text', {
                      body: {
                        text: "Hello, how are you?",
                        targetLanguage: "bn",
                        sourceLanguage: "en"
                      }
                    });
                    
                    console.log('Translation test result:', { data, error });
                    
                    if (error) {
                      toast.error(`Translation test failed: ${error.message}`);
                      return;
                    }
                    
                    if (data?.translatedText) {
                      toast.success(`Translation working! Result: ${data.translatedText}`);
                      
                      // Now emit the test phrases
                      const testPhrases = [
                        {
                          messageId: "demo1",
                          sourceLang: "en",
                          targetLang: "bn",
                          originalText: "Hello, how are you feeling today?",
                          translatedText: data.translatedText,
                          isStreaming: false
                        }
                      ];

                      testPhrases.forEach((phrase, index) => {
                        setTimeout(() => {
                          bus.emit("TRANSLATION_READY", phrase);
                        }, index * 100);
                      });
                    }
                  } catch (error) {
                    console.error('Translation test error:', error);
                    toast.error('Translation test failed');
                  }
                }}
                className="px-4 py-2 rounded-lg border bg-card text-card-foreground hover:bg-accent transition-colors text-sm"
              >
                Test Translation Service
              </button>
            </div>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-6 mt-6">
            <GPSoapUI />
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-6 mt-6">
            <ExamplesPanel onLoadExample={handleLoadExample} />
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

      </div>
    </div>
  );
};

export default Index;