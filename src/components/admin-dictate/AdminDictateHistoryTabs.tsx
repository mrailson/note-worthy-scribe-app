import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Languages, 
  Clock, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Download,
  Loader2,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { useAdminDictation } from '@/hooks/useAdminDictation';
import { useReceptionTranslationHistory, TranslationSessionHistory } from '@/hooks/useReceptionTranslationHistory';
import { HEALTHCARE_LANGUAGES } from '@/constants/healthcareLanguages';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface AdminDictateHistoryTabsProps {
  onLoadDictation?: (content: string, templateType: string) => void;
}

export const AdminDictateHistoryTabs: React.FC<AdminDictateHistoryTabsProps> = ({
  onLoadDictation
}) => {
  const { history: dictations, isLoadingHistory: loadingDictations } = useAdminDictation();
  const { sessions: translations, isLoading: loadingTranslations, deleteSession: deleteTranslationSession } = useReceptionTranslationHistory();
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getLanguageInfo = (code: string) => {
    return HEALTHCARE_LANGUAGES.find(l => l.code === code);
  };

  const exportTranslationSession = (session: TranslationSessionHistory) => {
    const langInfo = getLanguageInfo(session.patient_language);
    let content = `Translation Session Report\n`;
    content += `========================\n\n`;
    content += `Date: ${format(new Date(session.created_at), 'dd/MM/yyyy HH:mm')}\n`;
    content += `Patient Language: ${langInfo?.name || session.patient_language} ${langInfo?.flag || ''}\n`;
    content += `Total Messages: ${session.messages.length}\n`;
    if (session.session_title) content += `Title: ${session.session_title}\n`;
    if (session.notes) content += `Notes: ${session.notes}\n`;
    content += `\n${'='.repeat(50)}\n\nConversation:\n\n`;
    
    session.messages.forEach((msg, idx) => {
      const time = format(new Date(msg.created_at), 'HH:mm');
      const speaker = msg.speaker === 'staff' ? 'Staff (English)' : `Patient (${langInfo?.name || session.patient_language})`;
      content += `[${time}] ${speaker}:\n`;
      content += `  Original: ${msg.original_text}\n`;
      content += `  Translated: ${msg.translated_text}\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation-session-${format(new Date(session.created_at), 'yyyy-MM-dd-HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDictation = (dictation: any) => {
    const content = dictation.cleaned_content || dictation.content;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dictation-${format(new Date(dictation.created_at), 'yyyy-MM-dd-HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          History
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <Tabs defaultValue="dictations" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="dictations" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Dictations
              {dictations.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {dictations.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="translations" className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              Translations
              {translations.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {translations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dictations Tab */}
          <TabsContent value="dictations" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[400px]">
              {loadingDictations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : dictations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No dictations yet</p>
                  <p className="text-sm mt-1">Your dictation history will appear here</p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {dictations.map((dictation) => (
                    <div
                      key={dictation.id}
                      className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {dictation.template_type}
                            </Badge>
                            {dictation.is_draft && (
                              <Badge variant="secondary" className="text-xs">
                                Draft
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium truncate">
                            {dictation.title || 'Untitled Dictation'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(dictation.created_at), 'dd MMM yyyy, HH:mm')} • {dictation.word_count} words • {formatDuration(dictation.duration_seconds)}
                          </p>
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {(dictation.cleaned_content || dictation.content).substring(0, 100)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => exportDictation(dictation)}
                            title="Export"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {onLoadDictation && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => onLoadDictation(dictation.cleaned_content || dictation.content, dictation.template_type)}
                            >
                              Load
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Translations Tab */}
          <TabsContent value="translations" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[400px]">
              {loadingTranslations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : translations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Languages className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No translation sessions yet</p>
                  <p className="text-sm mt-1">Your live translation sessions will appear here</p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {translations.map((session) => {
                    const langInfo = getLanguageInfo(session.patient_language);
                    const isExpanded = expandedSession === session.id;
                    
                    return (
                      <div
                        key={session.id}
                        className="rounded-lg border bg-card overflow-hidden"
                      >
                        {/* Session Header */}
                        <div 
                          className="p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {langInfo?.flag} {langInfo?.name || session.patient_language}
                                </Badge>
                                {session.is_active && (
                                  <Badge variant="default" className="text-xs bg-green-600">
                                    Active
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium">
                                {session.session_title || `Session ${format(new Date(session.created_at), 'dd MMM')}`}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(session.created_at), 'dd MMM yyyy, HH:mm')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {session.messages.length} messages
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  exportTranslationSession(session);
                                }}
                                title="Export"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Translation Session?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this translation session and all its messages. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => deleteTranslationSession(session.id)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Messages */}
                        {isExpanded && session.messages.length > 0 && (
                          <div className="border-t bg-muted/30 p-3 space-y-2 max-h-60 overflow-y-auto">
                            {session.messages.map((msg, idx) => (
                              <div
                                key={msg.id}
                                className={`p-2 rounded text-sm ${
                                  msg.speaker === 'staff' 
                                    ? 'bg-primary/10 border-l-2 border-primary' 
                                    : 'bg-secondary/50 border-l-2 border-secondary'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {msg.speaker === 'staff' ? '🇬🇧 Staff' : `${langInfo?.flag || ''} Patient`}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(msg.created_at), 'HH:mm')}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">Original: {msg.original_text}</p>
                                <p className="font-medium">→ {msg.translated_text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {isExpanded && session.messages.length === 0 && (
                          <div className="border-t bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                            No messages recorded for this session
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
