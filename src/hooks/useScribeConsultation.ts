import { useState, useCallback, useRef, useEffect } from "react";
import { 
  ConsultationState, 
  ConsultationType, 
  ConsultationNote, 
  ScribeConsultation,
  SOAPNote,
  ScribeSettings,
  DEFAULT_SCRIBE_SETTINGS
} from "@/types/scribe";
import { useScribeRecording } from "./useScribeRecording";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatSoapNote } from "@/utils/emrFormatters";

export const useScribeConsultation = () => {
  const [consultationState, setConsultationState] = useState<ConsultationState>('ready');
  const [consultationType, setConsultationType] = useState<ConsultationType>('f2f');
  const [patientConsent, setPatientConsent] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState<string | undefined>();
  const [consultationNote, setConsultationNote] = useState<ConsultationNote | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<ScribeSettings>(DEFAULT_SCRIBE_SETTINGS);
  
  // Edit states for SOAP sections
  const [editStates, setEditStates] = useState({
    S: false, O: false, A: false, P: false
  });
  const [editContent, setEditContent] = useState({
    S: '', O: '', A: '', P: ''
  });
  
  const consultationIdRef = useRef<string | null>(null);
  
  const recording = useScribeRecording();

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scribeSettings');
      if (saved) {
        setSettings({ ...DEFAULT_SCRIBE_SETTINGS, ...JSON.parse(saved) });
      }
    } catch (e) {
      console.warn('Failed to load scribe settings:', e);
    }
  }, []);

  // Start consultation
  const startConsultation = useCallback(async () => {
    if (settings.showConsentReminder && !patientConsent) {
      toast.error("Please confirm patient consent before starting");
      return false;
    }

    try {
      consultationIdRef.current = `consult_${Date.now()}`;
      
      if (patientConsent) {
        setConsentTimestamp(new Date().toISOString());
      }
      
      await recording.startRecording();
      setConsultationState('recording');
      
      return true;
    } catch (error) {
      console.error('Failed to start consultation:', error);
      toast.error('Failed to start consultation');
      return false;
    }
  }, [patientConsent, recording, settings.showConsentReminder]);

  // Finish consultation and generate notes
  const finishConsultation = useCallback(async () => {
    try {
      const result = await recording.stopRecording();
      
      if (!result?.transcript?.trim()) {
        toast.error("No transcript available to generate notes");
        setConsultationState('ready');
        return;
      }

      setConsultationState('generating');
      setIsGenerating(true);

      console.log('Generating SOAP notes for consultation...');

      const { data, error } = await supabase.functions.invoke('generate-scribe-notes', {
        body: { 
          transcript: result.transcript,
          consultationType,
          outputFormat: 'soap'
        }
      });

      if (error) throw error;

      const note: ConsultationNote = {
        soapNote: {
          S: data.S || data.subjective || '',
          O: data.O || data.objective || '',
          A: data.A || data.assessment || '',
          P: data.P || data.plan || ''
        },
        snomedCodes: data.snomedCodes || []
      };

      setConsultationNote(note);
      setEditContent({
        S: note.soapNote.S,
        O: note.soapNote.O,
        A: note.soapNote.A,
        P: note.soapNote.P
      });
      
      setConsultationState('review');
      toast.success('Notes generated successfully');
    } catch (error) {
      console.error('Error generating notes:', error);
      toast.error('Failed to generate notes. Please try again.');
      setConsultationState('recording');
    } finally {
      setIsGenerating(false);
    }
  }, [recording, consultationType]);

  // Cancel consultation
  const cancelConsultation = useCallback(async () => {
    await recording.stopRecording();
    recording.resetRecording();
    setConsultationState('ready');
    setConsultationNote(null);
    setPatientConsent(false);
    setConsentTimestamp(undefined);
    toast.info('Consultation cancelled');
  }, [recording]);

  // New consultation (from review state)
  const newConsultation = useCallback(() => {
    recording.resetRecording();
    setConsultationState('ready');
    setConsultationNote(null);
    setPatientConsent(false);
    setConsentTimestamp(undefined);
    setEditStates({ S: false, O: false, A: false, P: false });
    setEditContent({ S: '', O: '', A: '', P: '' });
  }, [recording]);

  // Copy to clipboard with EMR formatting
  const copyToClipboard = useCallback(async (section?: keyof SOAPNote) => {
    if (!consultationNote?.soapNote) return;

    try {
      const formattedText = formatSoapNote(
        settings.emrFormat,
        consultationNote.soapNote,
        section,
        CONSULTATION_TYPE_LABELS[consultationType]
      );

      await navigator.clipboard.writeText(formattedText);
      toast.success(section ? `${section} copied to clipboard` : 'Notes copied to clipboard');
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Failed to copy to clipboard');
    }
  }, [consultationNote, settings.emrFormat, consultationType]);

  // Edit section
  const startEdit = useCallback((section: keyof SOAPNote) => {
    if (!consultationNote?.soapNote) return;
    setEditContent(prev => ({
      ...prev,
      [section]: consultationNote.soapNote[section]
    }));
    setEditStates(prev => ({ ...prev, [section]: true }));
  }, [consultationNote]);

  const cancelEdit = useCallback((section: keyof SOAPNote) => {
    setEditStates(prev => ({ ...prev, [section]: false }));
  }, []);

  const saveEdit = useCallback((section: keyof SOAPNote) => {
    if (!consultationNote) return;
    
    setConsultationNote(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        soapNote: {
          ...prev.soapNote,
          [section]: editContent[section]
        }
      };
    });
    setEditStates(prev => ({ ...prev, [section]: false }));
    toast.success(`${section} section updated`);
  }, [consultationNote, editContent]);

  // Update edit content
  const updateEditContent = useCallback((section: keyof SOAPNote, content: string) => {
    setEditContent(prev => ({ ...prev, [section]: content }));
  }, []);

  // Update settings
  const updateSetting = useCallback(<K extends keyof ScribeSettings>(
    key: K, 
    value: ScribeSettings[K]
  ) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem('scribeSettings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Save consultation to database
  const saveConsultation = useCallback(async () => {
    if (!consultationNote?.soapNote) {
      toast.error('No notes to save');
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        toast.error('Not authenticated');
        return;
      }

      const soapNote = consultationNote.soapNote;
      const summaryText = `${soapNote.S}\n\n${soapNote.O}\n\n${soapNote.A}\n\n${soapNote.P}`;

      const { error } = await supabase.from('meetings').insert({
        user_id: userData.user.id,
        consultation_type: CONSULTATION_TYPE_LABELS[consultationType],
        live_transcript_text: recording.transcript,
        summary: summaryText,
        overview: `${soapNote.S.substring(0, 100)}...`,
        notes_style_2: soapNote.A,
        notes_style_3: soapNote.P,
        status: 'completed',
        duration_seconds: recording.duration
      });

      if (error) throw error;
      toast.success('Consultation saved');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save consultation');
    }
  }, [consultationNote, consultationType, recording]);

  return {
    // State
    consultationState,
    consultationType,
    patientConsent,
    consentTimestamp,
    consultationNote,
    isGenerating,
    settings,
    editStates,
    editContent,
    
    // Recording passthrough
    isRecording: recording.isRecording,
    isPaused: recording.isPaused,
    duration: recording.duration,
    transcript: recording.transcript,
    realtimeTranscripts: recording.realtimeTranscripts,
    connectionStatus: recording.connectionStatus,
    wordCount: recording.wordCount,
    formatDuration: recording.formatDuration,
    
    // Actions
    setConsultationType,
    setPatientConsent,
    startConsultation,
    finishConsultation,
    cancelConsultation,
    newConsultation,
    copyToClipboard,
    startEdit,
    cancelEdit,
    saveEdit,
    updateEditContent,
    updateSetting,
    saveConsultation,
    pauseRecording: recording.pauseRecording,
    resumeRecording: recording.resumeRecording,
  };
};

const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  f2f: 'Face to Face',
  telephone: 'Telephone',
  video: 'Video'
};
