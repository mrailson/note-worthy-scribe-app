import { useState, useEffect } from 'react';

export type VoiceOption = 'alice' | 'george';

interface VoiceConfig {
  id: string;
  name: string;
  provider: 'elevenlabs';
  voiceId: string;
  description: string;
}

export const VOICE_OPTIONS: Record<VoiceOption, VoiceConfig> = {
  alice: {
    id: 'elevenlabs-alice',
    name: 'Alice',
    provider: 'elevenlabs',
    voiceId: 'Xb7hH8MSUJpSbSDYk0k2',
    description: 'British Female - Friendly',
  },
  george: {
    id: 'elevenlabs-george',
    name: 'George',
    provider: 'elevenlabs',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    description: 'British Male - Professional',
  },
};

export function useVoicePreference() {
  const [voicePreference, setVoicePreferenceState] = useState<VoiceOption>(() => {
    const stored = localStorage.getItem('audioVoiceSelection');
    // Check if stored value matches Alice or George
    if (stored === 'elevenlabs-alice' || stored?.includes('Xb7hH8MSUJpSbSDYk0k2')) {
      return 'alice';
    }
    if (stored === 'elevenlabs-george' || stored?.includes('JBFqnCBsd6RMkjVDRZzb')) {
      return 'george';
    }
    // Default to Alice
    return 'alice';
  });

  const setVoicePreference = (voice: VoiceOption) => {
    const voiceConfig = VOICE_OPTIONS[voice];
    localStorage.setItem('audioVoiceSelection', voiceConfig.id);
    setVoicePreferenceState(voice);
  };

  const getVoiceConfig = () => VOICE_OPTIONS[voicePreference];

  return {
    voicePreference,
    setVoicePreference,
    voiceConfig: getVoiceConfig(),
    VOICE_OPTIONS,
  };
}
