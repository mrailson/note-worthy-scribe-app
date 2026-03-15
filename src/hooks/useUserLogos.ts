import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LogoType = 'practice' | 'pcn' | 'neighbourhood' | 'organisation';

export interface UserLogo {
  id: string;
  user_id: string;
  name: string;
  type: LogoType;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export function useUserLogos() {
  const [logos, setLogos] = useState<UserLogo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogos = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('user_logos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setLogos((data as UserLogo[] | null) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogos(); }, [fetchLogos]);

  const setActiveLogo = useCallback(async (logoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Deactivate all
    await supabase.from('user_logos').update({ is_active: false }).eq('user_id', user.id);
    // Activate selected
    await supabase.from('user_logos').update({ is_active: true }).eq('id', logoId);
    await fetchLogos();
  }, [fetchLogos]);

  const addLogo = useCallback(async (params: { name: string; type: LogoType; file?: File }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let image_url: string | null = null;
    if (params.file) {
      const ext = params.file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('user-logos')
        .upload(path, params.file, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('user-logos').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
    }

    await supabase.from('user_logos').insert({
      user_id: user.id,
      name: params.name,
      type: params.type,
      image_url,
      is_active: false,
    });
    await fetchLogos();
  }, [fetchLogos]);

  const deleteLogo = useCallback(async (logoId: string) => {
    await supabase.from('user_logos').delete().eq('id', logoId);
    await fetchLogos();
  }, [fetchLogos]);

  const activeLogo = logos.find(l => l.is_active) || null;

  return { logos, loading, activeLogo, setActiveLogo, addLogo, deleteLogo, fetchLogos };
}
