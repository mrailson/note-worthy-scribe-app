import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showToast } from '@/utils/toastWrapper';

export interface AudioSession {
  id: string;
  user_id: string;
  title: string;
  original_script: string;
  edited_script: string | null;
  audio_url: string | null;
  voice_id: string;
  voice_name: string;
  duration_seconds: number | null;
  word_count: number;
  source_documents: string[];
  pronunciation_rules: any[];
  target_duration_minutes: number | null;
  script_style: string | null;
  custom_directions: string | null;
  created_at: string;
  updated_at: string;
}

export function useAudioOverviewHistory() {
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async (searchQuery?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    try {
      // Only select columns needed for list view
      let query = supabase
        .from('audio_overview_sessions')
        .select(`
          id,
          user_id,
          title,
          voice_id,
          voice_name,
          duration_seconds,
          word_count,
          source_documents,
          pronunciation_rules,
          script_style,
          audio_url,
          target_duration_minutes,
          custom_directions,
          created_at,
          updated_at,
          original_script,
          edited_script
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Server-side search using ilike for better performance
      if (searchQuery && searchQuery.trim()) {
        const searchPattern = `%${searchQuery}%`;
        query = query.or(`title.ilike.${searchPattern},original_script.ilike.${searchPattern},edited_script.ilike.${searchPattern}`);
      }

      const { data, error } = await query;

      if (error) throw error;

      const processedData = (data || []).map(session => ({
        ...session,
        source_documents: (session.source_documents as any) || [],
        pronunciation_rules: (session.pronunciation_rules as any) || [],
        custom_directions: (session as any).custom_directions || null,
      }));

      setSessions(processedData);
    } catch (error: any) {
      console.error('Error loading audio sessions:', error);
      showToast.error('Failed to load audio history', { section: 'ai4gp' });
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSession = async (sessionData: {
    title: string;
    original_script: string;
    edited_script: string;
    audio_url: string | null;
    voice_id: string;
    voice_name: string;
    duration_seconds?: number;
    source_documents: string[];
    pronunciation_rules: any[];
    target_duration_minutes: number;
    script_style?: string;
    custom_directions?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast.error('You must be logged in to save sessions', { section: 'ai4gp' });
      return null;
    }

    try {
      const wordCount = sessionData.edited_script.split(' ').filter(w => w.length > 0).length;

      const { data, error } = await supabase
        .from('audio_overview_sessions')
        .insert({
          user_id: user.id,
          title: sessionData.title,
          original_script: sessionData.original_script,
          edited_script: sessionData.edited_script,
          audio_url: sessionData.audio_url,
          voice_id: sessionData.voice_id,
          voice_name: sessionData.voice_name,
          duration_seconds: sessionData.duration_seconds,
          word_count: wordCount,
          source_documents: sessionData.source_documents,
          pronunciation_rules: sessionData.pronunciation_rules,
          target_duration_minutes: sessionData.target_duration_minutes,
          script_style: sessionData.script_style || 'executive',
          custom_directions: sessionData.custom_directions || null,
        })
        .select()
        .single();

      if (error) throw error;

      showToast.success('Audio session saved to history!', { section: 'ai4gp' });
      await loadSessions();
      return data;
    } catch (error: any) {
      console.error('Error saving audio session:', error);
      showToast.error('Failed to save audio session', { section: 'ai4gp' });
      return null;
    }
  };

  const updateSession = async (sessionId: string, updates: {
    title?: string;
    edited_script?: string;
    audio_url?: string;
    duration_seconds?: number;
    pronunciation_rules?: any[];
    custom_directions?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      const updateData: any = { ...updates };
      
      // Recalculate word count if script changed
      if (updates.edited_script) {
        updateData.word_count = updates.edited_script.split(' ').filter(w => w.length > 0).length;
      }

      const { data, error } = await supabase
        .from('audio_overview_sessions')
        .update(updateData)
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      showToast.success('Session updated successfully!', { section: 'ai4gp' });
      await loadSessions();
      return data;
    } catch (error: any) {
      console.error('Error updating session:', error);
      showToast.error('Failed to update session', { section: 'ai4gp' });
      return null;
    }
  };

  const deleteSession = async (sessionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('audio_overview_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      showToast.success('Session deleted', { section: 'ai4gp' });
      await loadSessions();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      showToast.error('Failed to delete session', { section: 'ai4gp' });
    }
  };

  const duplicateSession = async (sessionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) throw new Error('Session not found');

      const newSession = await saveSession({
        title: `${session.title} (Copy)`,
        original_script: session.original_script,
        edited_script: session.edited_script || session.original_script,
        audio_url: null, // Don't copy audio, user will regenerate
        voice_id: session.voice_id,
        voice_name: session.voice_name,
        source_documents: session.source_documents,
        pronunciation_rules: session.pronunciation_rules,
        target_duration_minutes: session.target_duration_minutes || 3,
      });

      if (newSession) {
        showToast.success('Session duplicated! Audio will need to be regenerated.', { section: 'ai4gp' });
      }
      return newSession;
    } catch (error: any) {
      console.error('Error duplicating session:', error);
      showToast.error('Failed to duplicate session', { section: 'ai4gp' });
      return null;
    }
  };

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  return {
    sessions,
    loading,
    loadSessions,
    saveSession,
    updateSession,
    deleteSession,
    duplicateSession,
  };
}
