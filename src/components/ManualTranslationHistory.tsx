import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Trash2, Download, FileText, Clock, Languages, AlertTriangle } from 'lucide-react';
import { downloadManualTranslationDOCX } from '@/utils/manualTranslationDocxExport';

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
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

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
      toast.error('Failed to download session report');
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

  const getSafetyBadge = (rating: string) => {
    const variants = {
      safe: 'default',
      warning: 'secondary', 
      unsafe: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[rating as keyof typeof variants] || 'default'}>
        {rating.toUpperCase()}
      </Badge>
    );
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
            <div key={session.id} className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`session-${session.id}`}
                  checked={selectedSessions.has(session.id)}
                  onCheckedChange={(checked) => handleSelectSession(session.id, checked as boolean)}
                  className="mt-1"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{session.session_title}</h4>
                    <div className="flex items-center gap-2">
                      {getSafetyBadge(session.overall_safety_rating)}
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