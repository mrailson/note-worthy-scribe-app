import React, { useState, useMemo, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useReceptionTranslationHistory, TranslationSessionHistory } from '@/hooks/useReceptionTranslationHistory';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  X,
  Languages,
  Calendar,
  MessageSquare,
  FileText,
  Trash2,
  ChevronDown,
  Loader2,
  History,
  Search,
  GraduationCap,
} from 'lucide-react';
import { generateTranslationReportDocx } from '@/utils/generateTranslationReportDocx';
import { TranslationMessage } from '@/hooks/useReceptionTranslation';
import { usePracticeContext } from '@/hooks/usePracticeContext';
import { showToast } from '@/utils/toastWrapper';
import { PatientHandoutActions } from './PatientHandoutActions';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { UserCheck } from 'lucide-react';

interface TranslationHistoryInlineProps {
  onClose: () => void;
}

// ── LANGUAGE INFO ──
const LANGUAGE_MAP: Record<string, { name: string; flag: string }> = {
  ar: { name: 'Arabic', flag: '🇸🇦' }, bn: { name: 'Bengali', flag: '🇧🇩' },
  zh: { name: 'Chinese', flag: '🇨🇳' }, cs: { name: 'Czech', flag: '🇨🇿' },
  nl: { name: 'Dutch', flag: '🇳🇱' }, fr: { name: 'French', flag: '🇫🇷' },
  de: { name: 'German', flag: '🇩🇪' }, el: { name: 'Greek', flag: '🇬🇷' },
  gu: { name: 'Gujarati', flag: '🇮🇳' }, hi: { name: 'Hindi', flag: '🇮🇳' },
  hu: { name: 'Hungarian', flag: '🇭🇺' }, it: { name: 'Italian', flag: '🇮🇹' },
  ja: { name: 'Japanese', flag: '🇯🇵' }, ko: { name: 'Korean', flag: '🇰🇷' },
  lt: { name: 'Lithuanian', flag: '🇱🇹' }, lv: { name: 'Latvian', flag: '🇱🇻' },
  ne: { name: 'Nepali', flag: '🇳🇵' }, pa: { name: 'Punjabi', flag: '🇮🇳' },
  pl: { name: 'Polish', flag: '🇵🇱' }, pt: { name: 'Portuguese', flag: '🇵🇹' },
  ro: { name: 'Romanian', flag: '🇷🇴' }, ru: { name: 'Russian', flag: '🇷🇺' },
  sk: { name: 'Slovak', flag: '🇸🇰' }, so: { name: 'Somali', flag: '🇸🇴' },
  es: { name: 'Spanish', flag: '🇪🇸' }, sw: { name: 'Swahili', flag: '🇰🇪' },
  ta: { name: 'Tamil', flag: '🇮🇳' }, tr: { name: 'Turkish', flag: '🇹🇷' },
  uk: { name: 'Ukrainian', flag: '🇺🇦' }, ur: { name: 'Urdu', flag: '🇵🇰' },
  vi: { name: 'Vietnamese', flag: '🇻🇳' }, am: { name: 'Amharic', flag: '🇪🇹' },
  ti: { name: 'Tigrinya', flag: '🇪🇷' }, ps: { name: 'Pashto', flag: '🇦🇫' },
  fa: { name: 'Farsi', flag: '🇮🇷' }, ku: { name: 'Kurdish', flag: '🇮🇶' },
};
const getLangInfo = (code: string) => LANGUAGE_MAP[code] || { name: code, flag: '🌐' };

// ── LANGUAGE COLOUR MAP ──
const LANG_COLOURS: Record<string, string> = {
  ar: '#009639', bn: '#DA291C', ur: '#005EB8', hi: '#FF6B00',
  pl: '#DC143C', ro: '#002B7F', fr: '#0055A4', es: '#AA151B',
  pt: '#006600', tr: '#E30A17', so: '#4189DD', ti: '#009639',
  fa: '#239F40', zh: '#DE2910', pa: '#FF6600', gu: '#FF9933',
  ta: '#FFCC00', ru: '#0039A6', uk: '#005BBB', am: '#009B3A',
  de: '#DD0000', it: '#009246', ko: '#003478', ja: '#BC002D',
  vi: '#DA251D', ne: '#DC143C', sw: '#006B3F',
};
const getLangColour = (code: string) => LANG_COLOURS[code] || '#6366F1';

// ── HELPERS ──
const getSessionDuration = (messages: { created_at: string }[]) => {
  if (messages.length < 2) return null;
  const mins = Math.round(
    (new Date(messages[messages.length - 1].created_at).getTime() - new Date(messages[0].created_at).getTime()) / 60000
  );
  return mins < 1 ? '<1 min' : `${mins} min`;
};


// ── COMPONENT ──

export const TranslationHistoryInline: React.FC<TranslationHistoryInlineProps> = ({ onClose }) => {
  const { sessions, isLoading, deleteSession, deleteAllSessions, updateSession } = useReceptionTranslationHistory();
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const generatingRef = useRef<Set<string>>(new Set());

  // Generate AI summaries lazily, cache to notes column
  useEffect(() => {
    sessions.forEach(session => {
      if (summaries[session.id] || session.messages.length === 0 || generatingRef.current.has(session.id)) return;
      if (session.notes) {
        setSummaries(prev => ({ ...prev, [session.id]: session.notes! }));
        return;
      }
      generatingRef.current.add(session.id);
      const conversationText = session.messages.map(m =>
        `${m.speaker === 'staff' ? 'Staff' : 'Patient'}: ${m.original_text}`
      ).join('\n');
      supabase.functions.invoke('summarise-translation-session', {
        body: { conversationText }
      }).then(({ data }) => {
        if (data?.summary) {
          setSummaries(prev => ({ ...prev, [session.id]: data.summary }));
          updateSession(session.id, { notes: data.summary });
        }
      }).catch(() => {
        // Silently fail — summary is non-critical
      });
    });
  }, [sessions]);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [downloadingSessionId, setDownloadingSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const { practiceContext } = usePracticeContext();

  // Unique languages from sessions
  const uniqueLanguages = useMemo(() => {
    const seen = new Set<string>();
    return sessions
      .map(s => s.patient_language)
      .filter(code => { if (seen.has(code)) return false; seen.add(code); return true; })
      .map(code => ({ code, ...getLangInfo(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (languageFilter) {
      result = result.filter(s => s.patient_language === languageFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.messages.some(m =>
          m.original_text.toLowerCase().includes(q) ||
          m.translated_text.toLowerCase().includes(q)
        )
      );
    }
    return result;
  }, [sessions, languageFilter, searchQuery]);

  // DOCX download
  const exportSessionDocx = async (session: TranslationSessionHistory) => {
    if (session.messages.length === 0) {
      showToast.error('No messages to include in report');
      return;
    }
    setDownloadingSessionId(session.id);
    try {
      const langInfo = getLangInfo(session.patient_language);
      const messages: TranslationMessage[] = session.messages.map(msg => ({
        id: msg.id,
        speaker: msg.speaker as 'staff' | 'patient',
        originalText: msg.original_text,
        translatedText: msg.translated_text,
        originalLanguage: msg.speaker === 'staff' ? 'en' : session.patient_language,
        targetLanguage: msg.speaker === 'staff' ? session.patient_language : 'en',
        timestamp: new Date(msg.created_at),
      }));
      const sessionStart = new Date(session.created_at);
      const lastMsg = session.messages[session.messages.length - 1];
      const sessionEnd = lastMsg ? new Date(lastMsg.created_at) : sessionStart;

      await generateTranslationReportDocx({
        messages,
        patientLanguage: session.patient_language,
        patientLanguageName: langInfo.name,
        sessionStart,
        sessionEnd,
        practiceInfo: {
          name: practiceContext?.practiceName,
          address: practiceContext?.practiceAddress,
          logoUrl: practiceContext?.logoUrl,
        },
      });
      showToast.success('Translation report downloaded');
    } catch (error) {
      console.error('Report generation error:', error);
      showToast.error('Failed to generate report');
    } finally {
      setDownloadingSessionId(null);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    await deleteAllSessions();
    setIsDeletingAll(false);
  };

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border shadow-lg">
      {/* ── HEADER ── */}
      <div className="px-4 pt-4 pb-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Translation History</h2>
            <Badge variant="secondary" className="text-xs">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            {sessions.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive/60 hover:text-destructive gap-1 text-xs"
                    disabled={isDeletingAll}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all translation history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {sessions.length} session record{sessions.length !== 1 ? 's' : ''}. Downloaded reports will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleDeleteAll}
                    >
                      {isDeletingAll ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting…</>
                      ) : 'Delete All'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search & filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search messages…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-sm">
                <Languages className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {languageFilter ? getLangInfo(languageFilter).name : 'All Languages'}
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguageFilter(null)}>
                🌐 All Languages
              </DropdownMenuItem>
              {uniqueLanguages.map(lang => (
                <DropdownMenuItem key={lang.code} onClick={() => setLanguageFilter(lang.code)}>
                  {lang.flag} {lang.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── SESSION LIST ── */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {searchQuery || languageFilter
                ? 'No sessions match your filters'
                : 'No translation sessions yet'}
            </p>
            {searchQuery || languageFilter ? (
              <p className="text-xs text-muted-foreground mt-1">Your live translation sessions will appear here</p>
            ) : null}
            {(searchQuery || languageFilter) && (
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => { setSearchQuery(''); setLanguageFilter(null); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSessions.map((session) => {
              const langInfo = getLangInfo(session.patient_language);
              const colour = getLangColour(session.patient_language);
              const isExpanded = expandedSession === session.id;
              const duration = getSessionDuration(session.messages);
              const staffCount = session.messages.filter(m => m.speaker === 'staff').length;
              const patientCount = session.messages.filter(m => m.speaker === 'patient').length;

              return (
                <div
                  key={session.id}
                  className={`rounded-xl border-2 transition-all ${
                    session.is_active
                      ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                      : 'border-transparent bg-card hover:border-muted-foreground/20'
                  }`}
                >
                  {/* Card header */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer"
                    onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Language flag icon */}
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                        style={{ background: `${colour}15` }}
                      >
                        {langInfo.flag}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Line 1: Language + badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-sm">{langInfo.name}</span>
                          {session.is_active && (
                            <Badge className="bg-emerald-500 text-white text-[0.6rem] px-1.5 py-0 leading-tight">Active</Badge>
                          )}
                          {session.is_training && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700 text-[0.6rem] px-1.5 py-0 leading-tight gap-0.5">
                              <GraduationCap className="h-2.5 w-2.5" />
                              Training
                            </Badge>
                          )}
                        </div>

                        {/* Line 2: Date/time/stats */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span>{format(new Date(session.created_at), 'dd MMM, HH:mm')}</span>
                          <span className="opacity-40">•</span>
                          <span>{session.messages.length} msgs</span>
                          {duration && (
                            <>
                              <span className="opacity-40">•</span>
                              <span>{duration}</span>
                            </>
                          )}
                          {session.training_scenario && (
                            <>
                              <span className="opacity-40">•</span>
                              <span className="text-amber-600 dark:text-amber-400">{session.training_scenario}</span>
                            </>
                          )}
                        </div>

                        {/* Line 3: AI Summary */}
                        {summaries[session.id] ? (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-3 max-w-3xl">
                            ✨ {summaries[session.id]}
                          </p>
                        ) : session.messages.length > 0 ? (
                          <p className="text-xs text-muted-foreground/50 mt-1 max-w-2xl italic">
                            Generating summary…
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      {/* Exchange counts */}
                      <div className="hidden sm:flex items-center gap-1">
                        <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          {staffCount} staff
                        </span>
                        <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium">
                          {patientCount} patient
                        </span>
                      </div>

                      {/* Download */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={downloadingSessionId === session.id || session.messages.length === 0}
                        onClick={(e) => { e.stopPropagation(); exportSessionDocx(session); }}
                        title="Download Word Report"
                      >
                        {downloadingSessionId === session.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </Button>

                      {/* Delete */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive/60 hover:text-destructive"
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

                      {/* Chevron */}
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded messages */}
                  {isExpanded && session.messages.length > 0 && (
                    <div className="border-t px-3 pb-3 pt-2 space-y-2 max-h-[400px] overflow-y-auto">
                      {session.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`rounded-lg p-2.5 text-sm ${
                            msg.speaker === 'staff'
                              ? 'bg-primary/5 border-l-2 border-primary'
                              : 'bg-emerald-50 border-l-2 border-emerald-500 dark:bg-emerald-950/20'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[0.65rem] font-semibold ${
                              msg.speaker === 'staff' ? 'text-primary' : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {msg.speaker === 'staff' ? '🇬🇧 Staff' : `${langInfo.flag} Patient`}
                            </span>
                            <span className="text-[0.6rem] text-muted-foreground">
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </span>
                          </div>
                          <p className="text-foreground">{msg.original_text}</p>
                          <p className="text-muted-foreground mt-1 text-xs">→ {msg.translated_text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {isExpanded && session.messages.length === 0 && (
                    <div className="border-t p-4 text-center text-sm text-muted-foreground">
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
