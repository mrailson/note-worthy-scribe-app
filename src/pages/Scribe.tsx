import { useState } from "react";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

import { useScribeConsultation } from "@/hooks/useScribeConsultation";
import { useScribeHistory } from "@/hooks/useScribeHistory";
import { useScribeSettings } from "@/hooks/useScribeSettings";

import { ConsultationReadyState } from "@/components/scribe/ConsultationReadyState";
import { ConsultationRecordingState } from "@/components/scribe/ConsultationRecordingState";
import { ConsultationGeneratingState } from "@/components/scribe/ConsultationGeneratingState";
import { ConsultationNoteState } from "@/components/scribe/ConsultationNoteState";
import { ScribeSettingsPanel } from "@/components/scribe/ScribeSettingsPanel";
import { ScribeHistoryPanel } from "@/components/scribe/ScribeHistoryPanel";

import { ScribeTab, SOAPNote } from "@/types/scribe";
import { Stethoscope, History, Settings } from "lucide-react";
import jsPDF from 'jspdf';
import { generateWordDocument } from "@/utils/documentGenerators";
import { toast } from "sonner";

const Scribe = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const consultation = useScribeConsultation();
  const history = useScribeHistory();
  const settingsHook = useScribeSettings();
  
  const [activeTab, setActiveTab] = useState<ScribeTab>("consultation");

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Handle loading session from history
  const handleLoadSession = async (sessionId: string) => {
    const session = await history.loadSession(sessionId);
    if (session) {
      // For now, just show toast - sessions from history are view-only
      toast.info("Session loaded from history");
      setActiveTab("consultation");
    }
  };

  // Export functions
  const handleExportPDF = () => {
    if (!consultation.consultationNote?.soapNote) return;
    
    const soap = consultation.consultationNote.soapNote;
    const content = `SUBJECTIVE (History)\n${soap.S}\n\nOBJECTIVE (Examination)\n${soap.O}\n\nASSESSMENT\n${soap.A}\n\nPLAN\n${soap.P}`;
    
    try {
      const pdf = new jsPDF();
      const margin = 20;
      const lineHeight = 7;
      let y = margin;

      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Consultation Notes', margin, y);
      y += lineHeight * 2;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const lines = pdf.splitTextToSize(content, pdf.internal.pageSize.width - 2 * margin);
      
      lines.forEach((line: string) => {
        if (y + lineHeight > pdf.internal.pageSize.height - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += lineHeight;
      });

      pdf.save('consultation-notes.pdf');
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleExportWord = async () => {
    if (!consultation.consultationNote?.soapNote) return;
    
    const soap = consultation.consultationNote.soapNote;
    const content = `SUBJECTIVE (History)\n${soap.S}\n\nOBJECTIVE (Examination)\n${soap.O}\n\nASSESSMENT\n${soap.A}\n\nPLAN\n${soap.P}`;
    
    try {
      await generateWordDocument(content, 'Consultation Notes');
      toast.success("Word document exported successfully");
    } catch (error) {
      console.error('Word export error:', error);
      toast.error('Failed to export Word document');
    }
  };

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

  // Determine if we should show the main tabs or just the consultation flow
  const showMainTabs = consultation.consultationState === 'ready' || 
                       consultation.consultationState === 'review';

  return (
    <div className="min-h-screen bg-gradient-background mobile-container safe-area-top safe-area-bottom">
      <SEO 
        title="GP Scribe | AI Consultation Notes | NoteWell AI"
        description="AI-powered consultation scribe for GPs. Real-time transcription, automatic SOAP notes, and one-click EMR copy."
        canonical="https://www.gpnotewell.co.uk/scribe"
      />
      <Header onNewMeeting={() => consultation.newConsultation()} />
      
      <div className="container mx-auto px-2 py-2 sm:px-4 sm:py-6 lg:py-8 max-w-5xl">
        {/* Show tabs only when in ready or review state */}
        {showMainTabs ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ScribeTab)} className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-6">
              <TabsTrigger value="consultation" className="gap-2">
                <Stethoscope className="h-4 w-4" />
                <span className="hidden sm:inline">Consultation</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="consultation">
              {consultation.consultationState === 'ready' && (
                <ConsultationReadyState
                  consultationType={consultation.consultationType}
                  patientConsent={consultation.patientConsent}
                  settings={consultation.settings}
                  onTypeChange={consultation.setConsultationType}
                  onConsentChange={consultation.setPatientConsent}
                  onStart={consultation.startConsultation}
                  onOpenSettings={() => setActiveTab('settings')}
                />
              )}
              
              {consultation.consultationState === 'review' && consultation.consultationNote && (
                <ConsultationNoteState
                  consultationNote={consultation.consultationNote}
                  consultationType={consultation.consultationType}
                  duration={consultation.formatDuration(consultation.duration)}
                  wordCount={consultation.wordCount}
                  settings={consultation.settings}
                  editStates={consultation.editStates}
                  editContent={consultation.editContent}
                  onCopySection={(section) => consultation.copyToClipboard(section)}
                  onCopyAll={() => consultation.copyToClipboard()}
                  onStartEdit={consultation.startEdit}
                  onCancelEdit={consultation.cancelEdit}
                  onSaveEdit={consultation.saveEdit}
                  onEditContentChange={consultation.updateEditContent}
                  onSaveConsultation={consultation.saveConsultation}
                  onNewConsultation={consultation.newConsultation}
                  onExportPDF={handleExportPDF}
                  onExportWord={handleExportWord}
                />
              )}
            </TabsContent>

            <TabsContent value="history">
              <ScribeHistoryPanel
                sessions={history.sessions}
                isLoading={history.isLoading}
                currentSession={history.currentSession}
                onLoadSession={handleLoadSession}
                onDeleteSession={history.deleteSession}
                onRefresh={history.fetchSessions}
                onClearCurrentSession={history.clearCurrentSession}
              />
            </TabsContent>

            <TabsContent value="settings">
              <ScribeSettingsPanel
                settings={settingsHook.settings}
                onUpdateSetting={settingsHook.updateSetting}
                onSaveSettings={settingsHook.saveSettings}
                onResetSettings={settingsHook.resetSettings}
              />
            </TabsContent>
          </Tabs>
        ) : (
          // Recording or Generating state - full screen, no tabs
          <>
            {consultation.consultationState === 'recording' && (
              <ConsultationRecordingState
                duration={consultation.duration}
                wordCount={consultation.wordCount}
                connectionStatus={consultation.connectionStatus}
                consultationType={consultation.consultationType}
                isPaused={consultation.isPaused}
                transcript={consultation.transcript}
                realtimeTranscripts={consultation.realtimeTranscripts}
                showLiveTranscript={consultation.settings.showLiveTranscript}
                formatDuration={consultation.formatDuration}
                onPause={consultation.pauseRecording}
                onResume={consultation.resumeRecording}
                onFinish={consultation.finishConsultation}
                onCancel={consultation.cancelConsultation}
              />
            )}
            
            {consultation.consultationState === 'generating' && (
              <ConsultationGeneratingState
                duration={consultation.formatDuration(consultation.duration)}
                wordCount={consultation.wordCount}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Scribe;
