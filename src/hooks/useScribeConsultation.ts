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
import { useScribeRecording, AudioSourceMode } from "./useScribeRecording";
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/toastWrapper";
import { formatSoapNote, formatHeidiNote } from "@/utils/emrFormatters";

export const useScribeConsultation = (onAutoSaveComplete?: () => void) => {
  const [consultationState, setConsultationState] = useState<ConsultationState>('ready');
  const [consultationType, setConsultationType] = useState<ConsultationType>('f2f');
  const [f2fAccompanied, setF2fAccompanied] = useState(false);
  const [consultationCategory, setConsultationCategory] = useState<ConsultationCategory>('general');
  const [patientConsent, setPatientConsent] = useState(false);
  const [consentTimestamp, setConsentTimestamp] = useState<string | undefined>();
  const [consultationNote, setConsultationNote] = useState<ConsultationNote | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false); // Dedicated state for immediate feedback
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
  const [viewMode, setViewMode] = useState<ConsultationViewMode>('narrativeClinical');
  
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

  // Auto-set consent to true when consent reminder is disabled
  useEffect(() => {
    if (!settings.showConsentReminder) {
      setPatientConsent(true);
    }
  }, [settings.showConsentReminder]);

  // Get the appropriate microphone ID based on consultation type
  const getMicrophoneForType = useCallback((type: ConsultationType): string | undefined => {
    switch (type) {
      case 'f2f':
        return settings.f2fMicrophoneId;
      case 'telephone':
        return settings.telephoneMicrophoneId;
      case 'dictate':
        return settings.dictateMicrophoneId;
      default:
        return undefined;
    }
  }, [settings.f2fMicrophoneId, settings.telephoneMicrophoneId, settings.dictateMicrophoneId]);

  // Start consultation
  const startConsultation = useCallback(async (audioMode?: AudioSourceMode) => {
    if (settings.showConsentReminder && !patientConsent) {
      showToast.error("Please confirm patient consent before starting", { section: 'gpscribe' });
      return false;
    }

    try {
      consultationIdRef.current = `consult_${Date.now()}`;
      
      if (patientConsent) {
        setConsentTimestamp(new Date().toISOString());
      }
      
      // Get the microphone ID for the current consultation type
      const selectedMicrophoneId = getMicrophoneForType(consultationType);
      console.log(`🎤 Starting consultation with microphone: ${selectedMicrophoneId || 'default'} for type: ${consultationType}`);
      console.log(`🔊 Audio source mode: ${audioMode || 'microphone'}`);
      console.log(`🎵 Audio format: ${settings.audioFormat || 'webm'}, Chunk duration: ${settings.chunkDurationSeconds || 25}s`);
      
      await recording.startRecording(
        selectedMicrophoneId, 
        audioMode || 'microphone',
        settings.audioFormat,
        settings.chunkDurationSeconds
      );
      setConsultationState('recording');
      
      return true;
    } catch (error) {
      console.error('Failed to start consultation:', error);
      showToast.error('Failed to start consultation', { section: 'gpscribe' });
      return false;
    }
  }, [patientConsent, recording, settings.showConsentReminder, settings.audioFormat, settings.chunkDurationSeconds, consultationType, getMicrophoneForType]);

  // Internal save function for auto-save (returns promise, no toast on success)
  const saveConsultationInternal = useCallback(async (
    noteToSave: ConsultationNote,
    transcriptToSave: string,
    wordCountToSave: number,
    durationToSave: number,
    realtimeTranscriptToSave?: string,
    isSystmOneOptimised?: boolean
  ): Promise<boolean> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      throw new Error('Not authenticated');
    }

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
        word_count: wordCountToSave,
        patient_name: patientContext?.name || null,
        patient_nhs_number: patientContext?.nhsNumber || null,
        patient_dob: patientContext?.dateOfBirth || null,
        patient_context_confidence: patientContext?.confidence || null
      }])
      .select()
      .single();

    if (consultationError) throw consultationError;

    const consultationId = consultationData.id;

    // 2. Insert transcript (including realtime transcript if available)
    const { error: transcriptError } = await supabase
      .from('gp_consultation_transcripts')
      .insert([{
        consultation_id: consultationId,
        transcript_text: transcriptToSave,
        cleaned_transcript: transcriptToSave,
        transcription_service: 'assemblyai',
        realtime_transcript: realtimeTranscriptToSave || null
      }]);

    if (transcriptError) throw transcriptError;

    // 3. Insert notes (include systmOneNote in heidi_notes as nested object)
    const heidiNotesWithOptimised = noteToSave.heidiNote ? {
      ...noteToSave.heidiNote,
      systmOneOptimised: noteToSave.systmOneNote || null
    } : null;

    const { error: notesError } = await supabase
      .from('gp_consultation_notes')
      .insert([{
        consultation_id: consultationId,
        note_format: noteToSave.noteFormat || 'heidi',
        note_style: settings.noteFormat,
        soap_notes: JSON.parse(JSON.stringify(noteToSave.soapNote)),
        heidi_notes: heidiNotesWithOptimised ? JSON.parse(JSON.stringify(heidiNotesWithOptimised)) : null,
        snomed_codes: noteToSave.snomedCodes || [],
        is_systmone_optimised: !!noteToSave.systmOneNote
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
        await supabase.from('gp_consultation_context').insert(contextInserts);
      }
    }

    return true;
  }, [consultationType, consultationCategory, patientConsent, consentTimestamp, settings.noteFormat, contextFiles, patientContext]);

  // Auto-save with retry - now returns success/failure and notifies parent
  const autoSaveWithRetry = useCallback(async (
    noteToSave: ConsultationNote,
    transcriptToSave: string,
    wordCountToSave: number,
    durationToSave: number,
    realtimeTranscriptToSave?: string,
    isSystmOneOptimised?: boolean,
    maxRetries = 3
  ): Promise<boolean> => {
    setIsSaving(true);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await saveConsultationInternal(noteToSave, transcriptToSave, wordCountToSave, durationToSave, realtimeTranscriptToSave, isSystmOneOptimised);
        setIsSaved(true);
        setIsSaving(false);
        console.log('✅ Consultation auto-saved successfully');
        // Notify parent to refresh history
        onAutoSaveComplete?.();
        return true;
      } catch (error) {
        console.error(`Auto-save attempt ${attempt} failed:`, error);
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }
    // All retries failed - show error, allow manual retry
    setIsSaving(false);
    console.error('❌ All auto-save attempts failed');
    showToast.error('Auto-save failed. Click Save to retry.', { section: 'gpscribe' });
    return false;
  }, [saveConsultationInternal, onAutoSaveComplete]);

  // Finish consultation and generate notes (with auto-save)
  const finishConsultation = useCallback(async () => {
    // SET IMMEDIATELY - before any await operations
    setIsFinishing(true);
    
    try {
      const result = await recording.stopRecording();
      
      if (!result?.transcript?.trim()) {
        showToast.error("No transcript available to generate notes", { section: 'gpscribe' });
        setConsultationState('ready');
        setIsFinishing(false);
        return;
      }

      // Capture recording data before state changes
      const assemblyTranscript = recording.livePreviewFullTranscript?.trim() || '';
      const whisperTranscript = result.transcript?.trim() || '';
      
      // Get user's preferred transcript source from settings (default: batch/Whisper)
      const preferredSource = settings.noteTranscriptSource || 'batch';
      
      let transcriptForSave: string;
      let realtimeTranscriptForSave: string;
      let actualSourceUsed: string;
      
      if (preferredSource === 'batch') {
        // Prefer Whisper (Batch), fallback to AssemblyAI if empty
        if (whisperTranscript.length > 0) {
          transcriptForSave = whisperTranscript;
          realtimeTranscriptForSave = assemblyTranscript;
          actualSourceUsed = 'Whisper (Batch)';
        } else {
          transcriptForSave = assemblyTranscript;
          realtimeTranscriptForSave = '';
          actualSourceUsed = 'AssemblyAI (fallback - Whisper empty)';
        }
      } else {
        // Prefer AssemblyAI (Live), fallback to Whisper if empty
        if (assemblyTranscript.length > 0) {
          transcriptForSave = assemblyTranscript;
          realtimeTranscriptForSave = whisperTranscript;
          actualSourceUsed = 'AssemblyAI (Live)';
        } else {
          transcriptForSave = whisperTranscript;
          realtimeTranscriptForSave = '';
          actualSourceUsed = 'Whisper (fallback - AssemblyAI empty)';
        }
      }
      
      const wordCountForSave = transcriptForSave.split(/\s+/).filter((w: string) => w.length > 0).length;
      
      console.log(`📝 Using ${actualSourceUsed} as primary transcript (preferred: ${preferredSource}, ${wordCountForSave} words)`);
      const durationForSave = recording.duration;

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
          transcript: transcriptForSave,
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
      
      // Go directly to review state
      setConsultationState('review');
      
      // Auto-optimise for SystmOne before saving - store as separate systmOneNote
      let noteWithOptimisation = note;
      if (note.heidiNote) {
        console.log('🔧 Auto-optimising notes for SystmOne...');
        try {
          const optimiseResult = await supabase.functions.invoke('tighten-systmone-notes', {
            body: {
              history: note.heidiNote.history || '',
              examination: note.heidiNote.examination || '',
              assessment: note.heidiNote.impression || '',
              plan: note.heidiNote.plan || ''
            }
          });

          if (optimiseResult.data && !optimiseResult.error && !optimiseResult.data.error) {
            console.log('✅ SystmOne optimisation complete');
            // Store optimised version SEPARATELY in systmOneNote, keep original heidiNote intact
            noteWithOptimisation = {
              ...note,
              systmOneNote: {
                consultationHeader: note.heidiNote.consultationHeader,
                history: optimiseResult.data.history || note.heidiNote.history,
                examination: optimiseResult.data.examination || note.heidiNote.examination,
                impression: optimiseResult.data.assessment || note.heidiNote.impression,
                plan: optimiseResult.data.plan || note.heidiNote.plan
              }
            };
            setConsultationNote(noteWithOptimisation);
          } else {
            console.warn('SystmOne optimisation returned error, using original notes:', optimiseResult.data?.error || optimiseResult.error);
          }
        } catch (optimiseError) {
          console.warn('SystmOne optimisation failed, using original notes:', optimiseError);
        }
      }
      
      // Auto-save immediately (awaited with status feedback) - include realtime transcript
      // Pass true for isSystmOneOptimised if optimisation succeeded
      await autoSaveWithRetry(noteWithOptimisation, transcriptForSave, wordCountForSave, durationForSave, realtimeTranscriptForSave, !!noteWithOptimisation.systmOneNote);
      
    } catch (error) {
      console.error('Error generating notes:', error);
      showToast.error('Failed to generate notes. Please try again.', { section: 'gpscribe' });
      setConsultationState('recording');
    } finally {
      setIsGenerating(false);
      setIsFinishing(false);
    }
  }, [recording, consultationType, settings.noteFormat, settings.consultationDetailLevel, contextFiles, autoSaveWithRetry]);

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

      let noteWithOptimisation = note;
      
      // Auto-optimise for SystmOne - store as separate systmOneNote
      if (note.heidiNote) {
        console.log('🔧 Auto-optimising regenerated notes for SystmOne...');
        try {
          const optimiseResult = await supabase.functions.invoke('tighten-systmone-notes', {
            body: {
              history: note.heidiNote.history || '',
              examination: note.heidiNote.examination || '',
              assessment: note.heidiNote.impression || '',
              plan: note.heidiNote.plan || ''
            }
          });

          if (optimiseResult.data && !optimiseResult.error && !optimiseResult.data.error) {
            console.log('✅ SystmOne optimisation complete');
            // Store optimised version SEPARATELY in systmOneNote
            noteWithOptimisation = {
              ...note,
              systmOneNote: {
                consultationHeader: note.heidiNote.consultationHeader,
                history: optimiseResult.data.history || note.heidiNote.history,
                examination: optimiseResult.data.examination || note.heidiNote.examination,
                impression: optimiseResult.data.assessment || note.heidiNote.impression,
                plan: optimiseResult.data.plan || note.heidiNote.plan
              }
            };
          } else {
            console.warn('SystmOne optimisation returned error:', optimiseResult.data?.error || optimiseResult.error);
          }
        } catch (optimiseError) {
          console.warn('SystmOne optimisation failed:', optimiseError);
        }
      }

      setConsultationNote(noteWithOptimisation);
      
      // Set edit content for SOAP
      setEditContent({
        S: noteWithOptimisation.soapNote.S,
        O: noteWithOptimisation.soapNote.O,
        A: noteWithOptimisation.soapNote.A,
        P: noteWithOptimisation.soapNote.P
      });

      // Set edit content for Heidi if available (use original)
      if (noteWithOptimisation.heidiNote) {
        setHeidiEditContent({
          consultationHeader: noteWithOptimisation.heidiNote.consultationHeader,
          history: noteWithOptimisation.heidiNote.history,
          examination: noteWithOptimisation.heidiNote.examination,
          impression: noteWithOptimisation.heidiNote.impression,
          plan: noteWithOptimisation.heidiNote.plan
        });
      }
      
      showToast.success('Notes regenerated' + (noteWithOptimisation.systmOneNote ? ' and optimised for SystmOne' : ''), { section: 'gpscribe' });
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
    
    // Preserve systmOneNote in the state update
    setConsultationNote({
      ...notes,
      systmOneNote: notes.systmOneNote
    });
    
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

  // Save consultation manually (for imported consultations that weren't auto-saved)
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
      
      // Use recording transcript or imported transcript
      const transcriptToSave = recording.transcript || importedTranscript || '';
      const wordCountToSave = recording.wordCount || 
        (importedTranscript ? importedTranscript.split(/\s+/).filter(w => w.length > 0).length : 0);
      const durationToSave = recording.duration || 0;

      await saveConsultationInternal(consultationNote, transcriptToSave, wordCountToSave, durationToSave);
      
      setIsSaved(true);
      showToast.success('Consultation saved', { section: 'gpscribe' });
    } catch (error) {
      console.error('Save error:', error);
      showToast.error('Failed to save consultation', { section: 'gpscribe' });
    } finally {
      setIsSaving(false);
    }
  }, [consultationNote, recording, importedTranscript, isSaving, isSaved, saveConsultationInternal]);

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

  // Update narrative section in database (for SystmOne optimisation persistence)
  const updateNarrativeSection = useCallback(async (
    consultationId: string,
    sectionKey: string,
    newContent: string,
    markAsSystmOneOptimised?: boolean
  ) => {
    try {
      // Update local state first
      setConsultationNote(prev => {
        if (!prev?.heidiNote) return prev;
        
        // Map narrative sections to heidi note keys
        const keyMap: Record<string, keyof HeidiNote> = {
          'history': 'history',
          'examination': 'examination',
          'assessment': 'impression', // assessment maps to impression
          'plan': 'plan'
        };
        
        const heidiKey = keyMap[sectionKey];
        if (!heidiKey) return prev;
        
        return {
          ...prev,
          heidiNote: {
            ...prev.heidiNote,
            [heidiKey]: newContent
          }
        };
      });

      // Check if notes record exists
      const { data: existingNote, error: fetchError } = await supabase
        .from('gp_consultation_notes')
        .select('id, heidi_notes')
        .eq('consultation_id', consultationId)
        .maybeSingle();
      
      if (fetchError) {
        console.error('Error checking for existing notes:', fetchError);
        return;
      }

      if (!existingNote) {
        console.warn('No notes record found for consultation:', consultationId);
        return;
      }

      // Map narrative sections to heidi note keys
      const keyMap: Record<string, string> = {
        'history': 'history',
        'examination': 'examination',
        'assessment': 'impression',
        'plan': 'plan'
      };
      
      const heidiKey = keyMap[sectionKey];
      if (!heidiKey) return;

      // Update heidi_notes with the new section content
      const currentHeidiNotes = (typeof existingNote.heidi_notes === 'object' && existingNote.heidi_notes !== null) 
        ? existingNote.heidi_notes as Record<string, unknown>
        : {};
      const updatedHeidiNotes = {
        ...currentHeidiNotes,
        [heidiKey]: newContent
      };

      // Build update payload
      const updatePayload: Record<string, unknown> = {
        heidi_notes: updatedHeidiNotes,
        updated_at: new Date().toISOString()
      };

      // Optionally mark as SystmOne optimised
      if (markAsSystmOneOptimised !== undefined) {
        updatePayload.is_systmone_optimised = markAsSystmOneOptimised;
      }

      const { error: updateError } = await supabase
        .from('gp_consultation_notes')
        .update(updatePayload)
        .eq('consultation_id', consultationId);

      if (updateError) {
        console.error('Error updating narrative section:', updateError);
      } else {
        console.log(`✅ Narrative section '${sectionKey}' updated in database`);
      }
    } catch (error) {
      console.error('Failed to update narrative section:', error);
    }
  }, []);

  // Mark consultation as SystmOne optimised (called after all sections are updated)
  const markAsSystmOneOptimised = useCallback(async (consultationId: string) => {
    try {
      const { error } = await supabase
        .from('gp_consultation_notes')
        .update({ 
          is_systmone_optimised: true,
          updated_at: new Date().toISOString()
        })
        .eq('consultation_id', consultationId);

      if (error) {
        console.error('Error marking as SystmOne optimised:', error);
      } else {
        console.log('✅ Consultation marked as SystmOne optimised');
      }
    } catch (error) {
      console.error('Failed to mark as SystmOne optimised:', error);
    }
  }, []);

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
    isFinishing: isFinishing,
    
    // Audio source states
    audioSourceMode: recording.audioSourceMode,
    isSwitchingAudioSource: recording.isSwitchingAudioSource,
    micCaptured: recording.micCaptured,
    systemAudioCaptured: recording.systemAudioCaptured,
    switchAudioSourceLive: recording.switchAudioSourceLive,
    
    // Chunk tracking
    chunks: recording.chunks,
    chunkStats: recording.chunkStats,
    clearChunks: recording.clearChunks,
    
    // Live preview (AssemblyAI real-time for mic verification)
    livePreviewTranscript: recording.livePreviewTranscript,
    livePreviewFullTranscript: recording.livePreviewFullTranscript,
    livePreviewStatus: recording.livePreviewStatus,
    livePreviewActive: recording.livePreviewActive,
    livePreviewError: recording.livePreviewError,
    
    // Actions
    setConsultationType,
    setConsultationCategory,
    f2fAccompanied,
    setF2fAccompanied,
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
    // Narrative section updates (for SystmOne optimisation)
    updateNarrativeSection,
    markAsSystmOneOptimised,
  };
};
