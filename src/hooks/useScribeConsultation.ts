import { useState, useCallback, useRef, useEffect } from "react";
import { 
  ConsultationState, 
  ConsultationType, 
  ConsultationCategory,
  ConsultationNote, 
  ConsultationViewMode,
  ScribeConsultation,
  SOAPNote,
  HeidiNote,
  ScribeSettings,
  DEFAULT_SCRIBE_SETTINGS,
  CONSULTATION_TYPE_LABELS,
  HeidiEditStates,
  HeidiEditContent,
  PatientContext,
  ConsultationContextFile
} from "@/types/scribe";
import { useScribeRecording } from "./useScribeRecording";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/toastWrapper";
import { formatSoapNote, formatHeidiNote } from "@/utils/emrFormatters";

export const useScribeConsultation = () => {
  const [consultationState, setConsultationState] = useState<ConsultationState>('ready');
  const [consultationType, setConsultationType] = useState<ConsultationType>('f2f');
  const [consultationCategory, setConsultationCategory] = useState<ConsultationCategory>('general');
  const [patientConsent, setPatientConsent] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState<string | undefined>();
  const [consultationNote, setConsultationNote] = useState<ConsultationNote | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [settings, setSettings] = useState<ScribeSettings>(DEFAULT_SCRIBE_SETTINGS);
  const [patientContext, setPatientContext] = useState<PatientContext | null>(null);
  const [contextFiles, setContextFiles] = useState<ConsultationContextFile[]>([]);
  const [importedTranscript, setImportedTranscript] = useState<string>('');
  
  // Edit states for SOAP sections (legacy)
  const [editStates, setEditStates] = useState({
    S: false, O: false, A: false, P: false
  });
  const [editContent, setEditContent] = useState({
    S: '', O: '', A: '', P: ''
  });

  // Edit states for Heidi sections
  const [heidiEditStates, setHeidiEditStates] = useState<HeidiEditStates>({
    consultationHeader: false,
    history: false,
    examination: false,
    impression: false,
    plan: false
  });
  const [heidiEditContent, setHeidiEditContent] = useState<HeidiEditContent>({
    consultationHeader: '',
    history: '',
    examination: '',
    impression: '',
    plan: ''
  });

  // View mode state for toggling between SOAP/Narrative/Summary
  const [viewMode, setViewMode] = useState<ConsultationViewMode>('soap');
  
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
      showToast.error("Please confirm patient consent before starting", { section: 'gpscribe' });
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
      showToast.error('Failed to start consultation', { section: 'gpscribe' });
      return false;
    }
  }, [patientConsent, recording, settings.showConsentReminder]);

  // Finish consultation and generate notes
  const finishConsultation = useCallback(async () => {
    try {
      const result = await recording.stopRecording();
      
      if (!result?.transcript?.trim()) {
        showToast.error("No transcript available to generate notes", { section: 'gpscribe' });
        setConsultationState('ready');
        return;
      }

      setConsultationState('generating');
      setIsGenerating(true);

      console.log('Generating notes for consultation using Heidi format...');

      // Prepare context content from files
      const contextContent = contextFiles
        .filter(f => !f.isProcessing && !f.error && f.content)
        .map(f => `[${f.name}]:\n${f.content}`)
        .join('\n\n');

      const { data, error } = await supabase.functions.invoke('generate-scribe-notes', {
        body: { 
          transcript: result.transcript,
          consultationType,
          outputFormat: 'heidi',
          noteFormat: settings.noteFormat,
          detailLevel: settings.consultationDetailLevel,
          contextContent: contextContent || undefined
        }
      });

      if (error) throw error;

      // Build the note object based on returned data
      const note: ConsultationNote = {
        soapNote: {
          S: data.S || data.history || '',
          O: data.O || data.examination || '',
          A: data.A || data.impression || '',
          P: data.P || data.plan || ''
        },
        heidiNote: data.consultationHeader !== undefined ? {
          consultationHeader: data.consultationHeader || '',
          history: data.history || '',
          examination: data.examination || '',
          impression: data.impression || '',
          plan: data.plan || ''
        } : undefined,
        noteFormat: data.noteFormat || settings.noteFormat,
        snomedCodes: data.snomedCodes || []
      };

      setConsultationNote(note);
      
      // Set edit content for SOAP
      setEditContent({
        S: note.soapNote.S,
        O: note.soapNote.O,
        A: note.soapNote.A,
        P: note.soapNote.P
      });

      // Set edit content for Heidi if available
      if (note.heidiNote) {
        setHeidiEditContent({
          consultationHeader: note.heidiNote.consultationHeader,
          history: note.heidiNote.history,
          examination: note.heidiNote.examination,
          impression: note.heidiNote.impression,
          plan: note.heidiNote.plan
        });
      }
      
      setConsultationState('review');
      showToast.success('Notes generated successfully', { section: 'gpscribe' });
    } catch (error) {
      console.error('Error generating notes:', error);
      showToast.error('Failed to generate notes. Please try again.', { section: 'gpscribe' });
      setConsultationState('recording');
    } finally {
      setIsGenerating(false);
    }
  }, [recording, consultationType, settings.noteFormat, settings.consultationDetailLevel]);

  // Regenerate notes from existing transcript
  const regenerateNotes = useCallback(async () => {
    const transcript = recording.transcript || importedTranscript;
    
    if (!transcript?.trim()) {
      showToast.error("No transcript available to regenerate notes", { section: 'gpscribe' });
      return;
    }

    try {
      setIsGenerating(true);
      showToast.info('Regenerating notes with updated prompts...', { section: 'gpscribe' });

      const { data, error } = await supabase.functions.invoke('generate-scribe-notes', {
        body: { 
          transcript,
          consultationType,
          outputFormat: 'heidi',
          noteFormat: settings.noteFormat,
          detailLevel: settings.consultationDetailLevel
        }
      });

      if (error) throw error;

      // Build the note object based on returned data
      const note: ConsultationNote = {
        soapNote: {
          S: data.S || data.history || '',
          O: data.O || data.examination || '',
          A: data.A || data.impression || '',
          P: data.P || data.plan || ''
        },
        heidiNote: data.consultationHeader !== undefined ? {
          consultationHeader: data.consultationHeader || '',
          history: data.history || '',
          examination: data.examination || '',
          impression: data.impression || '',
          plan: data.plan || ''
        } : undefined,
        noteFormat: data.noteFormat || settings.noteFormat,
        snomedCodes: data.snomedCodes || []
      };

      setConsultationNote(note);
      
      // Set edit content for SOAP
      setEditContent({
        S: note.soapNote.S,
        O: note.soapNote.O,
        A: note.soapNote.A,
        P: note.soapNote.P
      });

      // Set edit content for Heidi if available
      if (note.heidiNote) {
        setHeidiEditContent({
          consultationHeader: note.heidiNote.consultationHeader,
          history: note.heidiNote.history,
          examination: note.heidiNote.examination,
          impression: note.heidiNote.impression,
          plan: note.heidiNote.plan
        });
      }
      
      showToast.success('Notes regenerated successfully', { section: 'gpscribe' });
    } catch (error) {
      console.error('Error regenerating notes:', error);
      showToast.error('Failed to regenerate notes', { section: 'gpscribe' });
    } finally {
      setIsGenerating(false);
    }
  }, [recording.transcript, importedTranscript, consultationType, settings.noteFormat, settings.consultationDetailLevel]);

  // Cancel consultation
  const cancelConsultation = useCallback(async () => {
    await recording.stopRecording();
    recording.resetRecording();
    setConsultationState('ready');
    setConsultationNote(null);
    setPatientConsent(false);
    setConsentTimestamp(undefined);
    showToast.info('Consultation cancelled', { section: 'gpscribe' });
  }, [recording]);

  // New consultation (from review state)
  const newConsultation = useCallback(() => {
    recording.resetRecording();
    setConsultationState('ready');
    setConsultationNote(null);
    setPatientConsent(false);
    setConsentTimestamp(undefined);
    setPatientContext(null);
    setContextFiles([]);
    setIsSaved(false); // Reset saved state for new consultation
    setEditStates({ S: false, O: false, A: false, P: false });
    setEditContent({ S: '', O: '', A: '', P: '' });
    setHeidiEditStates({
      consultationHeader: false,
      history: false,
      examination: false,
      impression: false,
      plan: false
    });
    setHeidiEditContent({
      consultationHeader: '',
      history: '',
      examination: '',
      impression: '',
      plan: ''
    });
  }, [recording]);

  // Context file management
  const addContextFile = useCallback((file: ConsultationContextFile) => {
    setContextFiles(prev => [...prev, file]);
  }, []);

  const removeContextFile = useCallback((fileId: string) => {
    setContextFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // Clear patient context
  const clearPatientContext = useCallback(() => {
    setPatientContext(null);
  }, []);

  // Set imported consultation from external source (Import tab)
  const setImportedConsultation = useCallback((notes: ConsultationNote, transcript: string) => {
    setImportedTranscript(transcript);
    setConsultationNote(notes);
    
    // Set edit content for SOAP
    setEditContent({
      S: notes.soapNote.S,
      O: notes.soapNote.O,
      A: notes.soapNote.A,
      P: notes.soapNote.P
    });

    // Set edit content for Heidi if available
    if (notes.heidiNote) {
      setHeidiEditContent({
        consultationHeader: notes.heidiNote.consultationHeader,
        history: notes.heidiNote.history,
        examination: notes.heidiNote.examination,
        impression: notes.heidiNote.impression,
        plan: notes.heidiNote.plan
      });
    }
    
    setConsultationState('review');
    setIsSaved(false);
  }, []);

  // Copy to clipboard with EMR formatting
  const copyToClipboard = useCallback(async (section?: keyof SOAPNote) => {
    if (!consultationNote) return;

    try {
      let formattedText: string;
      
      // Use Heidi format if available, otherwise fall back to SOAP
      if (consultationNote.heidiNote && consultationNote.noteFormat === 'heidi') {
        // Map SOAP section keys to Heidi keys for section copying
        const heidiSectionMap: Record<keyof SOAPNote, keyof HeidiNote> = {
          S: 'history',
          O: 'examination',
          A: 'impression',
          P: 'plan'
        };
        const heidiSection = section ? heidiSectionMap[section] : undefined;
        formattedText = formatHeidiNote(
          settings.emrFormat,
          consultationNote.heidiNote,
          heidiSection
        );
      } else {
        formattedText = formatSoapNote(
          settings.emrFormat,
          consultationNote.soapNote,
          section,
          CONSULTATION_TYPE_LABELS[consultationType]
        );
      }

      await navigator.clipboard.writeText(formattedText);
      showToast.success(section ? `${section} copied to clipboard` : 'Notes copied to clipboard', { section: 'gpscribe' });
    } catch (error) {
      console.error('Copy failed:', error);
      showToast.error('Failed to copy to clipboard', { section: 'gpscribe' });
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
    showToast.success(`${section} section updated`, { section: 'gpscribe' });
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

  // Save consultation to database (using dedicated gp_consultations tables)
  const saveConsultation = useCallback(async () => {
    // Guard against duplicate saves
    if (isSaving) {
      console.log('Save already in progress, ignoring duplicate call');
      return;
    }
    
    if (isSaved) {
      showToast.info('Consultation already saved', { section: 'gpscribe' });
      return;
    }

    if (!consultationNote?.soapNote) {
      showToast.error('No notes to save', { section: 'gpscribe' });
      return;
    }

    try {
      setIsSaving(true);
      
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        showToast.error('Not authenticated', { section: 'gpscribe' });
        return;
      }

      // Use recording transcript or imported transcript
      const transcriptToSave = recording.transcript || importedTranscript;
      const wordCountToSave = recording.wordCount || 
        (importedTranscript ? importedTranscript.split(/\s+/).filter(w => w.length > 0).length : 0);
      const durationToSave = recording.duration || 0;

      // 1. Insert into gp_consultations (main table)
      const { data: consultationData, error: consultationError } = await supabase
        .from('gp_consultations')
        .insert([{
          user_id: userData.user.id,
          title: `${CONSULTATION_TYPE_LABELS[consultationType]} Consultation`,
          consultation_type: consultationType,
          consultation_category: consultationCategory,
          status: 'completed',
          patient_consent: patientConsent,
          consent_timestamp: consentTimestamp || null,
          duration_seconds: durationToSave,
          word_count: wordCountToSave
        }])
        .select()
        .single();

      if (consultationError) throw consultationError;

      const consultationId = consultationData.id;

      // 2. Insert transcript into gp_consultation_transcripts
      const { error: transcriptError } = await supabase
        .from('gp_consultation_transcripts')
        .insert([{
          consultation_id: consultationId,
          transcript_text: transcriptToSave,
          cleaned_transcript: transcriptToSave,
          transcription_service: importedTranscript ? 'imported' : 'whisper'
        }]);

      if (transcriptError) throw transcriptError;

      // 3. Insert notes into gp_consultation_notes
      const { error: notesError } = await supabase
        .from('gp_consultation_notes')
        .insert([{
          consultation_id: consultationId,
          note_format: consultationNote.noteFormat || 'heidi',
          note_style: settings.noteFormat,
          soap_notes: JSON.parse(JSON.stringify(consultationNote.soapNote)),
          heidi_notes: consultationNote.heidiNote ? JSON.parse(JSON.stringify(consultationNote.heidiNote)) : null,
          snomed_codes: consultationNote.snomedCodes || []
        }]);

      if (notesError) throw notesError;

      // 4. Insert context files if any
      if (contextFiles.length > 0) {
        const contextInserts = contextFiles
          .filter(f => !f.isProcessing && !f.error)
          .map(f => ({
            consultation_id: consultationId,
            name: f.name,
            content_type: f.type === 'image' ? 'image' : 'document',
            extracted_text: f.content || null,
            preview_url: f.preview || null
          }));

        if (contextInserts.length > 0) {
          const { error: contextError } = await supabase
            .from('gp_consultation_context')
            .insert(contextInserts);

          if (contextError) {
            console.warn('Failed to save context files:', contextError);
          }
        }
      }
      
      setIsSaved(true);
      showToast.success('Consultation saved', { section: 'gpscribe' });
    } catch (error) {
      console.error('Save error:', error);
      showToast.error('Failed to save consultation', { section: 'gpscribe' });
    } finally {
      setIsSaving(false);
    }
  }, [consultationNote, consultationType, consultationCategory, recording, importedTranscript, isSaving, isSaved, patientConsent, consentTimestamp, settings.noteFormat, contextFiles]);

  // Heidi section editing
  const startHeidiEdit = useCallback((section: keyof HeidiNote) => {
    if (!consultationNote?.heidiNote) return;
    setHeidiEditContent(prev => ({
      ...prev,
      [section]: consultationNote.heidiNote![section]
    }));
    setHeidiEditStates(prev => ({ ...prev, [section]: true }));
  }, [consultationNote]);

  const cancelHeidiEdit = useCallback((section: keyof HeidiNote) => {
    setHeidiEditStates(prev => ({ ...prev, [section]: false }));
  }, []);

  const saveHeidiEdit = useCallback((section: keyof HeidiNote) => {
    if (!consultationNote) return;
    
    setConsultationNote(prev => {
      if (!prev || !prev.heidiNote) return prev;
      return {
        ...prev,
        heidiNote: {
          ...prev.heidiNote,
          [section]: heidiEditContent[section]
        }
      };
    });
    setHeidiEditStates(prev => ({ ...prev, [section]: false }));
    showToast.success(`${section} section updated`, { section: 'gpscribe' });
  }, [consultationNote, heidiEditContent]);

  const updateHeidiEditContent = useCallback((section: keyof HeidiNote, content: string) => {
    setHeidiEditContent(prev => ({ ...prev, [section]: content }));
  }, []);

  // Copy Heidi section to clipboard
  const copyHeidiSection = useCallback(async (section: keyof HeidiNote) => {
    if (!consultationNote?.heidiNote) return;

    try {
      const formattedText = formatHeidiNote(
        settings.emrFormat,
        consultationNote.heidiNote,
        section
      );

      await navigator.clipboard.writeText(formattedText);
      showToast.success(`${section} copied to clipboard`, { section: 'gpscribe' });
    } catch (error) {
      console.error('Copy failed:', error);
      showToast.error('Failed to copy to clipboard', { section: 'gpscribe' });
    }
  }, [consultationNote, settings.emrFormat]);

  return {
    // State
    consultationState,
    consultationType,
    patientConsent,
    consentTimestamp,
    consultationNote,
    isGenerating,
    isSaving,
    isSaved,
    settings,
    editStates,
    editContent,
    heidiEditStates,
    heidiEditContent,
    consultationCategory,
    viewMode,
    patientContext,
    contextFiles,
    
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
    setConsultationCategory,
    setPatientConsent,
    startConsultation,
    finishConsultation,
    cancelConsultation,
    newConsultation,
    regenerateNotes,
    copyToClipboard,
    startEdit,
    cancelEdit,
    saveEdit,
    updateEditContent,
    updateSetting,
    saveConsultation,
    pauseRecording: recording.pauseRecording,
    resumeRecording: recording.resumeRecording,
    // Heidi-specific actions
    startHeidiEdit,
    cancelHeidiEdit,
    saveHeidiEdit,
    updateHeidiEditContent,
    copyHeidiSection,
    // View mode
    setViewMode,
    // Patient context
    setPatientContext,
    clearPatientContext,
    // Context files
    addContextFile,
    removeContextFile,
    // Import
    setImportedConsultation,
  };
};
