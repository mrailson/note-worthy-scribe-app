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
  is_practice_logo?: boolean; // true for the auto-fetched practice logo
}

export function useUserLogos() {
  const [logos, setLogos] = useState<UserLogo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogos = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch user-managed logos
    const { data } = await supabase
      .from('user_logos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    
    const userLogos = (data as UserLogo[] | null) || [];

    // Fetch practice logo from practice_details
    const { data: pd } = await supabase
      .from('practice_details')
      .select('id, practice_name, practice_logo_url, logo_url')
      .eq('user_id', user.id)
      .maybeSingle();

    const practiceLogoUrl = pd?.practice_logo_url || pd?.logo_url;
    
    const allLogos: UserLogo[] = [];

    // Add practice logo first if it exists
    if (pd && practiceLogoUrl) {
      const practiceLogoEntry: UserLogo = {
        id: `practice-${pd.id}`,
        user_id: user.id,
        name: pd.practice_name || 'My Practice',
        type: 'practice',
        image_url: practiceLogoUrl,
        is_active: userLogos.length === 0 || !userLogos.some(l => l.is_active),
        created_at: '',
        is_practice_logo: true,
      };
      // If any user logo is active, the practice logo should not be active
      if (userLogos.some(l => l.is_active)) {
        practiceLogoEntry.is_active = false;
      }
      allLogos.push(practiceLogoEntry);
    }

    allLogos.push(...userLogos);

    setLogos(allLogos);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogos(); }, [fetchLogos]);

  const setActiveLogo = useCallback(async (logoId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // If selecting the practice logo (virtual entry), deactivate all user logos
    if (logoId.startsWith('practice-')) {
      await supabase.from('user_logos').update({ is_active: false }).eq('user_id', user.id);
    } else {
      // Deactivate all, then activate selected
      await supabase.from('user_logos').update({ is_active: false }).eq('user_id', user.id);
      await supabase.from('user_logos').update({ is_active: true }).eq('id', logoId);
    }
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
    // Don't allow deleting the practice logo
    if (logoId.startsWith('practice-')) return;
    await supabase.from('user_logos').delete().eq('id', logoId);
    await fetchLogos();
  }, [fetchLogos]);

  const activeLogo = logos.find(l => l.is_active) || null;

  return { logos, loading, activeLogo, setActiveLogo, addLogo, deleteLogo, fetchLogos };
}
