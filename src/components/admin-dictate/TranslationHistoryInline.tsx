import React, { useState } from 'react';
import { format } from 'date-fns';
import { useReceptionTranslationHistory } from '@/hooks/useReceptionTranslationHistory';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { 
  X, 
  Languages, 
  Calendar, 
  MessageSquare, 
  Download, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Loader2,
  History
} from 'lucide-react';

interface TranslationHistoryInlineProps {
  onClose: () => void;
}

// Language info lookup
const getLanguageInfo = (code: string) => {
  const languages: Record<string, { name: string; flag: string }> = {
    'ar': { name: 'Arabic', flag: '🇸🇦' },
    'bn': { name: 'Bengali', flag: '🇧🇩' },
    'zh': { name: 'Chinese', flag: '🇨🇳' },
    'cs': { name: 'Czech', flag: '🇨🇿' },
    'nl': { name: 'Dutch', flag: '🇳🇱' },
    'fr': { name: 'French', flag: '🇫🇷' },
    'de': { name: 'German', flag: '🇩🇪' },
    'el': { name: 'Greek', flag: '🇬🇷' },
    'gu': { name: 'Gujarati', flag: '🇮🇳' },
    'hi': { name: 'Hindi', flag: '🇮🇳' },
    'hu': { name: 'Hungarian', flag: '🇭🇺' },
    'it': { name: 'Italian', flag: '🇮🇹' },
    'ja': { name: 'Japanese', flag: '🇯🇵' },
    'ko': { name: 'Korean', flag: '🇰🇷' },
    'lt': { name: 'Lithuanian', flag: '🇱🇹' },
    'lv': { name: 'Latvian', flag: '🇱🇻' },
    'ne': { name: 'Nepali', flag: '🇳🇵' },
    'pa': { name: 'Punjabi', flag: '🇮🇳' },
    'pl': { name: 'Polish', flag: '🇵🇱' },
    'pt': { name: 'Portuguese', flag: '🇵🇹' },
    'ro': { name: 'Romanian', flag: '🇷🇴' },
    'ru': { name: 'Russian', flag: '🇷🇺' },
    'sk': { name: 'Slovak', flag: '🇸🇰' },
    'so': { name: 'Somali', flag: '🇸🇴' },
    'es': { name: 'Spanish', flag: '🇪🇸' },
    'sw': { name: 'Swahili', flag: '🇰🇪' },
    'ta': { name: 'Tamil', flag: '🇮🇳' },
    'tr': { name: 'Turkish', flag: '🇹🇷' },
    'uk': { name: 'Ukrainian', flag: '🇺🇦' },
    'ur': { name: 'Urdu', flag: '🇵🇰' },
    'vi': { name: 'Vietnamese', flag: '🇻🇳' },
    'am': { name: 'Amharic', flag: '🇪🇹' },
    'ti': { name: 'Tigrinya', flag: '🇪🇷' },
    'ps': { name: 'Pashto', flag: '🇦🇫' },
    'fa': { name: 'Farsi', flag: '🇮🇷' },
    'ku': { name: 'Kurdish', flag: '🇮🇶' },
  };
  return languages[code] || { name: code, flag: '🌐' };
};

export const TranslationHistoryInline: React.FC<TranslationHistoryInlineProps> = ({ onClose }) => {
  const { sessions, isLoading, deleteSession, deleteAllSessions } = useReceptionTranslationHistory();
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const exportSession = (session: typeof sessions[0]) => {
    const lines = [
      `Translation Session - ${format(new Date(session.created_at), 'dd MMMM yyyy, HH:mm')}`,
      `Language: ${getLanguageInfo(session.patient_language).name}`,
      `Messages: ${session.messages.length}`,
      '',
      '---',
      '',
    ];

    session.messages.forEach((msg) => {
      lines.push(`[${format(new Date(msg.created_at), 'HH:mm')}] ${msg.speaker === 'staff' ? 'Staff' : 'Patient'}:`);
      lines.push(`  Original: ${msg.original_text}`);
      lines.push(`  Translated: ${msg.translated_text}`);
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation-session-${format(new Date(session.created_at), 'yyyy-MM-dd-HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    await deleteAllSessions();
    setIsDeletingAll(false);
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <History className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg font-semibold">Translation History</h2>
          <Badge variant="outline" className="text-xs">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Delete All Button */}
          {sessions.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isDeletingAll}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete All Translation History?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {sessions.length} translation session{sessions.length !== 1 ? 's' : ''} and their messages. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDeleteAll}
                  >
                    {isDeletingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete All'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Languages className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No translation sessions yet</p>
            <p className="text-sm mt-1">Your live translation sessions will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
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
                            {langInfo.flag} {langInfo.name}
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
                            exportSession(session);
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
                                onClick={() => deleteSession(session.id)}
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
                      {session.messages.map((msg) => (
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
                              {msg.speaker === 'staff' ? '🇬🇧 Staff' : `${langInfo.flag} Patient`}
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
    </div>
  );
};
