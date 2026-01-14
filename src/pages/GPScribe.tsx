import { useState, useEffect } from "react";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { 
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronUp } from "lucide-react";
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
import { useDualTranscription } from "@/hooks/useDualTranscription";

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
import { UnifiedDocumentEmailInterface } from "@/components/UnifiedDocumentEmailInterface";
import { GenerateNotesButton } from "@/components/gpscribe/GenerateNotesButton";
import GPGenieVoiceAgent from "@/components/GPGenieVoiceAgent";
import { DualRecordingControls } from '@/components/DualRecordingControls';
import { AssemblyRealtimeTicker } from '@/components/AssemblyRealtimeTicker';

import { ActiveTab, ExpandDialog } from "@/types/gpscribe";
import { ConsultationExample } from "@/data/consultationExamples";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // Patient language state
  const [patientLanguage, setPatientLanguage] = useState('english');
  
  // Use extracted hooks
  const settings = useGPScribeSettings();
  const recording = useGPScribeRecording(settings.selectedMicrophoneId);
  const translation = useTranslationService();
  const guidance = useConsultationGuidance();
  const history = useConsultationHistory();
  // settings already defined above
  const documents = useDocumentGeneration();
  const dualTranscription = useDualTranscription();
  
  // UI states
  const [activeTab, setActiveTab] = useState<ActiveTab>("consultation");
  const [showAIChat, setShowAIChat] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [exampleData, setExampleData] = useState<{
    title?: string;
    type?: string;
    duration?: string;
    summary?: string;
    patientCopy?: string;
    referralLetter?: string;
    aiReview?: string;
  } | null>(null);
  const [expandDialog, setExpandDialog] = useState<ExpandDialog>({
    isOpen: false,
    title: "",
    content: ""
  });
  const [pendingTabSwitch, setPendingTabSwitch] = useState(false);

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
      settings.consultationType,
      patientLanguage // Add patient language parameter
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
    // Set example data for the SOAP UI
    setExampleData({
      title: example.title,
      type: example.type,
      duration: example.duration,
      summary: example.summary,
      patientCopy: example.patientCopy,
      referralLetter: example.referralLetter,
      aiReview: example.aiReview
    });
    
    // Keep existing functionality for backward compatibility
    recording.setTranscript(example.transcript);
    documents.setGpSummary(example.summary);
    documents.setGpShorthand(createGpShorthand(example.summary));
    documents.setStandardDetail(createStandardDetail(example.summary));
    documents.setPatientCopy(example.patientCopy);
    documents.setTraineeFeedback(example.aiReview);
    if (example.referralLetter) {
      documents.setReferralLetter(example.referralLetter);
    }
    toast.success(`Loaded example: ${example.title}`);
    
    // Set flag to trigger tab switch after transcript is confirmed set
    setPendingTabSwitch(true);
  };

  // Monitor transcript and switch to summary tab once it's confirmed loaded
  useEffect(() => {
    if (pendingTabSwitch && recording.transcript.trim()) {
      setActiveTab("summary");
      setPendingTabSwitch(false);
    }
  }, [pendingTabSwitch, recording.transcript]);

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
    <div className="min-h-screen bg-gradient-background mobile-container safe-area-top safe-area-bottom">
      <SEO 
        title="GPScribe | AI Consultation Notes & Recording | NoteWell AI"
        description="AI-powered consultation transcription and SOAP note generation for GP practices. Real-time recording, patient summaries, and clinical documentation for NHS primary care."
        canonical="https://www.gpnotewell.co.uk/gp-scribe"
        keywords="GP consultation notes, AI medical transcription, SOAP notes, consultation recording, clinical documentation, NHS GP software"
      />
      <Header onNewMeeting={() => {}} />
      
      <div className="container mx-auto px-2 py-2 sm:px-4 sm:py-6 lg:py-8 space-y-3 sm:space-y-6 max-w-6xl mobile-scroll">
        {/* Mobile Quick Actions Drawer */}
        {isMobile && (
          <Drawer open={showMobileMenu} onOpenChange={setShowMobileMenu}>
            <DrawerTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="fixed top-20 right-4 z-50 bg-background/95 backdrop-blur-sm border-primary/20 mobile-touch-target"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[80vh] mobile-scroll">
              <DrawerHeader>
                <DrawerTitle>Quick Actions</DrawerTitle>
                <DrawerDescription>Access GP Scribe features</DrawerDescription>
              </DrawerHeader>
              <div className="p-4 space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start mobile-touch-target"
                  onClick={() => {
                    setActiveTab("consultation");
                    setShowMobileMenu(false);
                  }}
                >
                  Start Recording
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start mobile-touch-target"
                  onClick={() => {
                    setActiveTab("summary");
                    setShowMobileMenu(false);
                  }}
                >
                  View Summary
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start mobile-touch-target"
                  onClick={() => {
                    setActiveTab("examples");
                    setShowMobileMenu(false);
                  }}
                >
                  Load Examples
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start mobile-touch-target"
                  onClick={() => {
                    setShowAIChat(true);
                    setShowMobileMenu(false);
                  }}
                >
                  GP Genie AI
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        )}
        
        {/* Tab Navigation - Sticky on Mobile */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ActiveTab)} className="w-full">
          <div className={`${isMobile ? 'sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b pb-2 mb-4 safe-area-left safe-area-right' : ''}`}>
            <TabNavigation 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
              isMobile={isMobile}
            />
          </div>

          {/* AI Chat Display - Drawer on Mobile */}
          {showAIChat && isMobile ? (
            <Drawer open={showAIChat} onOpenChange={setShowAIChat}>
              <DrawerContent className="max-h-[90vh] mobile-scroll">
                <DrawerHeader>
                  <DrawerTitle>GP Genie AI Assistant</DrawerTitle>
                  <DrawerDescription>Your AI consultation assistant</DrawerDescription>
                </DrawerHeader>
                <div className="p-4 overflow-y-auto ios-momentum-scroll">
                  <GPGenieVoiceAgent />
                </div>
              </DrawerContent>
            </Drawer>
          ) : showAIChat && !isMobile ? (
            <div className="mt-6 bg-card rounded-lg border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">GP Genie</h3>
                <button
                  onClick={() => setShowAIChat(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors mobile-touch-target"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <GPGenieVoiceAgent />
            </div>
          ) : null}

          {/* Consultation Tab */}
          <TabsContent value="consultation" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'}`}>
            <div className={`${isMobile ? 'min-h-0 flex-1' : ''}`}>
            <RecordingControls
              isRecording={dualTranscription.state.isRecording || recording.isRecording}
              isPaused={recording.isPaused}
              duration={recording.duration}
              connectionStatus={recording.connectionStatus}
              wordCount={dualTranscription.state.isRecording ? 
                (dualTranscription.state.primarySource === 'assembly' ? dualTranscription.state.assemblyWordCount : dualTranscription.state.whisperWordCount)
                : recording.wordCount}
              currentConfidence={recording.currentConfidence}
              formatDuration={recording.formatDuration}
              transcript={dualTranscription.state.primarySource === 'assembly' ? dualTranscription.state.assemblyTranscript : recording.transcript}
              realtimeTranscripts={recording.realtimeTranscripts}
              onStartRecording={() => {
                // Use dual transcription if enabled, otherwise use main recording
                if (dualTranscription.state.assemblyEnabled || dualTranscription.state.whisperEnabled) {
                  dualTranscription.startDualTranscription();
                } else {
                  recording.startRecording();
                }
              }}
              onStopRecording={() => {
                if (dualTranscription.state.isRecording) {
                  dualTranscription.stopDualTranscription();
                } else {
                  recording.stopRecording(navigate);
                }
              }}
              onPauseRecording={recording.pauseRecording}
              onResumeRecording={recording.resumeRecording}
              onImportTranscript={(transcript) => {
                console.log("Importing transcript for testing:", transcript.substring(0, 100) + "...");
                recording.setTranscript(transcript);
                // Auto-navigate to summary tab to see generated notes
                setActiveTab("summary");
                toast.success("Transcript imported! Check the Summary tab for generated notes.");
              }}
              onResetConsultation={() => {
                console.log("Starting new consultation - clearing all data");
                recording.clearTranscript();
                documents.clearAllContent();
                guidance.clearGuidance();
                history.clearConsultation();
                // Reset dual transcription state
                dualTranscription.stopDualTranscription();
                toast.success("New consultation started");
              }}
            />

            {/* Dual Transcription Controls */}
            <DualRecordingControls
              state={dualTranscription.state}
              onStart={dualTranscription.startDualTranscription}
              onStop={dualTranscription.stopDualTranscription}
              onToggleService={dualTranscription.toggleService}
              onSetPrimarySource={dualTranscription.setPrimarySource}
            />

            {/* Assembly AI Live Transcript Card */}
            <AssemblyRealtimeTicker
              transcript={dualTranscription.state.assemblyTranscript}
              status={dualTranscription.state.assemblyStatus}
              confidence={dualTranscription.state.assemblyConfidence}
              isEnabled={dualTranscription.state.assemblyEnabled}
            />

            {/* Transcript Panel with Dual Transcription Support */}
            <TranscriptPanel
              transcript={dualTranscription.state.primarySource === 'assembly' ? dualTranscription.state.assemblyTranscript : 
                         dualTranscription.state.isRecording ? dualTranscription.state.whisperTranscript : recording.transcript}
              realtimeTranscripts={recording.realtimeTranscripts.map(t => t.text)}
              cleanedTranscript={recording.cleanedTranscript}
              isCleaningTranscript={recording.isCleaningTranscript}
              isRecording={recording.isRecording || dualTranscription.state.isRecording}
              // Dual transcription props
              assemblyTranscript={dualTranscription.state.assemblyTranscript}
              assemblyStatus={dualTranscription.state.assemblyStatus}
              assemblyConfidence={dualTranscription.state.assemblyConfidence}
              assemblyEnabled={dualTranscription.state.assemblyEnabled}
              primarySource={dualTranscription.state.primarySource}
              assemblyChunks={dualTranscription.state.assemblyChunks}
              whisperChunks={dualTranscription.state.whisperChunks}
              assemblyWordCount={dualTranscription.state.assemblyWordCount}
              whisperWordCount={dualTranscription.state.whisperWordCount}
              onTranscriptChange={(newTranscript) => {
                recording.setTranscript(newTranscript);
                recording.setHasUnsavedEdits(true); // Mark as having unsaved edits
              }}
              onCleanTranscript={handleCleanTranscript}
              onClearTranscript={() => {
                recording.clearTranscript();
                recording.setHasUnsavedEdits(false); // Clear unsaved edits flag
              }}
               onPrimarySourceChange={dualTranscription.setPrimarySource}
             />
            </div>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'} ${isMobile ? 'pb-20' : ''}`}>
            <SummaryPanel
              transcript={recording.transcript}
              isGenerating={documents.isGenerating}
              gpSummary={documents.gpSummary}
              gpShorthand={documents.gpShorthand}
              standardDetail={documents.standardDetail}
              fullNote={documents.fullNote}
              patientCopy={documents.patientCopy}
              traineeFeedback={documents.traineeFeedback}
              referralLetter={documents.referralLetter}
              editStates={documents.editStates}
              editContent={documents.editContent}
              expandDialog={expandDialog}
              recordingDuration={recording.formatDuration(recording.duration)}
              patientLanguage={patientLanguage}
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
              onUpdateMainSummary={handleUpdateMainSummary}
              onPatientLanguageChange={setPatientLanguage}
            />
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'} ${isMobile ? 'pb-20' : ''}`}>
            <div className={`${isMobile ? 'h-[calc(100vh-200px)] overflow-y-auto ios-momentum-scroll' : ''}`}>
              <ExamplesPanel onLoadExample={handleLoadExample} />
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'} ${isMobile ? 'pb-20' : ''}`}>
            <div className={`${isMobile ? 'h-[calc(100vh-200px)] overflow-y-auto ios-momentum-scroll' : ''}`}>
              <ConsultationHistory />
            </div>
          </TabsContent>

          {/* Document & Email Translation Tab */}
          <TabsContent value="ai4gp" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'} ${isMobile ? 'pb-20' : ''}`}>
            <div className={`${isMobile ? 'h-[calc(100vh-200px)] overflow-y-auto ios-momentum-scroll' : ''}`}>
              <UnifiedDocumentEmailInterface />
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'} ${isMobile ? 'pb-20' : ''}`}>
            <div className={`${isMobile ? 'h-[calc(100vh-200px)] overflow-y-auto ios-momentum-scroll' : ''}`}>
              <GPGenieVoiceAgent />
            </div>
          </TabsContent>

          {/* Settings Tab - Added back */}
          <TabsContent value="settings" className={`space-y-4 sm:space-y-6 ${isMobile ? 'mt-2' : 'mt-6'} ${isMobile ? 'pb-20' : ''}`}>
            <div className="space-y-6">
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
            </div>
          </TabsContent>

        </Tabs>

        {/* Mobile Bottom Safe Area */}
        {isMobile && <div className="h-20 safe-area-bottom" />}

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