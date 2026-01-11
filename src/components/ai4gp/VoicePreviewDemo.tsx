import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Volume2, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VoiceDemo {
  id: string;
  name: string;
  voiceId: string;
  description: string;
  gender: 'female' | 'male';
}

const VOICE_DEMOS: VoiceDemo[] = [
  { id: 'alice', name: 'Alice', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', description: 'British Female - Friendly', gender: 'female' },
  { id: 'lily', name: 'Lily', voiceId: 'pFZP5JQG7iQjIQuC4Bku', description: 'British Female - Clear', gender: 'female' },
  { id: 'matilda', name: 'Matilda', voiceId: 'XrExE9yKIg1WjnnlVkGX', description: 'British Female - Expressive', gender: 'female' },
  { id: 'sarah', name: 'Sarah', voiceId: 'EXAVITQu4vr4xnSDxMaL', description: 'American Female - Soft', gender: 'female' },
  { id: 'jessica', name: 'Jessica', voiceId: 'cgSgspJ2msm6clMCkdW9', description: 'American Female - Expressive', gender: 'female' },
  { id: 'laura', name: 'Laura', voiceId: 'FGY2WhTYpPnrIDTdsKH5', description: 'American Female - Upbeat', gender: 'female' },
  { id: 'george', name: 'George', voiceId: 'JBFqnCBsd6RMkjVDRZzb', description: 'British Male - Professional', gender: 'male' },
  { id: 'brian', name: 'Brian', voiceId: 'nPczCjzI2devNBz1zQrb', description: 'American Male - Deep', gender: 'male' },
  { id: 'daniel', name: 'Daniel', voiceId: 'onwK4e9ZLuTAKqWW03F9', description: 'British Male - Confident', gender: 'male' },
  { id: 'will', name: 'Will', voiceId: 'bIHbv24MWmeRgasZH58o', description: 'American Male - Friendly', gender: 'male' },
  { id: 'chris', name: 'Chris', voiceId: 'iP95p4xoKVk53GoZ742B', description: 'American Male - Casual', gender: 'male' },
  { id: 'callum', name: 'Callum', voiceId: 'N2lVS1w4EtoT3dr4eOWO', description: 'Transatlantic Male - Hoarse', gender: 'male' },
];

const SAMPLE_TEXT = "Hello, I'm here to help you with NHS guidance and practice management. How can I assist you today?";

interface VoicePreviewDemoProps {
  onSelectVoice?: (voiceId: string, voiceName: string) => void;
}

export const VoicePreviewDemo: React.FC<VoicePreviewDemoProps> = ({ onSelectVoice }) => {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(() => {
    // Initialize from stored preference
    const storedVoiceId = localStorage.getItem('audioVoiceSelection');
    if (storedVoiceId) {
      const matchingVoice = VOICE_DEMOS.find(v => v.voiceId === storedVoiceId);
      return matchingVoice?.id || null;
    }
    return null;
  });

  const playVoiceDemo = async (voice: VoiceDemo) => {
    if (playingVoice) return;
    
    setPlayingVoice(voice.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-tts', {
        body: {
          text: SAMPLE_TEXT,
          voiceId: voice.voiceId
        }
      });
      
      if (error) throw error;
      
      if (data?.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        const audio = new Audio(audioUrl);
        audio.onended = () => setPlayingVoice(null);
        audio.onerror = () => {
          setPlayingVoice(null);
          toast.error('Failed to play audio');
        };
        await audio.play();
      }
    } catch (error) {
      console.error('Voice preview error:', error);
      toast.error('Failed to generate voice preview');
      setPlayingVoice(null);
    }
  };

  const handleSelect = (voice: VoiceDemo) => {
    setSelectedVoice(voice.id);
    onSelectVoice?.(voice.voiceId, voice.name);
    toast.success(`Selected ${voice.name} as your voice`);
  };

  const femaleVoices = VOICE_DEMOS.filter(v => v.gender === 'female');
  const maleVoices = VOICE_DEMOS.filter(v => v.gender === 'male');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Voice Preview
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Click the play button to hear each voice, then select your favourite.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-medium mb-3 text-sm text-muted-foreground">Female Voices</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {femaleVoices.map((voice) => (
              <div
                key={voice.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  selectedVoice === voice.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{voice.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{voice.description}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => playVoiceDemo(voice)}
                    disabled={playingVoice !== null}
                    className="h-8 w-8 p-0"
                  >
                    {playingVoice === voice.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant={selectedVoice === voice.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSelect(voice)}
                    className="h-8 w-8 p-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-3 text-sm text-muted-foreground">Male Voices</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {maleVoices.map((voice) => (
              <div
                key={voice.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  selectedVoice === voice.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{voice.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{voice.description}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => playVoiceDemo(voice)}
                    disabled={playingVoice !== null}
                    className="h-8 w-8 p-0"
                  >
                    {playingVoice === voice.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant={selectedVoice === voice.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSelect(voice)}
                    className="h-8 w-8 p-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
