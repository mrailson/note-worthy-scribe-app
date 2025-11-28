import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DocumentQASession {
  id: string;
  user_id: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  document_names: string[];
  created_at: string;
  updated_at: string;
}

export const useDocumentQAHistory = () => {
  const [sessions, setSessions] = useState<DocumentQASession[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to view chat history');
        return;
      }

      const { data, error } = await supabase
        .from('document_qa_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSessions((data || []) as DocumentQASession[]);
    } catch (error: any) {
      console.error('Error loading Q&A history:', error);
      toast.error('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const saveSession = async (
    title: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    documentNames: string[]
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to save chat');
        return null;
      }

      const { data, error } = await supabase
        .from('document_qa_sessions')
        .insert({
          user_id: user.id,
          title,
          messages,
          document_names: documentNames,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Chat saved successfully');
      await loadSessions();
      return data;
    } catch (error: any) {
      console.error('Error saving session:', error);
      toast.error('Failed to save chat');
      return null;
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('document_qa_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('Chat deleted');
      await loadSessions();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete chat');
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return {
    sessions,
    loading,
    loadSessions,
    saveSession,
    deleteSession,
  };
};
