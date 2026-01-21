import { useState, useEffect } from "react";
import { SEO } from "@/components/SEO";
import { Header } from "@/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";

import { useScribeConsultation } from "@/hooks/useScribeConsultation";
import { useScribeHistory } from "@/hooks/useScribeHistory";
import { useScribeSettings } from "@/hooks/useScribeSettings";

import { ConsultationReadyState } from "@/components/scribe/ConsultationReadyState";
import { ConsultationRecordingState } from "@/components/scribe/ConsultationRecordingState";
import { ConsultationGeneratingState } from "@/components/scribe/ConsultationGeneratingState";
import { ConsultationNoteState } from "@/components/scribe/ConsultationNoteState";
import { ScribeSettingsPanel } from "@/components/scribe/ScribeSettingsPanel";
import { ScribeHistoryPanel } from "@/components/scribe/ScribeHistoryPanel";
import { ScribeImportPanel } from "@/components/scribe/ScribeImportPanel";
import { DictationPanel } from "@/components/scribe/DictationPanel";
import { MyAppointmentsTab } from "@/components/scribe/MyAppointmentsTab";

import { ScribeTab, SOAPNote, ConsultationNote, PatientContext } from "@/types/scribe";
import { Stethoscope, History, Settings, Upload, ScrollText, ChevronDown, CalendarDays } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from 'jspdf';
import { generateScribeWordDocument } from "@/utils/documentGenerators";
import { showToast } from "@/utils/toastWrapper";
import { supabase } from "@/integrations/supabase/client";

const Scribe = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const history = useScribeHistory();
  const consultation = useScribeConsultation(async (sessionId: string) => {
    // Callback when auto-save completes - refresh list and load the saved session
    await history.fetchSessions();
    await history.loadSession(sessionId);
    setActiveTab('history');
  });
  const settingsHook = useScribeSettings();
  
  const [activeTab, setActiveTab] = useState<ScribeTab>("consultation");
  const [practiceDetails, setPracticeDetails] = useState<{
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logoUrl?: string;
  } | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Fetch practice details for exports
  useEffect(() => {
    const fetchPracticeDetails = async () => {
      if (!user) return;
      
      try {
        const { data: practice } = await supabase
          .from('practice_details')
          .select('practice_name, address, phone, email, practice_logo_url, logo_url')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (practice) {
          setPracticeDetails({
            name: practice.practice_name || undefined,
            address: practice.address || undefined,
            phone: practice.phone || undefined,
            email: practice.email || undefined,
            logoUrl: practice.practice_logo_url || practice.logo_url || undefined
          });
        }
      } catch (error) {
        console.error('Failed to fetch practice details:', error);
      }
    };

    fetchPracticeDetails();
  }, [user]);

  // Handle loading session from history - stays on history tab to view session details
  const handleLoadSession = async (sessionId: string) => {
    await history.loadSession(sessionId);
    // Session is viewed within the history panel itself, no tab switch needed
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
      showToast.success("PDF exported successfully", { section: 'gpscribe' });
    } catch (error) {
      console.error('PDF export error:', error);
      showToast.error('Failed to export PDF', { section: 'gpscribe' });
    }
  };

  const handleExportWord = async () => {
    if (!consultation.consultationNote?.soapNote) return;
    
    const soap = consultation.consultationNote.soapNote;
    const content = `SUBJECTIVE (History)\n${soap.S}\n\nOBJECTIVE (Examination)\n${soap.O}\n\nASSESSMENT\n${soap.A}\n\nPLAN\n${soap.P}`;
    
    try {
      await generateScribeWordDocument({
        content,
        title: 'Consultation Notes',
        practiceName: practiceDetails?.name,
        practiceAddress: practiceDetails?.address,
        practicePhone: practiceDetails?.phone,
        practiceEmail: practiceDetails?.email,
        practiceLogoUrl: practiceDetails?.logoUrl
      });
      showToast.success("Word document exported successfully", { section: 'gpscribe' });
    } catch (error) {
      console.error('Word export error:', error);
      showToast.error('Failed to export Word document', { section: 'gpscribe' });
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
            <TabsList className={`grid w-full max-w-2xl mx-auto grid-cols-5 mb-6 ${isMobile ? 'h-14' : ''}`}>
              <TabsTrigger value="consultation" className={`gap-1.5 touch-manipulation ${isMobile ? 'flex-col py-2' : 'gap-2'}`}>
                <Stethoscope className={isMobile ? "h-5 w-5 shrink-0" : "h-5 w-5 shrink-0"} strokeWidth={2} />
                <span className={isMobile ? "text-xs" : "hidden sm:inline"}>
                  {isMobile ? "Consult" : "Consultation"}
                </span>
              </TabsTrigger>
              <TabsTrigger value="history" className={`gap-1.5 touch-manipulation ${isMobile ? 'flex-col py-2' : 'gap-2'}`}>
                <History className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                <span className={isMobile ? "text-xs" : "hidden sm:inline"}>History</span>
              </TabsTrigger>
              <TabsTrigger value="appointments" className={`gap-1.5 touch-manipulation ${isMobile ? 'flex-col py-2' : 'gap-2'}`}>
                <CalendarDays className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                <span className={isMobile ? "text-xs" : "hidden sm:inline"}>Appts</span>
              </TabsTrigger>
              <TabsTrigger value="transcript" className={`gap-1.5 touch-manipulation ${isMobile ? 'flex-col py-2' : 'gap-2'}`}>
                <ScrollText className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                <span className={isMobile ? "text-xs" : "hidden sm:inline"}>Dictate</span>
              </TabsTrigger>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer gap-1.5 touch-manipulation min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[auto] sm:px-4 ${isMobile ? 'flex-col py-2' : 'gap-2'} ${activeTab === 'settings' || activeTab === 'import' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/50'}`}>
                    <Settings className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
                    <span className={isMobile ? "text-xs" : "hidden sm:inline"}>Settings</span>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-50 bg-popover">
                  <DropdownMenuItem onClick={() => setActiveTab('settings')} className="gap-2 cursor-pointer">
                    <Settings className="h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab('import')} className="gap-2 cursor-pointer">
                    <Upload className="h-4 w-4" />
                    Import
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TabsList>

            <TabsContent value="consultation">
              {consultation.consultationState === 'ready' && (
                <ConsultationReadyState
                  consultationType={consultation.consultationType}
                  consultationCategory={consultation.consultationCategory}
                  patientConsent={consultation.patientConsent}
                  settings={consultation.settings}
                  patientContext={consultation.patientContext}
                  f2fAccompanied={consultation.f2fAccompanied}
                  onTypeChange={consultation.setConsultationType}
                  onCategoryChange={consultation.setConsultationCategory}
                  onF2fAccompaniedChange={consultation.setF2fAccompanied}
                  onConsentChange={consultation.setPatientConsent}
                  onPatientContextChange={consultation.setPatientContext}
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
                  heidiEditStates={consultation.heidiEditStates}
                  heidiEditContent={consultation.heidiEditContent}
                  onCopyHeidiSection={consultation.copyHeidiSection}
                  onStartHeidiEdit={consultation.startHeidiEdit}
                  onCancelHeidiEdit={consultation.cancelHeidiEdit}
                  onSaveHeidiEdit={consultation.saveHeidiEdit}
                  onHeidiEditContentChange={consultation.updateHeidiEditContent}
                  onSaveConsultation={async () => {
                    await consultation.saveConsultation();
                    // Refresh history after saving
                    history.fetchSessions();
                  }}
                  onNewConsultation={consultation.newConsultation}
                  onDiscard={consultation.newConsultation}
                  onRegenerate={consultation.regenerateNotes}
                  onExportPDF={handleExportPDF}
                  onExportWord={handleExportWord}
                  viewMode={consultation.viewMode}
                  onViewModeChange={consultation.setViewMode}
                  onShowNotMentionedChange={(show) => consultation.updateSetting('showNotMentioned', show)}
                  onIncludeNhsDobOnCopyChange={(include) => settingsHook.updateSetting('includeNhsDobOnCopy', include)}
                  isSaving={consultation.isSaving}
                  isSaved={consultation.isSaved}
                  transcript={consultation.transcript}
                  userId={user?.id}
                  patientContext={consultation.patientContext}
                  onNarrativeSectionChange={(sectionKey, content) => {
                    // Get the most recent consultation ID from history
                    const latestSession = history.sessions[0];
                    if (latestSession?.id) {
                      // Check if this is the optimisation complete signal
                      const isOptimisationComplete = sectionKey === '__systmone_optimised__';
                      if (isOptimisationComplete) {
                        consultation.markAsSystmOneOptimised(latestSession.id);
                      } else {
                        consultation.updateNarrativeSection(latestSession.id, sectionKey, content);
                      }
                    }
                  }}
                  consultationId={history.sessions[0]?.id}
                />
              )}
            </TabsContent>

            <TabsContent value="import">
              <ScribeImportPanel
                settings={settingsHook.settings}
                onNotesGenerated={(notes: ConsultationNote, transcript: string) => {
                  // Auto-save happens inside setImportedConsultation, which triggers the callback to navigate to history
                  consultation.setImportedConsultation(notes, transcript);
                }}
              />
            </TabsContent>

            <TabsContent value="appointments">
              <MyAppointmentsTab
                onStartConsultation={(patientContext) => {
                  consultation.setPatientContext(patientContext);
                  setActiveTab('consultation');
                }}
                onViewConsultation={async (consultationId) => {
                  await history.loadSession(consultationId);
                  setActiveTab('history');
                }}
              />
            </TabsContent>

            <TabsContent value="history">
              <ScribeHistoryPanel
                sessions={history.sessions}
                filteredSessions={history.filteredSessions}
                isLoading={history.isLoading}
                currentSession={history.currentSession}
                onLoadSession={handleLoadSession}
                onDeleteSession={history.deleteSession}
                onRefresh={history.fetchSessions}
                onClearCurrentSession={history.clearCurrentSession}
                settings={settingsHook.settings}
                onUpdateSetting={settingsHook.updateSetting}
                searchTerm={history.searchTerm}
                onSearchChange={history.setSearchTerm}
                dateFilter={history.dateFilter}
                onDateFilterChange={history.setDateFilter}
                categoryFilter={history.categoryFilter}
                onCategoryFilterChange={history.setCategoryFilter}
                userId={user?.id}
              />
            </TabsContent>

            <TabsContent value="transcript">
              <DictationPanel />
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
                isFinishing={consultation.isFinishing}
                transcript={consultation.transcript}
                realtimeTranscripts={consultation.realtimeTranscripts}
                showLiveTranscript={consultation.settings.showLiveTranscript}
                patientContext={consultation.patientContext}
                showPatientBanner={consultation.settings.showPatientBannerDuringRecording}
                contextFiles={consultation.contextFiles}
                minimalRecordingView={consultation.settings.minimalRecordingView}
                formatDuration={consultation.formatDuration}
                onPause={consultation.pauseRecording}
                onResume={consultation.resumeRecording}
                onFinish={consultation.finishConsultation}
                onCancel={consultation.cancelConsultation}
                onClearPatientContext={consultation.clearPatientContext}
                onAddContextFile={consultation.addContextFile}
                onRemoveContextFile={consultation.removeContextFile}
                // Audio source switching
                audioSourceMode={consultation.audioSourceMode}
                onAudioSourceChange={consultation.switchAudioSourceLive}
                isSwitchingAudioSource={consultation.isSwitchingAudioSource}
                micCaptured={consultation.micCaptured}
                systemAudioCaptured={consultation.systemAudioCaptured}
                // Chunk tracking
                chunks={consultation.chunks}
                chunkStats={consultation.chunkStats}
                onClearChunks={consultation.clearChunks}
                // Live preview (AssemblyAI real-time)
                livePreviewTranscript={consultation.livePreviewTranscript}
                livePreviewFullTranscript={consultation.livePreviewFullTranscript}
                livePreviewStatus={consultation.livePreviewStatus}
                livePreviewActive={consultation.livePreviewActive}
                livePreviewError={consultation.livePreviewError}
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
