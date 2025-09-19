import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, Download, FileText, Clock, Languages, AlertTriangle, ChevronDown, ChevronRight, Volume2 } from 'lucide-react';
import { downloadManualTranslationDOCX } from '@/utils/manualTranslationDocxExport';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface HistorySession {
  id: string;
  session_title: string;
  target_language_code: string;
  target_language_name: string;
  total_exchanges: number;
  session_duration_seconds: number;
  average_accuracy: number;
  average_confidence: number;
  overall_safety_rating: 'safe' | 'warning' | 'unsafe';
  session_start: string;
  session_end: string | null;
  is_completed: boolean;
  created_at: string;
}

interface HistoryEntry {
  id: string;
  exchange_number: number;
  speaker: 'gp' | 'patient';
  original_text: string;
  translated_text: string;
  original_language_detected: string;
  target_language: string;
  detection_confidence: number;
  translation_accuracy: number;
  translation_confidence: number;
  safety_flag: 'safe' | 'warning' | 'unsafe';
  medical_terms_detected: string[];
  processing_time_ms: number;
  timestamp: string;
}

export const ManualTranslationHistory = () => {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [sessionEntries, setSessionEntries] = useState<Record<string, HistoryEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeletingSession, setIsDeletingSession] = useState<Set<string>>(new Set());
  const [isDeletingEntry, setIsDeletingEntry] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('manual_translation_sessions')
        .select('*')
        .eq('is_completed', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions((data || []) as HistorySession[]);
    } catch (error) {
      console.error('Failed to fetch translation history:', error);
      toast.error('Failed to load translation history');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionEntries = async (sessionId: string): Promise<HistoryEntry[]> => {
    const { data, error } = await supabase
      .from('manual_translation_entries')
      .select('*')
      .eq('session_id', sessionId)
      .order('exchange_number', { ascending: true });

    if (error) throw error;
    return (data || []) as HistoryEntry[];
  };

  const loadSessionEntries = async (sessionId: string) => {
    try {
      const entries = await fetchSessionEntries(sessionId);
      setSessionEntries(prev => ({
        ...prev,
        [sessionId]: entries
      }));
    } catch (error) {
      console.error('Failed to load session entries:', error);
      toast.error('Failed to load session details');
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const handleSelectSession = (sessionId: string, checked: boolean) => {
    const newSelected = new Set(selectedSessions);
    if (checked) {
      newSelected.add(sessionId);
    } else {
      newSelected.delete(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSessions(new Set(sessions.map(s => s.id)));
    } else {
      setSelectedSessions(new Set());
    }
  };

  const downloadSingleSession = async (session: HistorySession) => {
    setIsDownloading(true);
    try {
      const entries = await fetchSessionEntries(session.id);
      
      const transformedSession = {
        id: session.id,
        sessionTitle: session.session_title,
        targetLanguageCode: session.target_language_code,
        targetLanguageName: session.target_language_name,
        totalExchanges: session.total_exchanges,
        sessionDurationSeconds: session.session_duration_seconds,
        averageAccuracy: session.average_accuracy,
        averageConfidence: session.average_confidence,
        overallSafetyRating: session.overall_safety_rating,
        sessionStart: new Date(session.session_start),
        sessionEnd: session.session_end ? new Date(session.session_end) : undefined,
        isCompleted: session.is_completed,
        entries: []
      };

      const transformedEntries = entries.map(entry => ({
        id: entry.id,
        exchangeNumber: entry.exchange_number,
        speaker: entry.speaker,
        originalText: entry.original_text,
        translatedText: entry.translated_text,
        originalLanguageDetected: entry.original_language_detected,
        targetLanguage: entry.target_language,
        detectionConfidence: entry.detection_confidence,
        translationAccuracy: entry.translation_accuracy,
        translationConfidence: entry.translation_confidence,
        safetyFlag: entry.safety_flag,
        medicalTermsDetected: entry.medical_terms_detected,
        processingTimeMs: entry.processing_time_ms,
        timestamp: new Date(entry.timestamp)
      }));

      await downloadManualTranslationDOCX(transformedSession, transformedEntries);
      toast.success('Session report downloaded successfully');
    } catch (error) {
      console.error('Failed to download session:', error);
      toast.error('Failed to download session report. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadSelectedSessions = async () => {
    if (selectedSessions.size === 0) {
      toast.error('Please select at least one session to download');
      return;
    }

    setIsDownloading(true);
    try {
      const selectedSessionData = sessions.filter(s => selectedSessions.has(s.id));
      
      for (const session of selectedSessionData) {
        await downloadSingleSession(session);
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      toast.success(`Downloaded ${selectedSessions.size} session reports`);
    } catch (error) {
      console.error('Failed to download selected sessions:', error);
      toast.error('Failed to download selected sessions');
    } finally {
      setIsDownloading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return;
    }

    setIsDeletingSession(prev => new Set([...prev, sessionId]));
    try {
      // Delete entries first (due to foreign key constraints)
      const { error: entriesError } = await supabase
        .from('manual_translation_entries')
        .delete()
        .eq('session_id', sessionId);

      if (entriesError) throw entriesError;

      // Then delete session
      const { error: sessionError } = await supabase
        .from('manual_translation_sessions')
        .delete()
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      // Update local state
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setSelectedSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
      setExpandedSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
      setSessionEntries(prev => {
        const newEntries = { ...prev };
        delete newEntries[sessionId];
        return newEntries;
      });

      toast.success('Session deleted successfully');
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error('Failed to delete session');
    } finally {
      setIsDeletingSession(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  };

  const deleteEntry = async (entryId: string, sessionId: string) => {
    if (!confirm('Are you sure you want to delete this translation entry? This action cannot be undone.')) {
      return;
    }

    setIsDeletingEntry(prev => new Set([...prev, entryId]));
    try {
      const { error } = await supabase
        .from('manual_translation_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      // Update local state
      setSessionEntries(prev => ({
        ...prev,
        [sessionId]: (prev[sessionId] || []).filter(entry => entry.id !== entryId)
      }));

      // Update session total exchanges count
      setSessions(prev => prev.map(session => {
        if (session.id === sessionId) {
          return {
            ...session,
            total_exchanges: session.total_exchanges - 1
          };
        }
        return session;
      }));

      toast.success('Translation entry deleted successfully');
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast.error('Failed to delete translation entry');
    } finally {
      setIsDeletingEntry(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  };

  const deleteAllSessions = async () => {
    if (!confirm('Are you sure you want to delete ALL translation history? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete entries first (due to foreign key constraints)
      const { error: entriesError } = await supabase
        .from('manual_translation_entries')
        .delete()
        .in('session_id', sessions.map(s => s.id));

      if (entriesError) throw entriesError;

      // Then delete sessions
      const { error: sessionsError } = await supabase
        .from('manual_translation_sessions')
        .delete()
        .in('id', sessions.map(s => s.id));

      if (sessionsError) throw sessionsError;

      setSessions([]);
      setSelectedSessions(new Set());
      toast.success('All translation history deleted');
    } catch (error) {
      console.error('Failed to delete sessions:', error);
      toast.error('Failed to delete translation history');
    }
  };

  const toggleSessionExpansion = async (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
      // Load entries if not already loaded
      if (!sessionEntries[sessionId]) {
        await loadSessionEntries(sessionId);
      }
    }
    setExpandedSessions(newExpanded);
  };

  const getSafetyBadgeColor = (flag: string) => {
    switch (flag) {
      case 'safe': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'unsafe': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSafetyIcon = (flag: string) => {
    switch (flag) {
      case 'safe': return '✓';
      case 'warning': return '⚠';
      case 'unsafe': return '✗';
      default: return '?';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Translation History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading translation history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Translation History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No completed translation sessions found</p>
            <p className="text-sm text-muted-foreground mt-1">Complete a manual translation session to see it here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Translation History ({sessions.length} sessions)
        </CardTitle>
        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id="select-all"
            checked={selectedSessions.size === sessions.length}
            onCheckedChange={handleSelectAll}
          />
          <label htmlFor="select-all" className="text-sm font-medium">
            Select All
          </label>
          <div className="flex-1" />
          <Button
            onClick={downloadSelectedSessions}
            disabled={selectedSessions.size === 0 || isDownloading}
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Selected ({selectedSessions.size})
          </Button>
          <Button
            onClick={deleteAllSessions}
            disabled={sessions.length === 0}
            size="sm"
            variant="destructive"
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="border rounded-lg">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`session-${session.id}`}
                    checked={selectedSessions.has(session.id)}
                    onCheckedChange={(checked) => handleSelectSession(session.id, checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{session.session_title}</h4>
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSessionExpansion(session.id)}
                              className="h-6 w-6 p-0"
                            >
                              {expandedSessions.has(session.id) ? 
                                <ChevronDown className="h-4 w-4" /> : 
                                <ChevronRight className="h-4 w-4" />
                              }
                            </Button>
                          </CollapsibleTrigger>
                        </Collapsible>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={session.overall_safety_rating === 'safe' ? 'default' : session.overall_safety_rating === 'warning' ? 'secondary' : 'destructive'}>
                          {session.overall_safety_rating.toUpperCase()}
                        </Badge>
                        <Button
                          onClick={() => downloadSingleSession(session)}
                          disabled={isDownloading}
                          size="sm"
                          variant="outline"
                          className="flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </Button>
                        <Button
                          onClick={() => deleteSession(session.id)}
                          disabled={isDeletingSession.has(session.id)}
                          size="sm"
                          variant="destructive"
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Languages className="h-3 w-3" />
                        {session.target_language_name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(session.session_duration_seconds)}
                      </div>
                      <div>
                        <span className="font-medium">{session.total_exchanges}</span> exchanges
                      </div>
                      <div>
                        <span className="font-medium">{Math.round(session.average_accuracy)}%</span> accuracy
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      Started: {new Date(session.session_start).toLocaleString('en-GB')}
                      {session.session_end && (
                        <span> • Ended: {new Date(session.session_end).toLocaleString('en-GB')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <Collapsible open={expandedSessions.has(session.id)}>
                <CollapsibleContent>
                  <div className="border-t bg-muted/30 p-4">
                    <h5 className="font-medium mb-3 text-sm">Translation Entries</h5>
                    {sessionEntries[session.id] ? (
                      <div className="space-y-3">
                        {sessionEntries[session.id].map((entry) => (
                          <div key={entry.id} className="bg-background rounded-lg p-3 border">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  #{entry.exchange_number}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {entry.speaker === 'gp' ? '👨‍⚕️ GP' : '👤 Patient'}
                                </span>
                                <Badge variant="outline" className={`text-xs ${getSafetyBadgeColor(entry.safety_flag)}`}>
                                  {getSafetyIcon(entry.safety_flag)} {entry.safety_flag}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(entry.timestamp).toLocaleTimeString('en-GB', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                  })}
                                </span>
                                <Button
                                  onClick={() => deleteEntry(entry.id, session.id)}
                                  disabled={isDeletingEntry.has(entry.id)}
                                  size="sm"
                                  variant="destructive"
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                                  Original ({entry.original_language_detected})
                                </div>
                                <div>{entry.original_text}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1 flex items-center justify-between">
                                  <span>Translation ({entry.target_language})</span>
                                  {'speechSynthesis' in window && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-1 text-xs"
                                      onClick={() => {
                                        const utterance = new SpeechSynthesisUtterance(entry.translated_text);
                                        utterance.lang = entry.target_language;
                                        utterance.rate = 0.9;
                                        speechSynthesis.speak(utterance);
                                      }}
                                    >
                                      <Volume2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                <div className="font-medium">{entry.translated_text}</div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                              <span>Accuracy: {entry.translation_accuracy}%</span>
                              <span>Confidence: {entry.translation_confidence}%</span>
                              <span>{entry.processing_time_ms}ms</span>
                            </div>

                            {entry.medical_terms_detected.length > 0 && (
                              <div className="text-xs mt-1">
                                <span className="text-muted-foreground">Medical terms: </span>
                                <span className="text-primary font-medium">
                                  {entry.medical_terms_detected.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Loading entries...</p>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
        </div>
        
        {selectedSessions.size > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {selectedSessions.size} session{selectedSessions.size === 1 ? '' : 's'} selected for download
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};