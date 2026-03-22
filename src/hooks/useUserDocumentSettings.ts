import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserDocumentSettings {
  logo_on: boolean;
  footer_on: boolean;
  logo_position: string;
  logo_scale: number;
  exec_summary_on: boolean;
  action_items_on: boolean;
  open_items_on: boolean;
  attendees_on: boolean;
  meeting_details_on: boolean;
  priority_column_on: boolean;
  discussion_summary_on: boolean;
  decisions_register_on: boolean;
  next_meeting_on: boolean;
}

const DEFAULTS: UserDocumentSettings = {
  logo_on: true,
  footer_on: true,
  logo_position: 'centre',
  logo_scale: 1.0,
  exec_summary_on: true,
  action_items_on: true,
  open_items_on: true,
  attendees_on: true,
  meeting_details_on: true,
  priority_column_on: false,
  discussion_summary_on: true,
  decisions_register_on: true,
  next_meeting_on: true,
};

export function useUserDocumentSettings() {
  const [settings, setSettings] = useState<UserDocumentSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_document_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setSettings({
        logo_on: data.logo_on ?? true,
        footer_on: data.footer_on ?? true,
        logo_position: data.logo_position ?? 'centre',
        logo_scale: typeof (data as any).logo_scale === 'number' ? (data as any).logo_scale : 1.0,
        exec_summary_on: data.exec_summary_on ?? true,
        action_items_on: data.action_items_on ?? true,
        open_items_on: data.open_items_on ?? true,
        attendees_on: (data as any).attendees_on ?? true,
        meeting_details_on: (data as any).meeting_details_on ?? true,
        priority_column_on: (data as any).priority_column_on ?? false,
        discussion_summary_on: (data as any).discussion_summary_on ?? true,
        decisions_register_on: (data as any).decisions_register_on ?? true,
        next_meeting_on: (data as any).next_meeting_on ?? true,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = useCallback(async (s: UserDocumentSettings) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_document_settings').upsert({
      user_id: user.id,
      ...s,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'user_id' });
    setSettings(s);
  }, []);

  return { settings, loading, setSettings, saveSettings, fetchSettings };
}
