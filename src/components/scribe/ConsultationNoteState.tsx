import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsultationNote, ConsultationType, ConsultationViewMode, CONSULTATION_TYPE_LABELS, SOAPNote, HeidiNote, ScribeEditStates, HeidiEditStates, ScribeSettings, PatientContext } from "@/types/scribe";
import { SOAPNoteEditor } from "./SOAPNoteEditor";
import { HeidiNoteEditor } from "./HeidiNoteEditor";
import { NarrativeClinicalNoteView } from "./NarrativeClinicalNoteView";
import { EmisNoteView } from "./EmisNoteView";
import { AgeingWellView } from "./AgeingWellView";
import { ReferralWorkspace } from "./ReferralWorkspace";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { QuickActionsBar } from "./QuickActionsBar";
import { Clock, FileCheck, Stethoscope, Shield, List, Monitor, Send, ClipboardList, FileText, User, Loader2, Check, AlertCircle, Heart } from "lucide-react";
import { SystmOneIcon } from "@/components/icons/SystmOneIcon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ConsultationNoteStateProps {
  consultationNote: ConsultationNote;
  consultationType: ConsultationType;
  duration: string;
  wordCount: number;
  settings: ScribeSettings;
  // SOAP editing (legacy)
  editStates: ScribeEditStates;
  editContent: Record<keyof SOAPNote, string>;
  onCopySection: (section: keyof SOAPNote) => void;
  onCopyAll: () => void;
  onStartEdit: (section: keyof SOAPNote) => void;
  onCancelEdit: (section: keyof SOAPNote) => void;
  onSaveEdit: (section: keyof SOAPNote) => void;
  onEditContentChange: (section: keyof SOAPNote, content: string) => void;
  // Heidi editing
  heidiEditStates?: HeidiEditStates;
  heidiEditContent?: Record<keyof HeidiNote, string>;
  onCopyHeidiSection?: (section: keyof HeidiNote) => void;
  onStartHeidiEdit?: (section: keyof HeidiNote) => void;
  onCancelHeidiEdit?: (section: keyof HeidiNote) => void;
  onSaveHeidiEdit?: (section: keyof HeidiNote) => void;
  onHeidiEditContentChange?: (section: keyof HeidiNote, content: string) => void;
  // Actions
  onSaveConsultation: () => void;
  onNewConsultation: () => void;
  onDiscard?: () => void;
  onRegenerate?: () => void;
  onExportPDF?: () => void;
  onExportWord?: () => void;
  // View mode
  viewMode?: ConsultationViewMode;
  onViewModeChange?: (mode: ConsultationViewMode) => void;
  onShowNotMentionedChange?: (show: boolean) => void;
  // Narrative clinical editing
  onNarrativeSectionChange?: (sectionKey: string, newContent: string) => void;
  consultationId?: string;
  // Save state
  isSaving?: boolean;
  isSaved?: boolean;
  // Referral data
  transcript?: string;
  userId?: string;
  patientContext?: PatientContext;
}

export const ConsultationNoteState = ({
  consultationNote,
  consultationType,
  duration,
  wordCount,
  settings,
  editStates,
  editContent,
  onCopySection,
  onCopyAll,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditContentChange,
  heidiEditStates,
  heidiEditContent,
  onCopyHeidiSection,
  onStartHeidiEdit,
  onCancelHeidiEdit,
  onSaveHeidiEdit,
  onHeidiEditContentChange,
  onSaveConsultation,
  onNewConsultation,
  onDiscard,
  onRegenerate,
  onExportPDF,
  onExportWord,
  viewMode = 'soap',
  onViewModeChange,
  onShowNotMentionedChange,
  onNarrativeSectionChange,
  consultationId,
  isSaving = false,
  isSaved = false,
  transcript,
  userId,
  patientContext
}: ConsultationNoteStateProps) => {
  const isMobile = useIsMobile();

  // Determine which format to display
  const useHeidiFormat = consultationNote.noteFormat === 'heidi' && 
    consultationNote.heidiNote && 
    heidiEditStates && 
    heidiEditContent &&
    onCopyHeidiSection &&
    onStartHeidiEdit &&
    onCancelHeidiEdit &&
    onSaveHeidiEdit &&
    onHeidiEditContentChange;

  return (
    <div className="space-y-4 pb-24">
      {/* Header with Metadata */}
      <Card>
        <CardHeader className={`pb-3 ${isMobile ? 'px-3 py-4' : ''}`}>
          <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between flex-wrap gap-3'}`}>
            <div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-4'}`}>
              <div className={`rounded-full bg-green-100 dark:bg-green-900/30 ${isMobile ? 'p-2' : 'p-3'}`}>
                <FileCheck className={`text-green-600 dark:text-green-400 ${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
              </div>
              <div>
                <CardTitle className={`flex items-center gap-2 flex-wrap ${isMobile ? 'text-base' : 'text-lg'}`}>
                  {isMobile ? 'Complete' : 'Consultation Complete'}
                  {/* Save Status Badge */}
                  {isSaving && (
                    <Badge variant="secondary" className="text-xs font-normal gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </Badge>
                  )}
                  {isSaved && !isSaving && (
                    <Badge className="text-xs font-normal gap-1 bg-green-600 hover:bg-green-600">
                      <Check className="h-3 w-3" />
                      Saved
                    </Badge>
                  )}
                  {!isSaved && !isSaving && (
                    <Badge variant="destructive" className="text-xs font-normal gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Not Saved
                    </Badge>
                  )}
                  {useHeidiFormat && (
                    <Badge variant="secondary" className="text-xs font-normal gap-1">
                      <Shield className="h-3 w-3" />
                      {isMobile ? 'Safe' : 'Anti-Hallucination'}
                    </Badge>
                  )}
                </CardTitle>
                {patientContext ? (
                  <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'} flex items-center gap-1.5`}>
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium">{patientContext.name}</span>
                    <span className="text-muted-foreground/60">|</span>
                    <span>NHS: {patientContext.nhsNumber}</span>
                    {patientContext.dateOfBirth && (
                      <>
                        <span className="text-muted-foreground/60">|</span>
                        <span>DOB: {patientContext.dateOfBirth}</span>
                      </>
                    )}
                  </p>
                ) : (
                  <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    Review and edit your notes below
                  </p>
                )}
              </div>
            </div>
            
            <div className={`flex items-center text-sm text-muted-foreground flex-wrap ${isMobile ? 'gap-2' : 'gap-4'}`}>
              <div className="flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4" />
                <span>{CONSULTATION_TYPE_LABELS[consultationType]}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{duration}</span>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onViewModeChange?.('transcript')}
                      className="hover:text-primary hover:underline transition-colors cursor-pointer"
                    >
                      {wordCount} words
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">View full transcript</TooltipContent>
                </Tooltip>
                {onViewModeChange && (
                  <>
                    <span className="text-muted-foreground/40">|</span>
                    <div className="flex items-center gap-0.5">
                      {/* Narrative Clinical View */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onViewModeChange('narrativeClinical')}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              viewMode === 'narrativeClinical' 
                                ? "text-primary bg-primary/10" 
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            aria-label="Narrative Clinical"
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Narrative Clinical</TooltipContent>
                      </Tooltip>
                      {/* TPP SystmOne (Auto-Optimised) */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onViewModeChange('systmone')}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              viewMode === 'systmone' 
                                ? "text-primary bg-primary/10" 
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            aria-label="TPP SystmOne (Optimised)"
                          >
                            <SystmOneIcon size="sm" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">TPP SystmOne (Auto-Optimised)</TooltipContent>
                      </Tooltip>
                      {/* EMIS View */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onViewModeChange('emis')}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              viewMode === 'emis' 
                                ? "text-primary bg-primary/10" 
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            aria-label="EMIS View"
                          >
                            <Monitor className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">EMIS View</TooltipContent>
                      </Tooltip>
                      {/* Ageing Well */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onViewModeChange('ageingWell')}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              viewMode === 'ageingWell' 
                                ? "text-primary bg-primary/10" 
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            aria-label="Ageing Well MDT"
                          >
                            <Heart className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Ageing Well MDT (SystmOne)</TooltipContent>
                      </Tooltip>
                      
                      {/* Spacer */}
                      <span className="w-2" />
                      
                      {/* Structured View (SOAP) */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onViewModeChange('soap')}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              viewMode === 'soap' 
                                ? "text-primary bg-primary/10" 
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            aria-label="Structured View (SOAP)"
                          >
                            <List className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Structured View (SOAP)</TooltipContent>
                      </Tooltip>
                      
                      {/* Spacer */}
                      <span className="w-2" />
                      
                      {/* Patient Letter */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => onViewModeChange('patient')}
                            className={cn(
                              "p-1.5 rounded-md transition-colors",
                              viewMode === 'patient' 
                                ? "text-primary bg-primary/10" 
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                            aria-label="Patient Letter"
                          >
                            <User className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Patient Letter</TooltipContent>
                      </Tooltip>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <QuickActionsBar
            emrFormat={settings.emrFormat}
            onCopyAll={onCopyAll}
            onSave={onSaveConsultation}
            onNewConsultation={onNewConsultation}
            onDiscard={onDiscard}
            onRegenerate={onRegenerate}
            onExportPDF={onExportPDF}
            onExportWord={onExportWord}
            isSaving={isSaving}
            isSaved={isSaved}
            wordCount={wordCount}
          />
        </CardContent>
      </Card>

      {/* Notes Editor, Referral Workspace, or Transcript */}
      {viewMode === 'referral' ? (
        <div className={isMobile ? 'h-[calc(100vh-320px)]' : 'min-h-[500px]'}>
          <ReferralWorkspace
            transcript={transcript}
            notes={useHeidiFormat ? consultationNote.heidiNote : consultationNote.soapNote}
            consultationType={consultationType}
            userId={userId}
            patientContext={patientContext ? {
              name: patientContext.name,
              dob: patientContext.dateOfBirth,
              nhsNumber: patientContext.nhsNumber
            } : undefined}
          />
        </div>
      ) : viewMode === 'transcript' ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              Full Transcript
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className={isMobile ? 'h-[calc(100vh-300px)]' : 'h-[calc(100vh-380px)] max-h-[800px]'}>
              <TranscriptDisplay transcript={transcript || ''} />
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className={isMobile ? 'h-[calc(100vh-320px)]' : ''}>
        {viewMode === 'narrativeClinical' ? (
            <NarrativeClinicalNoteView
              soapNote={consultationNote.soapNote}
              heidiNote={consultationNote.heidiNote}
              showNotMentioned={settings.showNotMentioned}
              onShowNotMentionedChange={onShowNotMentionedChange}
              editable={true}
              onSectionChange={onNarrativeSectionChange}
              consultationId={consultationId}
              isSystmOneOptimised={false}
              patientContext={patientContext}
            />
          ) : viewMode === 'systmone' ? (
            <NarrativeClinicalNoteView
              soapNote={consultationNote.soapNote}
              heidiNote={consultationNote.systmOneNote || consultationNote.heidiNote}
              showNotMentioned={settings.showNotMentioned}
              onShowNotMentionedChange={onShowNotMentionedChange}
              editable={false}
              consultationId={consultationId}
              isSystmOneOptimised={!!consultationNote.systmOneNote}
              patientContext={patientContext}
            />
          ) : viewMode === 'emis' ? (
            <EmisNoteView
              soapNote={consultationNote.soapNote}
              heidiNote={consultationNote.heidiNote}
              consultationType={consultationType}
              showNotMentioned={settings.showNotMentioned}
              onShowNotMentionedChange={onShowNotMentionedChange}
            />
          ) : viewMode === 'ageingWell' ? (
            <AgeingWellView
              soapNote={consultationNote.soapNote}
              heidiNote={consultationNote.heidiNote}
              showNotMentioned={settings.showNotMentioned}
              onShowNotMentionedChange={onShowNotMentionedChange}
              editable={true}
              onSectionChange={onNarrativeSectionChange}
              consultationId={consultationId}
              transcript={transcript}
              patientContext={patientContext}
            />
          ) : useHeidiFormat ? (
            <HeidiNoteEditor
              heidiNote={consultationNote.heidiNote!}
              editStates={heidiEditStates}
              editContent={heidiEditContent}
              onCopySection={onCopyHeidiSection}
              onStartEdit={onStartHeidiEdit}
              onCancelEdit={onCancelHeidiEdit}
              onSaveEdit={onSaveHeidiEdit}
              onEditContentChange={onHeidiEditContentChange}
            />
          ) : (
            <SOAPNoteEditor
              soapNote={consultationNote.soapNote}
              editStates={editStates}
              editContent={editContent}
              onCopySection={onCopySection}
              onStartEdit={onStartEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onEditContentChange={onEditContentChange}
            />
          )}
        </ScrollArea>
      )}

      {/* SNOMED Codes if available */}
      {consultationNote.snomedCodes && consultationNote.snomedCodes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Suggested SNOMED Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {consultationNote.snomedCodes.map((code, idx) => (
                <span 
                  key={idx}
                  className="px-2 py-1 bg-muted rounded text-xs font-mono"
                >
                  {code}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
