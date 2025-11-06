import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TEST_SCRIPT = `Hello there, I've just wrapped up a meeting that covered a few important things, so I wanted to give you a quick update. The main focus was really about managing our increasing patient list and preparing for winter pressures. Our patient numbers have gone up again, now over 12,600, which is really straining our capacity, especially for appointments and repeat prescriptions. We touched on whether we might need another ARRS role or if we can reallocate our current ones, something to keep in mind. Then we discussed winter planning. The ICB is predicting high demand, particularly with respiratory infections, and they're pushing us to expand same-day access. This is going to be a challenge because we're already stretched thin, sometimes operating over safe limits. We talked about possibly extending duty doctor hours or using the PCN acute visiting service more often. Claire proposed we pilot an extra doctor session on Mondays and Fridays for the next two months to help with those peak demands, which sounds sensible given how tight things are. Finally, we looked at patient feedback and complaints. Unfortunately, these have gone up, mainly due to long waiting times and issues with our new cloud-based telephone system. We've had three formal complaints, and Sarah mentioned one patient was on hold for 45 minutes, which is just not good enough. Carolyn has already started reviewing the phone system data, so hopefully, we'll get some answers on why this is happening. The plan is for her to present her findings at the next practice meeting, and we'll go from there. So, in a nutshell, capacity is tight, winter's coming, and patient satisfaction needs addressing. Claire is going to circulate a summary of the winter plan proposals to get everyone's thoughts. Let me know if you have any questions.`;

interface Voice {
  id: string;
  name: string;
  provider: 'deepgram' | 'elevenlabs';
  voiceId: string;
  description: string;
}

const VOICES: Voice[] = [
  { id: 'deepgram-arcas', name: 'Arcas', provider: 'deepgram', voiceId: 'arcas', description: 'British Male - Authoritative' },
  { id: 'deepgram-orion', name: 'Orion', provider: 'deepgram', voiceId: 'orion', description: 'British Male - Conversational' },
  { id: 'deepgram-luna', name: 'Luna', provider: 'deepgram', voiceId: 'luna', description: 'British Female - Warm' },
  { id: 'deepgram-stella', name: 'Stella', provider: 'deepgram', voiceId: 'stella', description: 'British Female - Clear' },
  { id: 'elevenlabs-george', name: 'George', provider: 'elevenlabs', voiceId: 'JBFqnCBsd6RMkjVDRZzb', description: 'British Male - Professional' },
  { id: 'elevenlabs-charlotte', name: 'Charlotte', provider: 'elevenlabs', voiceId: 'XB0fDUnXU5powFXDhCwa', description: 'British Female - Elegant' },
  { id: 'elevenlabs-alice', name: 'Alice', provider: 'elevenlabs', voiceId: 'Xb7hH8MSUJpSbSDYk0k2', description: 'British Female - Friendly' },
  { id: 'elevenlabs-callum', name: 'Callum', provider: 'elevenlabs', voiceId: 'N2lVS1w4EtoT3dr4eOWO', description: 'British Male - Youthful' },
  { id: 'elevenlabs-charlie', name: 'Charlie', provider: 'elevenlabs', voiceId: 'IKne3meq5aSn9XLyUdCD', description: 'British Male - Casual' },
];

export default function VoiceTest() {
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Revoke all cached blob URLs
      Object.values(audioCache).forEach(url => URL.revokeObjectURL(url));
    };
  }, [audioCache]);

  const generateAndPlayAudio = async (voice: Voice) => {
    try {
      setLoadingVoice(voice.id);

      // Check if we have cached audio
      if (audioCache[voice.id]) {
        playAudio(voice.id, audioCache[voice.id]);
        return;
      }

      // Generate audio
      const ttsFunction = voice.provider === 'elevenlabs' ? 'elevenlabs-tts' : 'deepgram-tts';
      const ttsBody: any = { text: TEST_SCRIPT, voiceId: voice.voiceId };

      const { data, error } = await supabase.functions.invoke(ttsFunction, { body: ttsBody });

      if (error) {
        console.error('TTS error:', error);
        throw new Error(error.message || 'Failed to generate audio');
      }

      if (!data?.audioContent) {
        console.error('❌ No audio content in response:', data);
        throw new Error('No audio content returned');
      }

      console.log('✅ Audio received, base64 length:', data.audioContent.length);

      // Convert base64 to blob URL
      try {
        const binaryString = atob(data.audioContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);
        
        console.log('✅ Blob created:', blob.size, 'bytes, type:', blob.type);
        console.log('✅ Blob URL:', blobUrl);

        // Cache the blob URL
        setAudioCache(prev => ({ ...prev, [voice.id]: blobUrl }));

        // Play the audio
        playAudio(voice.id, blobUrl);
      } catch (conversionError: any) {
        console.error('❌ Error converting audio:', conversionError);
        throw new Error(`Audio conversion failed: ${conversionError.message}`);
      }

    } catch (error: any) {
      console.error('❌ Error generating audio:', error);
      toast.error(`Failed to generate ${voice.name}: ${error.message}`);
    } finally {
      setLoadingVoice(null);
    }
  };

  const playAudio = (voiceId: string, blobUrl: string) => {
    console.log('▶️ Attempting to play audio for voice:', voiceId, 'URL:', blobUrl);
    
    // Stop current audio if playing
    if (audioRef.current) {
      console.log('⏹️ Stopping current audio');
      audioRef.current.pause();
      audioRef.current.src = ''; // Clear source to stop any loading
      audioRef.current.load(); // Reset the audio element
      audioRef.current = null;
    }

    // Create new audio element with a slight delay to avoid race conditions
    setTimeout(() => {
      audioRef.current = new Audio(blobUrl);
    
    audioRef.current.addEventListener('loadedmetadata', () => {
      console.log('✅ Audio metadata loaded, duration:', audioRef.current?.duration);
    });
    
    audioRef.current.addEventListener('canplay', () => {
      console.log('✅ Audio can play');
    });
    
    audioRef.current.addEventListener('ended', () => {
      console.log('✅ Audio playback ended');
      setPlayingVoice(null);
    });
    
    audioRef.current.addEventListener('error', (e) => {
      console.error('❌ Audio playback error:', e);
      console.error('❌ Audio error details:', audioRef.current?.error);
      toast.error(`Failed to play ${voiceId}: ${audioRef.current?.error?.message || 'Unknown error'}`);
      setPlayingVoice(null);
    });

      console.log('▶️ Starting playback...');
      audioRef.current.play()
        .then(() => {
          console.log('✅ Playback started successfully');
          setPlayingVoice(voiceId);
        })
        .catch((err) => {
          console.error('❌ Play promise rejected:', err);
          toast.error(`Playback failed: ${err.message}`);
          setPlayingVoice(null);
        });
    }, 50); // Small delay to ensure cleanup completes
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingVoice(null);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Voice Testing Suite</h1>
        <p className="text-muted-foreground">
          Test all available TTS voices with a sample medical meeting summary
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Script</CardTitle>
          <CardDescription>The following script will be read by each voice</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{TEST_SCRIPT}</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Deepgram Voices</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {VOICES.filter(v => v.provider === 'deepgram').map(voice => (
            <Card key={voice.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{voice.name}</CardTitle>
                <CardDescription>{voice.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    if (playingVoice === voice.id) {
                      stopAudio();
                    } else {
                      generateAndPlayAudio(voice);
                    }
                  }}
                  disabled={loadingVoice !== null && loadingVoice !== voice.id}
                  className="w-full"
                >
                  {loadingVoice === voice.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : playingVoice === voice.id ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Play
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="text-xl font-semibold mt-8">ElevenLabs Voices</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {VOICES.filter(v => v.provider === 'elevenlabs').map(voice => (
            <Card key={voice.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{voice.name}</CardTitle>
                <CardDescription>{voice.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    if (playingVoice === voice.id) {
                      stopAudio();
                    } else {
                      generateAndPlayAudio(voice);
                    }
                  }}
                  disabled={loadingVoice !== null && loadingVoice !== voice.id}
                  className="w-full"
                >
                  {loadingVoice === voice.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : playingVoice === voice.id ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Play
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
