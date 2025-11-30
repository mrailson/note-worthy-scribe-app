import { useState, useEffect } from 'react';

export type VoiceOption = 'alice' | 'george' | 'charlotte' | 'lily' | 'matilda' | 'brian';

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
  charlotte: {
    id: 'elevenlabs-charlotte',
    name: 'Charlotte',
    provider: 'elevenlabs',
    voiceId: 'XB0fDUnXU5powFXDhCwa',
    description: 'British Female - Warm',
  },
  lily: {
    id: 'elevenlabs-lily',
    name: 'Lily',
    provider: 'elevenlabs',
    voiceId: 'pFZP5JQG7iQjIQuC4Bku',
    description: 'British Female - Clear',
  },
  matilda: {
    id: 'elevenlabs-matilda',
    name: 'Matilda',
    provider: 'elevenlabs',
    voiceId: 'XrExE9yKIg1WjnnlVkGX',
    description: 'British Female - Expressive',
  },
  brian: {
    id: 'elevenlabs-brian',
    name: 'Brian',
    provider: 'elevenlabs',
    voiceId: 'nPczCjzI2devNBz1zQrb',
    description: 'British Male - Authoritative',
  },
};

export function useVoicePreference() {
  const [voicePreference, setVoicePreferenceState] = useState<VoiceOption>(() => {
    const stored = localStorage.getItem('audioVoiceSelection');
    // Check if stored value matches any voice
    if (stored === 'elevenlabs-alice' || stored?.includes('Xb7hH8MSUJpSbSDYk0k2')) {
      return 'alice';
    }
    if (stored === 'elevenlabs-george' || stored?.includes('JBFqnCBsd6RMkjVDRZzb')) {
      return 'george';
    }
    if (stored === 'elevenlabs-charlotte' || stored?.includes('XB0fDUnXU5powFXDhCwa')) {
      return 'charlotte';
    }
    if (stored === 'elevenlabs-lily' || stored?.includes('pFZP5JQG7iQjIQuC4Bku')) {
      return 'lily';
    }
    if (stored === 'elevenlabs-matilda' || stored?.includes('XrExE9yKIg1WjnnlVkGX')) {
      return 'matilda';
    }
    if (stored === 'elevenlabs-brian' || stored?.includes('nPczCjzI2devNBz1zQrb')) {
      return 'brian';
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
