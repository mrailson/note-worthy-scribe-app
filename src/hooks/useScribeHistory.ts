import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/toastWrapper";
import { ScribeSession, ConsultationCategory, ConsultationType } from "@/types/scribe";
import { format, isToday, isYesterday, startOfWeek, isAfter } from "date-fns";

export type DateFilter = 'all' | 'today' | 'yesterday' | 'this_week';
export type CategoryFilter = 'all' | 'general' | 'agewell' | 'social_prescriber';

// Calculate word count from transcript text
const calculateWordCount = (transcript: string | null): number => {
  if (!transcript) return 0;
  return transcript.split(/\s+/).filter(word => word.length > 0).length;
};

// Generate a quick summary from SOAP Subjective section or overview
// IMPORTANT: This is a SCRIBE summary - describes what was discussed, NOT clinical impressions
const generateQuickSummary = (soapNotes: unknown, overview: string | null, transcript: string | null): string => {
  // Priority 1: Extract from Subjective (S) - what the patient discussed
  if (soapNotes) {
    try {
      const soap = typeof soapNotes === 'string' ? JSON.parse(soapNotes) : soapNotes;
      
      // Use Subjective section - describes what patient discussed (NOT Assessment which has clinical impressions)
      if (soap?.S) {
        // Remove common prefixes and extract the key discussion points
        const subjectiveText = soap.S
          .replace(/^(Patient presents with|Pt presents with|Patient reports|Pt reports|Patient discussed|Discussed)[:\s]*/i, '')
          .trim();
        
        const firstSentence = subjectiveText.split('.')[0]?.trim();
        
        if (firstSentence && firstSentence.length > 10) {
          // Add plan summary if available (e.g., "F/U 2 weeks")
          let planSuffix = '';
          if (soap?.P) {
            const followUp = soap.P.match(/(?:F\/U|Follow[-\s]?up)[:\s]*(\d+\s*(?:weeks?|days?|months?))/i);
            if (followUp) planSuffix = ` F/U ${followUp[1]}.`;
          }
          
          const summary = firstSentence.length > 110 
            ? firstSentence.substring(0, 107) + '...' 
            : firstSentence;
          return summary + planSuffix;
        }
      }
    } catch {
      // Fallback to overview
    }
  }
  
  // Priority 2: Use overview (but sanitise any clinical impression language)
  if (overview) {
    const sanitised = overview
      .replace(/clinical impression[:\s]*/gi, '')
      .replace(/working diagnosis[:\s]*/gi, '')
      .replace(/differential diagnos[ie]s[:\s]*/gi, '')
      .replace(/impression[:\s]*/gi, '')
      .trim();
    const firstSentence = sanitised.split('.')[0]?.trim();
    if (firstSentence && firstSentence.length > 10) {
      return firstSentence.length > 125 ? firstSentence.substring(0, 122) + '...' : firstSentence;
    }
  }
  
  // Priority 3: First meaningful line of transcript
  if (transcript) {
    const firstLine = transcript.split(/[.!?]/)[0]?.trim();
    if (firstLine && firstLine.length > 10) {
      return firstLine.length > 125 ? firstLine.substring(0, 122) + '...' : firstLine;
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

      // Fetch from dedicated gp_consultations table with joined notes and transcripts
      const { data, error } = await supabase
        .from('gp_consultations')
        .select(`
          *,
          gp_consultation_notes (*),
          gp_consultation_transcripts (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedSessions: ScribeSession[] = (data || []).map(item => {
        // Get transcript from joined table (1:1 relationship)
        const transcriptData = Array.isArray(item.gp_consultation_transcripts) 
          ? item.gp_consultation_transcripts[0] 
          : item.gp_consultation_transcripts;
        const transcript = transcriptData?.transcript_text || '';
        
        // Get notes from joined table (1:1 relationship)
        const notesData = Array.isArray(item.gp_consultation_notes) 
          ? item.gp_consultation_notes[0] 
          : item.gp_consultation_notes;
        const soapNotes = notesData?.soap_notes;
        const heidiNotes = notesData?.heidi_notes;

        return {
          id: item.id,
          title: item.title || 'Untitled Consultation',
          transcript,
          summary: '',
          actionItems: '',
          keyPoints: '',
          quickSummary: generateQuickSummary(soapNotes, null, transcript),
          duration: Math.ceil((item.duration_seconds || 0) / 60),
          wordCount: item.word_count || calculateWordCount(transcript),
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          status: item.status as 'recording' | 'completed' | 'archived' || 'completed',
          sessionType: 'consultation',
          consultationCategory: (item.consultation_category || 'general') as ConsultationCategory,
          consultationType: (item.consultation_type || 'f2f') as ConsultationType,
          soapNote: soapNotes ? {
            S: soapNotes.S || '',
            O: soapNotes.O || '',
            A: soapNotes.A || '',
            P: soapNotes.P || ''
          } : undefined,
          heidiNote: heidiNotes ? heidiNotes : undefined,
          // Patient context for memory jogger
          patientName: item.patient_name || undefined,
          patientNhsNumber: item.patient_nhs_number || undefined,
          patientDob: item.patient_dob || undefined,
          patientContextConfidence: item.patient_context_confidence || undefined,
        };
      });

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
    soapNote?: { S: string; O: string; A: string; P: string };
    heidiNote?: any;
    consultationType?: string;
    consultationCategory?: string;
    // Patient context for memory jogger
    patientName?: string;
    patientNhsNumber?: string;
    patientDob?: string;
    patientContextConfidence?: number;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast.error("User not authenticated", { section: 'gpscribe' });
        return null;
      }

      // 1. Insert into gp_consultations with patient context
      const { data: consultationData, error: consultationError } = await supabase
        .from('gp_consultations')
        .insert([{
          user_id: user.id,
          title: sessionData.title || `Consultation - ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
          consultation_type: sessionData.consultationType || 'f2f',
          consultation_category: sessionData.consultationCategory || 'general',
          status: 'completed',
          duration_seconds: (sessionData.duration || 0) * 60,
          word_count: sessionData.wordCount || 0,
          // Patient context
          patient_name: sessionData.patientName || null,
          patient_nhs_number: sessionData.patientNhsNumber || null,
          patient_dob: sessionData.patientDob || null,
          patient_context_confidence: sessionData.patientContextConfidence || null,
        }])
        .select()
        .single();

      if (consultationError) throw consultationError;

      const consultationId = consultationData.id;

      // 2. Insert transcript
      await supabase.from('gp_consultation_transcripts').insert([{
        consultation_id: consultationId,
        transcript_text: sessionData.transcript,
        transcription_service: 'whisper'
      }]);

      // 3. Insert notes if available
      if (sessionData.soapNote || sessionData.heidiNote) {
        await supabase.from('gp_consultation_notes').insert([{
          consultation_id: consultationId,
          note_format: sessionData.heidiNote ? 'heidi' : 'soap',
          soap_notes: sessionData.soapNote || null,
          heidi_notes: sessionData.heidiNote || null
        }]);
      }

      const newSession: ScribeSession = {
        id: consultationData.id,
        title: consultationData.title,
        transcript: sessionData.transcript,
        summary: sessionData.summary || '',
        actionItems: sessionData.actionItems || '',
        keyPoints: sessionData.keyPoints || '',
        duration: sessionData.duration || 0,
        wordCount: sessionData.wordCount || 0,
        createdAt: consultationData.created_at,
        status: 'completed',
        sessionType: 'consultation',
        consultationCategory: (sessionData.consultationCategory || 'general') as ConsultationCategory,
      };

      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession);
      showToast.success("Consultation saved successfully", { section: 'gpscribe' });
      return newSession;
    } catch (error) {
      console.error('Save session error:', error);
      showToast.error('Failed to save consultation', { section: 'gpscribe' });
      return null;
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      // Load from dedicated gp_consultations table with joined data
      const { data, error } = await supabase
        .from('gp_consultations')
        .select(`
          *,
          gp_consultation_notes (*),
          gp_consultation_transcripts (*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      // Get transcript from joined table
      const transcriptData = Array.isArray(data.gp_consultation_transcripts) 
        ? data.gp_consultation_transcripts[0] 
        : data.gp_consultation_transcripts;
      const transcript = transcriptData?.transcript_text || '';

      // Get notes from joined table
      const notesData = Array.isArray(data.gp_consultation_notes) 
        ? data.gp_consultation_notes[0] 
        : data.gp_consultation_notes;
      
      let soapNote: { S: string; O: string; A: string; P: string } | undefined;
      if (notesData?.soap_notes) {
        const soapData = typeof notesData.soap_notes === 'string' 
          ? JSON.parse(notesData.soap_notes) 
          : notesData.soap_notes;
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
        transcript,
        summary: '',
        actionItems: '',
        keyPoints: '',
        soapNote,
        heidiNote: notesData?.heidi_notes || undefined,
        duration: Math.ceil((data.duration_seconds || 0) / 60),
        wordCount: data.word_count || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        status: data.status as 'recording' | 'completed' | 'archived' || 'completed',
        sessionType: 'consultation',
        consultationType: (data.consultation_type || 'f2f') as ConsultationType,
        consultationCategory: (data.consultation_category || 'general') as ConsultationCategory,
        // Patient context
        patientName: data.patient_name || undefined,
        patientNhsNumber: data.patient_nhs_number || undefined,
        patientDob: data.patient_dob || undefined,
        patientContextConfidence: data.patient_context_confidence || undefined,
      };

      setCurrentSession(session);
      return session;
    } catch (error) {
      console.error('Load session error:', error);
      showToast.error('Failed to load consultation', { section: 'gpscribe' });
      return null;
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      // Delete from gp_consultations (cascade will delete related records)
      const { error } = await supabase
        .from('gp_consultations')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }

      showToast.success("Consultation deleted successfully", { section: 'gpscribe' });
      return true;
    } catch (error) {
      console.error('Delete session error:', error);
      showToast.error('Failed to delete consultation', { section: 'gpscribe' });
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
