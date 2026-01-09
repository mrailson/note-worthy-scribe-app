import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import TranslationHistory from "@/components/TranslationHistory";
import { useTranslationHistory, TranslationSession } from "@/hooks/useTranslationHistory";
import {
  Mic,
  Mail,
  Database,
  RotateCcw,
  Download,
  Users,
  Clock,
  Languages,
  FileText,
  History as HistoryIcon,
} from "lucide-react";

interface Props {
  translations: any[];
  sessionStart: Date;
  sessions: TranslationSession[];
  currentSessionId: string | null | undefined;
  saveStatus: "idle" | "saving" | "saved" | "error";
  isSaving: boolean;
  onSave: () => void;
  onClear: () => void;
  onExportDOCX: () => void;
  onPatientExportDOCX: () => void;
  onOpenSaved: () => void;
  onDeleteTranslation?: (translationId: string) => void;
  onDeleteSelectedTranslations?: (translationIds: string[]) => void;
  onDeleteAllTranslations?: () => void;
}

export const HistorySubTabs: React.FC<Props> = ({
  translations,
  sessionStart,
  sessions,
  currentSessionId,
  saveStatus,
  isSaving,
  onSave,
  onClear,
  onExportDOCX,
  onPatientExportDOCX,
  onOpenSaved,
  onDeleteTranslation,
  onDeleteSelectedTranslations,
  onDeleteAllTranslations,
}) => {
  const navigate = useNavigate();

  return (
    <Tabs defaultValue="live-speech" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="live-speech" className="flex items-center gap-2">
          <Mic className="h-4 w-4" />
          Live Speech Translation
        </TabsTrigger>
        <TabsTrigger value="email-document" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email & Document Translation
        </TabsTrigger>
      </TabsList>

      <TabsContent value="live-speech" className="space-y-6 mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Live Speech Translations</h3>
          </div>
          {(translations.length > 0 || currentSessionId) && (
            <div className="flex gap-2">
              <Button
                onClick={onSave}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
                disabled={translations.length === 0 || isSaving}
              >
                <Database className="w-4 h-4" />
                {isSaving ? "Saving..." : translations.length > 0 ? "Save Now" : "Session Saved"}
              </Button>
              <Button onClick={onClear} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Clear History
              </Button>
              <Button onClick={onExportDOCX} variant="default" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export to DOCX
              </Button>
              <Button onClick={onPatientExportDOCX} variant="secondary" size="sm">
                <Users className="w-4 h-4 mr-2" />
                Patient Copy
              </Button>
            </div>
          )}
        </div>

        {translations.length > 0 ? (
          <TranslationHistory
            translations={translations}
            sessionStart={sessionStart}
            patientLanguage="Multiple Languages"
            translationType="Live Speech Translation"
            onExportDOCX={onExportDOCX}
            onDeleteTranslation={onDeleteTranslation}
            onDeleteSelectedTranslations={onDeleteSelectedTranslations}
            onDeleteAllTranslations={onDeleteAllTranslations}
            isHistorical={false}
          />
        ) : sessions.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Saved Live Speech Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sessions.slice(0, 5).map((session) => {
                  const preview = {
                    languages: session.session_metadata?.languages?.join(", ") || session.patient_language,
                    duration: session.session_metadata?.sessionDuration
                      ? `${Math.floor(session.session_metadata.sessionDuration / 60)}m ${
                          session.session_metadata.sessionDuration % 60
                        }s`
                      : "Unknown",
                    createdAt:
                      new Date(session.created_at).toLocaleDateString() +
                      " " +
                      new Date(session.created_at).toLocaleTimeString(),
                  };

                  return (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="font-medium">{session.session_title}</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {preview.createdAt}
                            </span>
                            <span className="flex items-center gap-1">
                              <Languages className="h-3 w-3" />
                              {preview.languages}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {session.total_translations} phrases
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {preview.duration}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/gp-translation/${session.id}`)}
                      >
                        View Session
                      </Button>
                    </div>
                  );
                })}
                {sessions.length > 5 && (
                  <div className="text-center pt-4">
                    <Button variant="outline" onClick={onOpenSaved}>
                      View All {sessions.length} Sessions
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <HistoryIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No live speech translation history yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Start a live speech translation session to see your conversation history here
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="email-document" className="space-y-6 mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">Email & Document Translations</h3>
          </div>
        </div>

        <Card>
          <CardContent className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">No email or document translation history yet</p>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Use the Email or Document tabs to translate emails and documents, and they'll appear here
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>Email translations from the Email tab</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Document translations from OCR processing</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default HistorySubTabs;
