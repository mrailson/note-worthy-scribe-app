import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  editedContent?: string;
  timestamp: string;
  id: string;
}

export interface AIChatSession {
  id: string;
  consultation_id: string;
  user_id: string;
  messages: AIChatMessage[];
  title: string | null;
  created_at: string;
  updated_at: string;
}

export function useAIChatHistory(consultationId: string | null) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AIChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<AIChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNewChatMode, setIsNewChatMode] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load all sessions for this consultation
  const loadSessions = useCallback(async (autoLoad: boolean = true) => {
    if (!consultationId || !user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('gp_consultation_ai_chats')
        .select('*')
        .eq('consultation_id', consultationId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      const typedData = (data || []).map(session => ({
        ...session,
        messages: (session.messages as unknown as AIChatMessage[]) || []
      }));
      
      setSessions(typedData);
      
      // Auto-load the most recent session only if autoLoad is true and not in new chat mode
      if (autoLoad && typedData.length > 0 && !currentSession && !isNewChatMode) {
        setCurrentSession(typedData[0]);
      }
    } catch (error) {
      console.error('Failed to load AI chat history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [consultationId, user, currentSession, isNewChatMode]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Create a new session
  const createSession = useCallback(async (initialMessages: AIChatMessage[] = []) => {
    if (!consultationId || !user) return null;

    try {
      const title = initialMessages.length > 0 
        ? initialMessages[0].content.substring(0, 50) + (initialMessages[0].content.length > 50 ? '...' : '')
        : 'New Chat';

      const { data, error } = await supabase
        .from('gp_consultation_ai_chats')
        .insert({
          consultation_id: consultationId,
          user_id: user.id,
          messages: JSON.parse(JSON.stringify(initialMessages)),
          title
        })
        .select()
        .single();

      if (error) throw error;

      const typedSession: AIChatSession = {
        ...data,
        messages: (data.messages as unknown as AIChatMessage[]) || []
      };
      
      setCurrentSession(typedSession);
      setSessions(prev => [typedSession, ...prev]);
      return typedSession;
    } catch (error) {
      console.error('Failed to create AI chat session:', error);
      toast.error('Failed to create chat session');
      return null;
    }
  }, [consultationId, user]);

  // Save messages with debounce
  const saveMessages = useCallback(async (messages: AIChatMessage[], sessionId?: string) => {
    const targetSessionId = sessionId || currentSession?.id;
    if (!targetSessionId || !user) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSaving(true);

    // Debounce the save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const title = messages.length > 0 
          ? messages[0].content.substring(0, 50) + (messages[0].content.length > 50 ? '...' : '')
          : 'Chat';

        const { error } = await supabase
          .from('gp_consultation_ai_chats')
          .update({
            messages: JSON.parse(JSON.stringify(messages)),
            title,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetSessionId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Update local state
        setCurrentSession(prev => prev ? { ...prev, messages, title } : null);
        setSessions(prev => prev.map(s => 
          s.id === targetSessionId ? { ...s, messages, title, updated_at: new Date().toISOString() } : s
        ));
      } catch (error) {
        console.error('Failed to save AI chat:', error);
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, [currentSession?.id, user]);

  // Update a single message's edited content
  const updateMessageContent = useCallback(async (messageId: string, editedContent: string) => {
    if (!currentSession) return;

    const updatedMessages = currentSession.messages.map(msg =>
      msg.id === messageId ? { ...msg, editedContent } : msg
    );

    await saveMessages(updatedMessages);
  }, [currentSession, saveMessages]);

  // Load a specific session
  const loadSession = useCallback((session: AIChatSession) => {
    setCurrentSession(session);
  }, []);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('gp_consultation_ai_chats')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
      
      toast.success('Chat deleted');
    } catch (error) {
      console.error('Failed to delete AI chat:', error);
      toast.error('Failed to delete chat');
    }
  }, [user, currentSession?.id]);

  // Start a new chat
  const startNewChat = useCallback(() => {
    setCurrentSession(null);
    setIsNewChatMode(true);
  }, []);

  // Reset new chat mode when a session is created or loaded
  const handleCreateSession = useCallback(async (initialMessages: AIChatMessage[] = []) => {
    setIsNewChatMode(false);
    return createSession(initialMessages);
  }, [createSession]);

  const handleLoadSession = useCallback((session: AIChatSession) => {
    setIsNewChatMode(false);
    loadSession(session);
  }, [loadSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    sessions,
    currentSession,
    isLoading,
    isSaving,
    createSession: handleCreateSession,
    saveMessages,
    updateMessageContent,
    loadSession: handleLoadSession,
    deleteSession,
    startNewChat,
    loadSessions
  };
}
