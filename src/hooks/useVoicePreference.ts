import { useState, useEffect } from 'react';

export type VoiceOption = 'chris' | 'alice';

interface VoiceConfig {
  id: string;
  name: string;
  provider: 'elevenlabs';
  voiceId: string;
  description: string;
}

export const VOICE_OPTIONS: Record<VoiceOption, VoiceConfig> = {
  chris: {
    id: 'elevenlabs-chris',
    name: 'Chris',
    provider: 'elevenlabs',
    voiceId: 'G17SuINrv2H9FC6nvetn',
    description: 'British Male - Natural',
  },
  alice: {
    id: 'elevenlabs-alice',
    name: 'Alice',
    provider: 'elevenlabs',
    voiceId: 'Xb7hH8MSUJpSbSDYk0k2',
    description: 'British Female - Friendly',
  },
};

export function useVoicePreference() {
  const [voicePreference, setVoicePreferenceState] = useState<VoiceOption>(() => {
    const stored = localStorage.getItem('audioVoiceSelection');
    // Check if stored value matches Chris or Alice
    if (stored === 'elevenlabs-chris' || stored?.includes('G17SuINrv2H9FC6nvetn')) {
      return 'chris';
    }
    if (stored === 'elevenlabs-alice' || stored?.includes('Xb7hH8MSUJpSbSDYk0k2')) {
      return 'alice';
    }
    // Default to Chris
    return 'chris';
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
