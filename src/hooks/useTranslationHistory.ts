import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TranslationSession {
  id: string;
  session_title: string;
  session_start: string;
  session_end?: string;
  patient_language: string;
  total_translations: number;
  session_metadata: {
    totalTranslations: number;
    averageAccuracy: number;
    averageConfidence: number;
    overallSafetyRating: 'safe' | 'warning' | 'unsafe';
    safeCount: number;
    warningCount: number;
    unsafeCount: number;
    sessionDuration?: number;
    languages: string[];
  };
  created_at: string;
  updated_at: string;
  is_flagged: boolean;
  is_protected: boolean;
  is_active: boolean;
}

export interface TranslationEntry {
  id: string;
  speaker: 'gp' | 'patient';
  originalText: string;
  translatedText: string;
  originalLanguage: string;
  targetLanguage: string;
  timestamp: Date;
  accuracy?: number;
  confidence?: number;
  safetyFlag?: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected?: string[];
  translationLatency?: number;
}

export interface TranslationScore {
  accuracy: number;
  confidence: number;
  safetyFlag: 'safe' | 'warning' | 'unsafe';
  medicalTermsDetected: string[];
  detectedIssues?: string[];
}

export const useTranslationHistory = () => {
  const [sessions, setSessions] = useState<TranslationSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  // Auto-save state
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // Load translation sessions
  const loadSessions = useCallback(async (options: {
    limit?: number;
    offset?: number;
    flagged?: boolean;
    protected?: boolean;
    language?: string;
    search?: string;
  } = {}) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.flagged) params.append('flagged', 'true');
      if (options.protected) params.append('protected', 'true');
      if (options.language) params.append('language', options.language);
      if (options.search) params.append('search', options.search);

      const { data, error } = await supabase.functions.invoke('load-translation-sessions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) throw error;

      setSessions(data.sessions || []);
      setTotalCount(data.totalCount || 0);
      setHasMore(data.hasMore || false);

    } catch (err: any) {
      console.error('Error loading translation sessions:', err);
      setError(err.message || 'Failed to load translation history');
      toast.error('Failed to load translation history');
    } finally {
      setLoading(false);
    }
  }, []);

  // Save translation session
  const saveSession = useCallback(async (
    translations: TranslationEntry[],
    translationScores: TranslationScore[],
    sessionStart: Date,
    sessionEnd?: Date,
    isActive: boolean = true
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('save-translation-session', {
        body: {
          sessionId: currentSessionId,
          translations,
          translationScores,
          sessionStart: sessionStart.toISOString(),
          sessionEnd: sessionEnd?.toISOString(),
          isActive
        }
      });

      if (error) throw error;

      // Update current session ID if this was a new session
      if (!currentSessionId && data.session?.id) {
        setCurrentSessionId(data.session.id);
      }

      // Refresh sessions list
      await loadSessions();

      return data.session;

    } catch (err: any) {
      console.error('Error saving translation session:', err);
      toast.error('Failed to save translation session');
      throw err;
    }
  }, [currentSessionId, loadSessions]);

  // Delete translation session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-translation-session', {
        body: { sessionId }
      });

      if (error) throw error;

      toast.success(data.message || 'Translation session deleted');
      
      // Remove from local state
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // If this was the current session, clear it
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }

    } catch (err: any) {
      console.error('Error deleting translation session:', err);
      toast.error(err.message || 'Failed to delete translation session');
      throw err;
    }
  }, [currentSessionId]);

  // Update translation session
  const updateSession = useCallback(async (sessionId: string, updates: {
    is_flagged?: boolean;
    is_protected?: boolean;
    session_title?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('update-translation-session', {
        body: { sessionId, updates }
      });

      if (error) throw error;

      // Update local state
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...updates } : s));

      toast.success('Session updated successfully');
      
      return data.session;

    } catch (err: any) {
      console.error('Error updating translation session:', err);
      toast.error(err.message || 'Failed to update translation session');
      throw err;
    }
  }, []);

  // Start new translation session
  const startNewSession = useCallback(() => {
    setCurrentSessionId(null);
    toast.info('Started new translation session');
  }, []);

  // Auto-save functionality
  const enableAutoSave = useCallback((
    getTranslations: () => TranslationEntry[],
    getTranslationScores: () => TranslationScore[],
    getSessionStart: () => Date,
    intervalMs: number = 30000 // 30 seconds
  ) => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
    }

    setAutoSaveEnabled(true);

    autoSaveIntervalRef.current = setInterval(async () => {
      const translations = getTranslations();
      const scores = getTranslationScores();
      const sessionStart = getSessionStart();

      if (translations.length > 0) {
        try {
          await saveSession(translations, scores, sessionStart, undefined, true);
          console.log('Auto-saved translation session');
        } catch (err) {
          console.error('Auto-save failed:', err);
        }
      }
    }, intervalMs);

  }, [saveSession]);

  const disableAutoSave = useCallback(() => {
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }
    setAutoSaveEnabled(false);
  }, []);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Cleanup auto-save interval on unmount
  useEffect(() => {
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
      }
    };
  }, []);

  return {
    sessions,
    loading,
    error,
    totalCount,
    hasMore,
    currentSessionId,
    autoSaveEnabled,
    loadSessions,
    saveSession,
    deleteSession,
    updateSession,
    startNewSession,
    enableAutoSave,
    disableAutoSave
  };
};