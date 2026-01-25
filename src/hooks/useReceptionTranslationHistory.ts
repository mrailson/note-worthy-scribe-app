import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/utils/toastWrapper';

export interface TranslationMessageHistory {
  id: string;
  session_id: string;
  speaker: 'staff' | 'patient';
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  created_at: string;
}

export interface TranslationSessionHistory {
  id: string;
  patient_language: string;
  session_title: string | null;
  notes: string | null;
  total_messages: number;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  messages: TranslationMessageHistory[];
}

export function useReceptionTranslationHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<TranslationSessionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch sessions with their messages
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('reception_translation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (sessionsError) throw sessionsError;
      
      // Fetch messages for these sessions
      const sessionIds = (sessionsData || []).map(s => s.id);
      
      let messagesData: TranslationMessageHistory[] = [];
      if (sessionIds.length > 0) {
        const { data, error: messagesError } = await supabase
          .from('reception_translation_messages')
          .select('*')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: true });
        
        if (messagesError) throw messagesError;
        messagesData = (data || []) as TranslationMessageHistory[];
      }
      
      // Group messages by session
      const messagesBySession = messagesData.reduce((acc, msg) => {
        if (!acc[msg.session_id]) {
          acc[msg.session_id] = [];
        }
        acc[msg.session_id].push(msg);
        return acc;
      }, {} as Record<string, TranslationMessageHistory[]>);
      
      // Combine sessions with their messages
      const sessionsWithMessages: TranslationSessionHistory[] = (sessionsData || []).map(session => ({
        id: session.id,
        patient_language: session.patient_language,
        session_title: session.session_title,
        notes: session.notes,
        total_messages: session.total_messages || 0,
        created_at: session.created_at,
        expires_at: session.expires_at,
        is_active: session.is_active,
        messages: messagesBySession[session.id] || []
      }));
      
      setSessions(sessionsWithMessages);
    } catch (err: any) {
      console.error('Failed to fetch translation history:', err);
      setError(err.message || 'Failed to load translation history');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Delete a session and its messages
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) return;
    
    try {
      // First delete all messages for this session
      const { error: messagesError } = await supabase
        .from('reception_translation_messages')
        .delete()
        .eq('session_id', sessionId);
      
      if (messagesError) {
        console.error('Failed to delete messages:', messagesError);
        // Continue anyway - messages table might have cascade delete
      }
      
      // Then delete the session
      const { error: sessionError } = await supabase
        .from('reception_translation_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);
      
      if (sessionError) throw sessionError;
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      showToast.success('Session deleted');
    } catch (err: any) {
      console.error('Failed to delete session:', err);
      showToast.error('Failed to delete session');
    }
  }, [user]);

  // Delete all sessions
  const deleteAllSessions = useCallback(async () => {
    if (!user) return;
    
    try {
      // Get all session IDs for this user first
      const { data: userSessions, error: fetchError } = await supabase
        .from('reception_translation_sessions')
        .select('id')
        .eq('user_id', user.id);
      
      if (fetchError) throw fetchError;
      
      const sessionIds = (userSessions || []).map(s => s.id);
      
      if (sessionIds.length > 0) {
        // First delete all messages for these sessions
        const { error: messagesError } = await supabase
          .from('reception_translation_messages')
          .delete()
          .in('session_id', sessionIds);
        
        if (messagesError) {
          console.error('Failed to delete messages:', messagesError);
          // Continue anyway - try to delete sessions
        }
      }
      
      // Then delete all sessions
      const { error: sessionError } = await supabase
        .from('reception_translation_sessions')
        .delete()
        .eq('user_id', user.id);
      
      if (sessionError) throw sessionError;
      
      setSessions([]);
      showToast.success('All translation history deleted');
    } catch (err: any) {
      console.error('Failed to delete all sessions:', err);
      showToast.error('Failed to delete history');
    }
  }, [user]);

  // Update session title/notes
  const updateSession = useCallback(async (sessionId: string, updates: { session_title?: string; notes?: string }) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('reception_translation_sessions')
        .update(updates)
        .eq('id', sessionId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, ...updates } : s
      ));
      showToast.success('Session updated');
    } catch (err: any) {
      console.error('Failed to update session:', err);
      showToast.error('Failed to update session');
    }
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    sessions,
    isLoading,
    error,
    refetch: fetchHistory,
    deleteSession,
    deleteAllSessions,
    updateSession
  };
}
