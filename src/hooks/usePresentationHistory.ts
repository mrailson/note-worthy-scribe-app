import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { PresentationContent } from "@/types/presentation";

export interface PresentationSession {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  presentation_type: string;
  template_id: string;
  slide_count: number;
  complexity_level: string;
  voice_id: string;
  voice_name: string;
  slides: any[];
  slide_images?: { [key: number]: string };
  source_documents: string[];
  background_image?: string;
  created_at: string;
  updated_at: string;
}

export const usePresentationHistory = () => {
  const [sessions, setSessions] = useState<PresentationSession[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async (searchQuery?: string) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return;
      }

      const { data, error } = await supabase
        .from('presentation_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Cast data to proper types
      let filteredData = (data || []).map(session => ({
        ...session,
        slides: session.slides as any[],
        slide_images: session.slide_images as { [key: number]: string } | undefined,
        source_documents: session.source_documents as string[]
      }));

      // Client-side search filtering
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredData = filteredData.filter(session =>
          session.title.toLowerCase().includes(query) ||
          session.topic.toLowerCase().includes(query) ||
          session.presentation_type.toLowerCase().includes(query)
        );
      }

      setSessions(filteredData);
    } catch (error) {
      console.error('Load sessions error:', error);
      toast.error('Failed to load presentation sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSession = useCallback(async (sessionData: {
    title: string;
    topic: string;
    presentation_type: string;
    template_id: string;
    slide_count: number;
    complexity_level: string;
    voice_id: string;
    voice_name: string;
    slides: any[];
    slide_images?: { [key: number]: string };
    source_documents: string[];
    background_image?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return null;
      }

      const { data, error } = await supabase
        .from('presentation_sessions')
        .insert([{
          ...sessionData,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success("Presentation saved successfully");
      await loadSessions();
      return data;
    } catch (error) {
      console.error('Save session error:', error);
      toast.error('Failed to save presentation');
      return null;
    }
  }, [loadSessions]);

  const updateSession = useCallback(async (sessionId: string, updates: Partial<PresentationSession>) => {
    try {
      const { data, error } = await supabase
        .from('presentation_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;

      toast.success("Presentation updated successfully");
      await loadSessions();
      return data;
    } catch (error) {
      console.error('Update session error:', error);
      toast.error('Failed to update presentation');
      return null;
    }
  }, [loadSessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('presentation_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast.success("Presentation deleted successfully");
      await loadSessions();
      return true;
    } catch (error) {
      console.error('Delete session error:', error);
      toast.error('Failed to delete presentation');
      return false;
    }
  }, [loadSessions]);

  const duplicateSession = useCallback(async (sessionId: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        toast.error("Session not found");
        return null;
      }

      const duplicatedSession = {
        title: `${session.title} (Copy)`,
        topic: session.topic,
        presentation_type: session.presentation_type,
        template_id: session.template_id,
        slide_count: session.slide_count,
        complexity_level: session.complexity_level,
        voice_id: session.voice_id,
        voice_name: session.voice_name,
        slides: session.slides,
        slide_images: session.slide_images,
        source_documents: session.source_documents,
        background_image: session.background_image
      };

      const result = await saveSession(duplicatedSession);
      if (result) {
        toast.success("Presentation duplicated successfully");
      }
      return result;
    } catch (error) {
      console.error('Duplicate session error:', error);
      toast.error('Failed to duplicate presentation');
      return null;
    }
  }, [sessions, saveSession]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    loading,
    loadSessions,
    saveSession,
    updateSession,
    deleteSession,
    duplicateSession
  };
};
