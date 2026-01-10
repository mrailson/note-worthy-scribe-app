import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsultationNote, ConsultationType, CONSULTATION_TYPE_LABELS, SOAPNote, ScribeEditStates, ScribeSettings } from "@/types/scribe";
import { SOAPNoteEditor } from "./SOAPNoteEditor";
import { QuickActionsBar } from "./QuickActionsBar";
import { Clock, FileCheck, Stethoscope } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

interface ConsultationNoteStateProps {
  consultationNote: ConsultationNote;
  consultationType: ConsultationType;
  duration: string;
  wordCount: number;
  settings: ScribeSettings;
  editStates: ScribeEditStates;
  editContent: Record<keyof SOAPNote, string>;
  onCopySection: (section: keyof SOAPNote) => void;
  onCopyAll: () => void;
  onStartEdit: (section: keyof SOAPNote) => void;
  onCancelEdit: (section: keyof SOAPNote) => void;
  onSaveEdit: (section: keyof SOAPNote) => void;
  onEditContentChange: (section: keyof SOAPNote, content: string) => void;
  onSaveConsultation: () => void;
  onNewConsultation: () => void;
  onExportPDF?: () => void;
  onExportWord?: () => void;
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
  onSaveConsultation,
  onNewConsultation,
  onExportPDF,
  onExportWord
}: ConsultationNoteStateProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4 pb-24">
      {/* Header with Metadata */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <FileCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Consultation Complete</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Review and edit your notes below
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4" />
                <span>{CONSULTATION_TYPE_LABELS[consultationType]}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{duration}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>{wordCount} words</span>
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
            onExportPDF={onExportPDF}
            onExportWord={onExportWord}
          />
        </CardContent>
      </Card>

      {/* SOAP Notes Editor */}
      <ScrollArea className={isMobile ? 'h-[calc(100vh-320px)]' : ''}>
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
      </ScrollArea>

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
