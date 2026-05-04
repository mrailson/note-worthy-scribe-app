import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type TranscriptionEngine = 'whisper-1' | 'gpt-4o-transcribe';

export interface MeetingPreferences {
  audio_mode: 'mic_only' | 'mic_system';
  preferred_mic_device_id: string | null;
  preferred_mic_label: string | null;
  notes_length: 'concise' | 'standard' | 'detailed';
  transcription_engine: TranscriptionEngine;
  section_exec_summary: boolean;
  section_key_points: boolean;
  section_decisions: boolean;
  section_actions: boolean;
  section_open_items: boolean;
  section_attendees: boolean;
  section_next_meeting: boolean;
  section_full_transcript: boolean;
}

const DEFAULTS: MeetingPreferences = {
  audio_mode: 'mic_only',
  preferred_mic_device_id: null,
  preferred_mic_label: null,
  notes_length: 'standard',
  transcription_engine: 'whisper-1',
  section_exec_summary: true,
  section_key_points: true,
  section_decisions: true,
  section_actions: true,
  section_open_items: true,
  section_attendees: true,
  section_next_meeting: true,
  section_full_transcript: false,
};

export type SectionKey = 
  | 'section_exec_summary'
  | 'section_key_points'
  | 'section_decisions'
  | 'section_actions'
  | 'section_open_items'
  | 'section_attendees'
  | 'section_next_meeting'
  | 'section_full_transcript';

export function useMeetingPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<MeetingPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Load from Supabase on mount
  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }

    const load = async () => {
      try {
        const { data } = await supabase
          .from('user_document_settings')
          .select('audio_mode, preferred_mic_device_id, preferred_mic_label, notes_length, section_exec_summary, section_key_points, section_decisions, section_actions, section_open_items, section_attendees, section_next_meeting, section_full_transcript')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          setPrefs({
            audio_mode: (data as any).audio_mode || 'mic_only',
            preferred_mic_device_id: (data as any).preferred_mic_device_id || null,
            preferred_mic_label: (data as any).preferred_mic_label || null,
            notes_length: (data as any).notes_length || 'standard',
            section_exec_summary: (data as any).section_exec_summary ?? true,
            section_key_points: (data as any).section_key_points ?? true,
            section_decisions: (data as any).section_decisions ?? true,
            section_actions: (data as any).section_actions ?? true,
            section_open_items: (data as any).section_open_items ?? true,
            section_attendees: (data as any).section_attendees ?? true,
            section_next_meeting: (data as any).section_next_meeting ?? true,
            section_full_transcript: (data as any).section_full_transcript ?? false,
          });
        }
      } catch (err) {
        console.warn('Failed to load meeting preferences:', err);
      }
      setLoading(false);
    };

    load();
  }, [user?.id]);

  // Debounced save to Supabase
  const persist = useCallback(async (updated: MeetingPreferences) => {
    if (!user?.id) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await supabase.from('user_document_settings').upsert({
          user_id: user.id,
          audio_mode: updated.audio_mode,
          preferred_mic_device_id: updated.preferred_mic_device_id,
          preferred_mic_label: updated.preferred_mic_label,
          notes_length: updated.notes_length,
          section_exec_summary: updated.section_exec_summary,
          section_key_points: updated.section_key_points,
          section_decisions: updated.section_decisions,
          section_actions: updated.section_actions,
          section_open_items: updated.section_open_items,
          section_attendees: updated.section_attendees,
          section_next_meeting: updated.section_next_meeting,
          section_full_transcript: updated.section_full_transcript,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: 'user_id' });
      } catch (err) {
        console.warn('Failed to save meeting preferences:', err);
      }
    }, 800);
  }, [user?.id]);

  const update = useCallback((patch: Partial<MeetingPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, [persist]);

  const setAudioMode = useCallback((mode: 'mic_only' | 'mic_system') => {
    update({ audio_mode: mode });
  }, [update]);

  const setMicDevice = useCallback((deviceId: string, label: string) => {
    update({ preferred_mic_device_id: deviceId, preferred_mic_label: label });
  }, [update]);

  const setNotesLength = useCallback((length: 'concise' | 'standard' | 'detailed') => {
    update({ notes_length: length });
  }, [update]);

  const toggleSection = useCallback((key: SectionKey) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      persist(next);
      return next;
    });
  }, [persist]);

  const getSectionsConfig = useCallback(() => ({
    exec_summary: prefsRef.current.section_exec_summary,
    key_points: prefsRef.current.section_key_points,
    decisions: prefsRef.current.section_decisions,
    actions: prefsRef.current.section_actions,
    open_items: prefsRef.current.section_open_items,
    attendees: prefsRef.current.section_attendees,
    next_meeting: prefsRef.current.section_next_meeting,
    full_transcript: prefsRef.current.section_full_transcript,
  }), []);

  const getNotesConfig = useCallback(() => ({
    length: prefsRef.current.notes_length,
    sections: getSectionsConfig(),
  }), [getSectionsConfig]);

  useEffect(() => () => clearTimeout(saveTimeoutRef.current), []);

  return {
    prefs,
    loading,
    setAudioMode,
    setMicDevice,
    setNotesLength,
    toggleSection,
    update,
    getSectionsConfig,
    getNotesConfig,
  };
}
