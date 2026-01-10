import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export const useConsultationHistory = () => {
  const [completedConsultation, setCompletedConsultation] = useState<any>(null);
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);

  const saveConsultation = useCallback(async (consultationData: {
    transcript: string;
    gpSummary?: string;
    fullNote?: string;
    patientCopy?: string;
    traineeFeedback?: string;
    referralLetter?: string;
    consultationType?: string;
    duration?: number;
    wordCount?: number;
    soapNotes?: { S: string; O: string; A: string; P: string };
    heidiNotes?: any;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return null;
      }

      // 1. Insert into gp_consultations
      const { data: consultationRecord, error: consultationError } = await supabase
        .from('gp_consultations')
        .insert([{
          user_id: user.id,
          title: `GP Consultation - ${format(new Date(), 'dd MMM yyyy HH:mm')}`,
          consultation_type: consultationData.consultationType || 'f2f',
          status: 'completed',
          duration_seconds: consultationData.duration || 0,
          word_count: consultationData.wordCount || 0
        }])
        .select()
        .single();

      if (consultationError) throw consultationError;

      const consultationId = consultationRecord.id;

      // 2. Insert transcript
      await supabase.from('gp_consultation_transcripts').insert([{
        consultation_id: consultationId,
        transcript_text: consultationData.transcript,
        transcription_service: 'whisper'
      }]);

      // 3. Insert notes
      await supabase.from('gp_consultation_notes').insert([{
        consultation_id: consultationId,
        note_format: consultationData.heidiNotes ? 'heidi' : 'soap',
        soap_notes: consultationData.soapNotes || null,
        heidi_notes: consultationData.heidiNotes || null,
        patient_letter: consultationData.patientCopy || null,
        referral_letter: consultationData.referralLetter || null,
        trainee_feedback: consultationData.traineeFeedback || null
      }]);

      setSavedMeetingId(consultationRecord.id);
      setCompletedConsultation(consultationRecord);
      toast.success("Consultation saved successfully");
      return consultationRecord;
    } catch (error) {
      console.error('Save consultation error:', error);
      toast.error('Failed to save consultation');
      return null;
    }
  }, []);

  const loadConsultation = useCallback(async (consultationId: string) => {
    try {
      const { data, error } = await supabase
        .from('gp_consultations')
        .select(`
          *,
          gp_consultation_notes (*),
          gp_consultation_transcripts (*)
        `)
        .eq('id', consultationId)
        .single();

      if (error) throw error;

      setCompletedConsultation(data);
      setSavedMeetingId(consultationId);
      return data;
    } catch (error) {
      console.error('Load consultation error:', error);
      toast.error('Failed to load consultation');
      return null;
    }
  }, []);

  const updateConsultation = useCallback(async (consultationId: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('gp_consultations')
        .update(updates)
        .eq('id', consultationId)
        .select()
        .single();

      if (error) throw error;

      setCompletedConsultation(data);
      toast.success("Consultation updated successfully");
      return data;
    } catch (error) {
      console.error('Update consultation error:', error);
      toast.error('Failed to update consultation');
      return null;
    }
  }, []);

  const deleteConsultation = useCallback(async (consultationId: string) => {
    try {
      // Delete from gp_consultations (cascade handles related records)
      const { error } = await supabase
        .from('gp_consultations')
        .delete()
        .eq('id', consultationId);

      if (error) throw error;

      if (savedMeetingId === consultationId) {
        setSavedMeetingId(null);
        setCompletedConsultation(null);
      }

      toast.success("Consultation deleted successfully");
      return true;
    } catch (error) {
      console.error('Delete consultation error:', error);
      toast.error('Failed to delete consultation');
      return false;
    }
  }, [savedMeetingId]);

  const clearConsultation = useCallback(() => {
    setCompletedConsultation(null);
    setSavedMeetingId(null);
  }, []);

  return {
    // States
    completedConsultation,
    savedMeetingId,

    // Actions
    saveConsultation,
    loadConsultation,
    updateConsultation,
    deleteConsultation,
    clearConsultation,
    setCompletedConsultation,
    setSavedMeetingId
  };
};