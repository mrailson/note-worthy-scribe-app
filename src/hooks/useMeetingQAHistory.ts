import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

export interface MeetingQASession {
  id: string;
  meeting_id: string;
  user_id: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  created_at: string;
  updated_at: string;
}

export const useMeetingQAHistory = (meetingId: string) => {
  const [sessions, setSessions] = useState<MeetingQASession[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = async () => {
    if (!meetingId) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast.error('Please sign in to view chat history', { section: 'meeting_manager' });
        return;
      }

      const { data, error } = await supabase
        .from('meeting_qa_sessions')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSessions((data || []) as MeetingQASession[]);
    } catch (error: any) {
      console.error('Error loading Q&A history:', error);
      showToast.error('Failed to load chat history', { section: 'meeting_manager' });
    } finally {
      setLoading(false);
    }
  };

  const saveSession = async (
    title: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast.error('Please sign in to save chat', { section: 'meeting_manager' });
        return null;
      }

      const { data, error } = await supabase
        .from('meeting_qa_sessions')
        .insert({
          meeting_id: meetingId,
          user_id: user.id,
          title,
          messages,
        })
        .select()
        .single();

      if (error) throw error;

      showToast.success('Chat saved successfully', { section: 'meeting_manager' });
      await loadSessions();
      return data;
    } catch (error: any) {
      console.error('Error saving session:', error);
      showToast.error('Failed to save chat', { section: 'meeting_manager' });
      return null;
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('meeting_qa_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      showToast.success('Chat deleted', { section: 'meeting_manager' });
      await loadSessions();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      showToast.error('Failed to delete chat', { section: 'meeting_manager' });
    }
  };

  useEffect(() => {
    loadSessions();
  }, [meetingId]);

  return {
    sessions,
    loading,
    loadSessions,
    saveSession,
    deleteSession,
  };
};