import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Mp3Bitrate, getFormatLabel } from '@/utils/audioTranscoder';

interface TranscriptionAudioFormatSetting {
  format: 'wav' | 'mp3';
  mp3_bitrate: Mp3Bitrate;
}

interface UseTranscriptionAudioFormatResult {
  format: 'wav' | 'mp3';
  mp3Bitrate: Mp3Bitrate;
  formatLabel: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_SETTING: TranscriptionAudioFormatSetting = {
  format: 'wav',
  mp3_bitrate: 64
};

export function useTranscriptionAudioFormat(): UseTranscriptionAudioFormatResult {
  const [setting, setSetting] = useState<TranscriptionAudioFormatSetting>(DEFAULT_SETTING);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSetting = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'transcription_audio_format')
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching transcription audio format setting:', fetchError);
        setError(fetchError.message);
        return;
      }

      if (data?.setting_value) {
        try {
          const parsed = typeof data.setting_value === 'string' 
            ? JSON.parse(data.setting_value) 
            : data.setting_value;
          
          setSetting({
            format: parsed.format || 'wav',
            mp3_bitrate: parsed.mp3_bitrate || 64
          });
        } catch (parseError) {
          console.error('Error parsing transcription audio format setting:', parseError);
          setSetting(DEFAULT_SETTING);
        }
      } else {
        // Setting doesn't exist, use default
        setSetting(DEFAULT_SETTING);
      }
    } catch (err) {
      console.error('Unexpected error fetching transcription audio format:', err);
      setError('Failed to load audio format setting');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSetting();
  }, []);

  return {
    format: setting.format,
    mp3Bitrate: setting.mp3_bitrate,
    formatLabel: getFormatLabel(setting.format, setting.mp3_bitrate),
    isLoading,
    error,
    refetch: fetchSetting
  };
}
