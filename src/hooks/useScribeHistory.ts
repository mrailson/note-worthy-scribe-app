import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/toastWrapper";
import { ScribeSession, ConsultationCategory } from "@/types/scribe";
import { format, isToday, isYesterday, startOfWeek, isAfter } from "date-fns";

export type DateFilter = 'all' | 'today' | 'yesterday' | 'this_week';
export type CategoryFilter = 'all' | 'general' | 'agewell' | 'social_prescriber';

// Generate a quick summary from SOAP notes or overview
const generateQuickSummary = (soapNotes: unknown, overview: string | null): string => {
  // Try to extract from SOAP Assessment first
  if (soapNotes) {
    try {
      const soap = typeof soapNotes === 'string' ? JSON.parse(soapNotes) : soapNotes;
      if (soap?.A) {
        // Take first sentence or first 100 chars
        const assessment = soap.A.split('.')[0]?.trim();
        if (assessment && assessment.length > 10) {
          return assessment.length > 100 ? assessment.substring(0, 97) + '...' : assessment;
        }
      }
    } catch {
      // Fallback to overview
    }
  }
  
  // Fallback to overview
  if (overview) {
    const firstSentence = overview.split('.')[0]?.trim();
    if (firstSentence && firstSentence.length > 10) {
      return firstSentence.length > 100 ? firstSentence.substring(0, 97) + '...' : firstSentence;
    }
  }
  
  return '';
};

export const useScribeHistory = () => {
  const [sessions, setSessions] = useState<ScribeSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<ScribeSession | null>(null);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
        .in('meeting_type', ['scribe', 'consultation'])
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
        quickSummary: generateQuickSummary(item.soap_notes, item.overview),
        duration: item.duration_minutes || 0,
        wordCount: item.word_count || 0,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        status: item.status as 'recording' | 'completed' | 'archived' || 'completed',
        sessionType: item.meeting_type,
        // consultation_category might not exist in DB yet, default to 'general'
        consultationCategory: 'general' as ConsultationCategory,
      }));

      setSessions(formattedSessions);
    } catch (error) {
      console.error('Fetch sessions error:', error);
      showToast.error('Failed to load session history', { section: 'gpscribe' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filtered sessions based on search and filters
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          session.title.toLowerCase().includes(search) ||
          session.transcript.toLowerCase().includes(search) ||
          session.summary?.toLowerCase().includes(search) ||
          session.quickSummary?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }
      
      // Date filter
      if (dateFilter !== 'all') {
        const sessionDate = new Date(session.createdAt);
        if (dateFilter === 'today' && !isToday(sessionDate)) return false;
        if (dateFilter === 'yesterday' && !isYesterday(sessionDate)) return false;
        if (dateFilter === 'this_week') {
          const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
          if (!isAfter(sessionDate, weekStart)) return false;
        }
      }
      
      // Category filter
      if (categoryFilter !== 'all') {
        if (session.consultationCategory !== categoryFilter) return false;
      }
      
      return true;
    });
  }, [sessions, searchTerm, dateFilter, categoryFilter]);

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
        showToast.error("User not authenticated", { section: 'gpscribe' });
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
      showToast.success("Session saved successfully", { section: 'gpscribe' });
      return newSession;
    } catch (error) {
      console.error('Save session error:', error);
      showToast.error('Failed to save session', { section: 'gpscribe' });
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

      // Parse SOAP notes if they exist
      let soapNote: { S: string; O: string; A: string; P: string } | undefined;
      if (data.soap_notes) {
        const soapData = typeof data.soap_notes === 'string' 
          ? JSON.parse(data.soap_notes) 
          : data.soap_notes;
        soapNote = {
          S: soapData.S || '',
          O: soapData.O || '',
          A: soapData.A || '',
          P: soapData.P || ''
        };
      }

      const session: ScribeSession = {
        id: data.id,
        title: data.title,
        transcript: data.live_transcript_text || data.whisper_transcript_text || '',
        summary: data.overview || '',
        actionItems: data.notes_style_2 || '',
        keyPoints: data.notes_style_3 || '',
        soapNote,
        duration: data.duration_minutes || 0,
        wordCount: data.word_count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        status: data.status as 'recording' | 'completed' | 'archived' || 'completed',
        sessionType: data.meeting_type,
        consultationType: data.meeting_type === 'consultation' ? 'f2f' : undefined,
      };

      setCurrentSession(session);
      return session;
    } catch (error) {
      console.error('Load session error:', error);
      showToast.error('Failed to load session', { section: 'gpscribe' });
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

      showToast.success("Session deleted successfully", { section: 'gpscribe' });
      return true;
    } catch (error) {
      console.error('Delete session error:', error);
      showToast.error('Failed to delete session', { section: 'gpscribe' });
      return false;
    }
  }, [currentSession]);

  const clearCurrentSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  return {
    sessions,
    filteredSessions,
    isLoading,
    currentSession,
    fetchSessions,
    saveSession,
    loadSession,
    deleteSession,
    clearCurrentSession,
    setCurrentSession,
    // Search and filter
    searchTerm,
    setSearchTerm,
    dateFilter,
    setDateFilter,
    categoryFilter,
    setCategoryFilter,
  };
};
