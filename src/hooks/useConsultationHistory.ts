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
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("User not authenticated");
        return null;
      }

      const meetingData = {
        title: `GP Consultation - ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
        transcript: consultationData.transcript,
        summary: consultationData.gpSummary || "",
        created_at: new Date().toISOString(),
        user_id: user.id,
        meeting_type: consultationData.consultationType || "face-to-face",
        duration: consultationData.duration || 0,
        word_count: consultationData.wordCount || 0,
        gp_summary: consultationData.gpSummary || "",
        full_note: consultationData.fullNote || "",
        patient_copy: consultationData.patientCopy || "",
        trainee_feedback: consultationData.traineeFeedback || "",
        referral_letter: consultationData.referralLetter || ""
      };

      const { data, error } = await supabase
        .from('meetings')
        .insert([meetingData])
        .select()
        .single();

      if (error) throw error;

      setSavedMeetingId(data.id);
      setCompletedConsultation(data);
      toast.success("Consultation saved successfully");
      return data;
    } catch (error) {
      console.error('Save consultation error:', error);
      toast.error('Failed to save consultation');
      return null;
    }
  }, []);

  const loadConsultation = useCallback(async (meetingId: string) => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (error) throw error;

      setCompletedConsultation(data);
      setSavedMeetingId(meetingId);
      return data;
    } catch (error) {
      console.error('Load consultation error:', error);
      toast.error('Failed to load consultation');
      return null;
    }
  }, []);

  const updateConsultation = useCallback(async (meetingId: string, updates: any) => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .update(updates)
        .eq('id', meetingId)
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

  const deleteConsultation = useCallback(async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      if (savedMeetingId === meetingId) {
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