import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScribeSession } from "@/types/scribe";
import { format } from "date-fns";

export const useScribeHistory = () => {
  const [sessions, setSessions] = useState<ScribeSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ScribeSession | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
        .eq('meeting_type', 'scribe')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedSessions: ScribeSession[] = (data || []).map(item => ({
        id: item.id,
        title: item.title || 'Untitled Session',
        transcript: item.live_transcript_text || item.whisper_transcript_text || '',
        summary: item.overview || '',
        actionItems: item.notes_style_2 || '',
        keyPoints: item.notes_style_3 || '',
        duration: item.duration_minutes || 0,
        wordCount: item.word_count || 0,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        status: item.status as 'recording' | 'completed' | 'archived' || 'completed',
        sessionType: item.meeting_type,
      }));

      setSessions(formattedSessions);
    } catch (error) {
      console.error('Fetch sessions error:', error);
      toast.error('Failed to load session history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const saveSession = useCallback(async (sessionData: {
    transcript: string;
    summary?: string;
    actionItems?: string;
    keyPoints?: string;
    duration?: number;
    wordCount?: number;
    title?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return null;
      }

      const meetingData = {
        title: sessionData.title || `Scribe Session - ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
        live_transcript_text: sessionData.transcript,
        overview: sessionData.summary || "",
        notes_style_2: sessionData.actionItems || "",
        notes_style_3: sessionData.keyPoints || "",
        created_at: new Date().toISOString(),
        start_time: new Date().toISOString(),
        user_id: user.id,
        meeting_type: 'scribe',
        duration_minutes: sessionData.duration || 0,
        word_count: sessionData.wordCount || 0,
        status: 'completed',
      };

      const { data, error } = await supabase
        .from('meetings')
        .insert([meetingData])
        .select()
        .single();

      if (error) throw error;

      const newSession: ScribeSession = {
        id: data.id,
        title: data.title,
        transcript: data.live_transcript_text || '',
        summary: data.overview || '',
        actionItems: data.notes_style_2 || '',
        keyPoints: data.notes_style_3 || '',
        duration: data.duration_minutes || 0,
        wordCount: data.word_count || 0,
        createdAt: data.created_at,
        status: 'completed',
      };

      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession);
      toast.success("Session saved successfully");
      return newSession;
    } catch (error) {
      console.error('Save session error:', error);
      toast.error('Failed to save session');
      return null;
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      const session: ScribeSession = {
        id: data.id,
        title: data.title,
        transcript: data.live_transcript_text || data.whisper_transcript_text || '',
        summary: data.overview || '',
        actionItems: data.notes_style_2 || '',
        keyPoints: data.notes_style_3 || '',
        duration: data.duration_minutes || 0,
        wordCount: data.word_count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        status: data.status as 'recording' | 'completed' | 'archived' || 'completed',
      };

      setCurrentSession(session);
      return session;
    } catch (error) {
      console.error('Load session error:', error);
      toast.error('Failed to load session');
      return null;
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }

      toast.success("Session deleted successfully");
      return true;
    } catch (error) {
      console.error('Delete session error:', error);
      toast.error('Failed to delete session');
      return false;
    }
  }, [currentSession]);

  const clearCurrentSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  return {
    sessions,
    isLoading,
    currentSession,
    fetchSessions,
    saveSession,
    loadSession,
    deleteSession,
    clearCurrentSession,
    setCurrentSession,
  };
};
