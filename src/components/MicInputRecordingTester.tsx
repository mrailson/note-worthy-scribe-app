import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, MicOff, Play, Square, CheckCircle, AlertCircle, Clock, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface MicProfile {
  id: string;
  name: string;
  description: string;
  purpose: string;
  config: {
    source: string;
    noiseCancellation: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
    sampleRate: number;
    channelCount: number;
    gain?: string;
  };
  color: 'safe' | 'caution' | 'danger';
}

interface TestResult {
  profileId: string;
  transcription: string;
  duration: number;
  wordCount: number;
  confidence?: number;
  error?: string;
  status: 'idle' | 'recording' | 'processing' | 'completed' | 'error';
  audioBlob?: Blob;
  audioUrl?: string;
}

const MIC_PROFILES: MicProfile[] = [
  // ChatGPT Recommended Profile - Exact match to Meeting Recorder
  {
    id: 'chatgpt-recommended',
    name: 'ChatGPT Recommended (Meeting Recorder Match)',
    description: '48kHz, mono, no processing - exact Meeting Recorder settings with ChatGPT recommendations',
    purpose: 'Exact replica of Meeting Recorder with ChatGPT hallucination fixes: 48kHz, no processing, smart de-duplication, quality guardrails.',
    config: {
      source: 'default',
      noiseCancellation: false,  // Disabled - can create artifacts 
      echoCancellation: false,   // Disabled - can create artifacts
      autoGainControl: false,    // Disabled - can create artifacts
      sampleRate: 48000,         // 48kHz - Chrome native, avoid resampling artifacts
      channelCount: 1
    },
    color: 'safe'
  },
  {
    id: 'profile1',
    name: 'Default System Mic (No Processing)',
    description: 'System default input (e.g. built-in mic or external headset)',
    purpose: 'Clean baseline using the raw system mic. No signal processing.',
    config: {
      source: 'default',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 1
    },
    color: 'safe'
  },
  {
    id: 'profile2',
    name: 'Enhanced Voice Capture',
    description: 'Default mic with noise reduction and echo cancellation',
    purpose: 'Uses system processing to clean up speaker echo — best for speaker recordings.',
    config: {
      source: 'default',
      noiseCancellation: true,
      echoCancellation: true,
      autoGainControl: true,
      sampleRate: 44100,
      channelCount: 1,
      gain: 'medium'
    },
    color: 'safe'
  },
  {
    id: 'profile3',
    name: 'Stereo Mix / Loopback (If Supported)',
    description: 'What-you-hear capture (exact system audio)',
    purpose: 'Captures exact system audio (not mic pickup) — best for perfect YouTube recordings but requires driver support.',
    config: {
      source: 'stereo-mix',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 2
    },
    color: 'safe'
  },
  {
    id: 'profile4',
    name: 'High Gain External Mic Test',
    description: 'External USB mic with high gain boost',
    purpose: 'Stress-test high-gain mic. Useful for detecting subtle speech or distant audio, but may introduce hiss or distortion.',
    config: {
      source: 'external',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 1,
      gain: 'high'
    },
    color: 'caution'
  },
  {
    id: 'profile5',
    name: 'Browser-Based Echo Isolation',
    description: 'Browser-selected mic with built-in processing',
    purpose: 'Uses built-in browser features to isolate voice or media and cancel background interference.',
    config: {
      source: 'browser-selected',
      noiseCancellation: true,
      echoCancellation: true,
      autoGainControl: true,
      sampleRate: 44100,
      channelCount: 1,
      gain: 'auto'
    },
    color: 'safe'
  },
  {
    id: 'profile6',
    name: 'Teams Call Capture (High Sensitivity)',
    description: 'High sensitivity mic optimized for conference call pickup',
    purpose: 'Maximizes microphone sensitivity to capture distant Teams audio through speakers with advanced processing.',
    config: {
      source: 'default',
      noiseCancellation: false,
      echoCancellation: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
      gain: 'high'
    },
    color: 'caution'
  },
  {
    id: 'profile7',
    name: 'Windows Audio Capture (WASAPI)',
    description: 'System audio loopback for direct Teams audio',
    purpose: 'Attempts to capture system audio directly (Teams output) rather than microphone pickup. May require permissions.',
    config: {
      source: 'system-audio',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 2
    },
    color: 'safe'
  },
  {
    id: 'profile8',
    name: 'Multi-Device Scanner',
    description: 'Cycles through all available audio inputs',
    purpose: 'Tests the first available external device (USB headset, webcam mic) which might capture Teams better.',
    config: {
      source: 'multi-device',
      noiseCancellation: true,
      echoCancellation: true,
      autoGainControl: true,
      sampleRate: 44100,
      channelCount: 1,
      gain: 'medium'
    },
    color: 'caution'
  },
  {
    id: 'profile9',
    name: 'Conference Room Mode',
    description: 'Optimized for meeting room acoustics',
    purpose: 'Designed for capturing multiple speakers in a room environment with echo handling.',
    config: {
      source: 'default',
      noiseCancellation: true,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 48000,
      channelCount: 2,
      gain: 'high'
    },
    color: 'caution'
  },
  {
    id: 'profile10',
    name: 'Screen Share Audio (Experimental)',
    description: 'Attempts to capture shared audio streams',
    purpose: 'Experimental: tries to access screen-share audio or presentation audio from Teams calls.',
    config: {
      source: 'screen-audio',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 2
    },
    color: 'danger'
  },
  {
    id: 'profile11',
    name: 'Right Channel Only (System Audio Test)',
    description: 'Tests right channel capture (system audio) only',
    purpose: 'TESTING: Right channel only to verify system audio capture is working vs microphone pickup.',
    config: {
      source: 'system-right-only',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 1
    },
    color: 'danger'
  },
  {
    id: 'system1',
    name: 'Screen Share Audio Capture',
    description: 'Uses getDisplayMedia with audio to capture screen audio',
    purpose: 'SYSTEM AUDIO: Attempts to capture desktop audio via screen sharing API - should get pure system output.',
    config: {
      source: 'screen-audio-capture',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 48000,
      channelCount: 2
    },
    color: 'danger'
  },
  {
    id: 'system2',
    name: 'Desktop Audio Loopback',
    description: 'Attempts to access desktop audio loopback device',
    purpose: 'SYSTEM AUDIO: Tries to find and use system loopback device for direct audio capture.',
    config: {
      source: 'desktop-loopback',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 2
    },
    color: 'danger'
  },
  {
    id: 'system3',
    name: 'Chrome Tab Audio Capture',
    description: 'Uses Chrome-specific APIs to capture tab audio',
    purpose: 'SYSTEM AUDIO: Chrome extension-style tab audio capture for browser audio sources.',
    config: {
      source: 'chrome-tab-audio',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 2
    },
    color: 'danger'
  },
  {
    id: 'system4',
    name: 'WASAPI Desktop Audio',
    description: 'Windows WASAPI desktop audio capture',
    purpose: 'SYSTEM AUDIO: Attempts Windows-specific WASAPI desktop audio capture for pure system output.',
    config: {
      source: 'wasapi-desktop',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 48000,
      channelCount: 2
    },
    color: 'danger'
  },
  {
    id: 'system5',
    name: 'Virtual Audio Cable Detection',
    description: 'Scans for virtual audio cable or mixer devices',
    purpose: 'SYSTEM AUDIO: Looks for VB-Cable, Voicemeeter, or other virtual audio devices that route system audio.',
    config: {
      source: 'virtual-audio-cable',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 2
    },
    color: 'danger'
  },
  {
    id: 'system6',
    name: 'Screen Share + Audio Capture',
    description: 'Full screen share with audio capture (video + audio)',
    purpose: 'SYSTEM AUDIO: Uses full screen sharing with audio to capture system output - often more reliable than audio-only.',
    config: {
      source: 'screen-share-full',
      noiseCancellation: false,
      echoCancellation: false,
      autoGainControl: false,
      sampleRate: 48000,
      channelCount: 2
    },
    color: 'danger'
  }
];

export const MicInputRecordingTester: React.FC = () => {
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [results, setResults] = useState<TestResult[]>([]);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  
  const mediaRecorders = useRef<Map<string, MediaRecorder>>(new Map());
  const audioChunks = useRef<Map<string, Blob[]>>(new Map());
  const recordingStartTime = useRef<number>(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  React.useEffect(() => {
    // Get available audio input devices
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAvailableDevices(audioInputs);
      })
      .catch(console.error);
  }, []);

  // Function to create a stream with only the right channel (system audio)
  const createRightChannelOnlyStream = async (inputStream: MediaStream): Promise<MediaStream> => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(inputStream);
    
    // Create a splitter to access individual channels
    const splitter = audioContext.createChannelSplitter(2);
    const merger = audioContext.createChannelMerger(1);
    
    // Connect source to splitter
    source.connect(splitter);
    
    // Connect only the right channel (index 1) to the merger
    splitter.connect(merger, 1, 0);
    
    // Create destination and get the output stream
    const destination = audioContext.createMediaStreamDestination();
    merger.connect(destination);
    
    return destination.stream;
  };

  // Function to find virtual audio devices
  const getVirtualAudioDevice = async (profile: MicProfile): Promise<MediaStream> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      
      // Look for virtual audio devices by name patterns
      const virtualDevicePatterns = [
        /virtual.*audio/i,
        /vb.*cable/i,
        /voicemeeter/i,
        /line.*\d/i,
        /stereo.*mix/i,
        /what.*you.*hear/i,
        /loopback/i,
        /desktop.*audio/i
      ];
      
      const virtualDevice = audioInputs.find(device => 
        virtualDevicePatterns.some(pattern => pattern.test(device.label))
      );
      
      if (virtualDevice) {
        console.log(`🎵 Found virtual audio device: ${virtualDevice.label}`);
        return navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: virtualDevice.deviceId },
            sampleRate: profile.config.sampleRate,
            channelCount: profile.config.channelCount,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      } else {
        console.log('🎵 No virtual audio device found, using default');
        return navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: profile.config.sampleRate,
            channelCount: profile.config.channelCount,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
      }
    } catch (error) {
      console.error('Virtual audio device detection failed:', error);
      // Fallback to default
      return navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: profile.config.sampleRate,
          channelCount: profile.config.channelCount,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
    }
  };

  const toggleProfileSelection = (profileId: string) => {
    setSelectedProfiles(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const getAudioConstraints = (profile: MicProfile): MediaStreamConstraints => {
    const baseConstraints: MediaStreamConstraints = {
      audio: {
        sampleRate: profile.config.sampleRate,
        channelCount: profile.config.channelCount,
        echoCancellation: profile.config.echoCancellation,
        noiseSuppression: profile.config.noiseCancellation,
        autoGainControl: profile.config.autoGainControl
      }
    };

    // Handle special system audio capture methods
    if (profile.config.source === 'screen-audio-capture') {
      // This will be handled in the recording function with getDisplayMedia (audio only)
      return { audio: false }; // We'll use getDisplayMedia instead
    }

    if (profile.config.source === 'screen-share-full') {
      // This will be handled in the recording function with getDisplayMedia (video + audio)
      return { audio: false }; // We'll use getDisplayMedia instead
    }

    if (profile.config.source === 'desktop-loopback') {
      return {
        audio: {
          sampleRate: profile.config.sampleRate,
          channelCount: 2,
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          // Try to request desktop audio specifically
          deviceId: 'default'
        }
      };
    }

    if (profile.config.source === 'chrome-tab-audio') {
      return {
        audio: {
          sampleRate: profile.config.sampleRate,
          channelCount: 2,
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          // Chrome-specific constraints
          googEchoCancellation: false,
          googAutoGainControl: false,
          googNoiseSuppression: false
        } as any
      };
    }

    if (profile.config.source === 'wasapi-desktop') {
      return {
        audio: {
          sampleRate: profile.config.sampleRate,
          channelCount: 2,
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          // Windows-specific WASAPI hints
          latency: 0.01,
          deviceId: 'communications'
        } as any
      };
    }

    if (profile.config.source === 'virtual-audio-cable') {
      // This will be handled specially in recording function
      return {
        audio: {
          sampleRate: profile.config.sampleRate,
          channelCount: 2,
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false
        }
      };
    }

    if (profile.config.source === 'system-right-only') {
      return {
        audio: {
          sampleRate: profile.config.sampleRate,
          channelCount: 2, // Request stereo to get both channels
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false
        }
      };
    }

    // Try to request specific device types based on profile
    if (profile.config.source === 'external' && availableDevices.length > 1) {
      // Try to find an external USB mic
      const externalMic = availableDevices.find(device => 
        device.label.toLowerCase().includes('usb') || 
        device.label.toLowerCase().includes('external')
      );
      if (externalMic && baseConstraints.audio && typeof baseConstraints.audio === 'object') {
        (baseConstraints.audio as any).deviceId = { exact: externalMic.deviceId };
      }
    }

    return baseConstraints;
  };

  const startRecording = async () => {
    if (selectedProfiles.length === 0) {
      return;
    }

    setIsRecording(true);
    setRecordingProgress(0);
    recordingStartTime.current = Date.now();
    
    // Initialize results
    const initialResults: TestResult[] = selectedProfiles.map(profileId => ({
      profileId,
      transcription: '',
      duration: 0,
      wordCount: 0,
      status: 'recording'
    }));
    setResults(initialResults);

    // Clear previous recordings
    mediaRecorders.current.clear();
    audioChunks.current.clear();

    // Start recording for each selected profile
    for (const profileId of selectedProfiles) {
      const profile = MIC_PROFILES.find(p => p.id === profileId);
      if (!profile) continue;

      try {
        let stream: MediaStream;
        
        // Handle special system audio capture methods
        if (profile.config.source === 'screen-audio-capture') {
          // Use screen sharing API to capture desktop audio only
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: false,
            audio: {
              sampleRate: profile.config.sampleRate,
              channelCount: profile.config.channelCount,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          });
        } else if (profile.config.source === 'screen-share-full') {
          // Use full screen sharing (video + audio) to capture desktop audio
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // Enable video for full screen sharing
            audio: {
              sampleRate: profile.config.sampleRate,
              channelCount: profile.config.channelCount,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            }
          });
          
          // Extract only the audio track for recording
          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length > 0) {
            stream = new MediaStream(audioTracks);
          }
        } else if (profile.config.source === 'virtual-audio-cable') {
          // Try to find virtual audio devices
          stream = await getVirtualAudioDevice(profile);
        } else {
          // Standard getUserMedia approach
          const constraints = getAudioConstraints(profile);
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
        
        let processedStream = stream;
        
        // For right channel only test, process the audio to extract right channel
        if (profile.config.source === 'system-right-only') {
          processedStream = await createRightChannelOnlyStream(stream);
        }
        
        const chunks: Blob[] = [];
        audioChunks.current.set(profileId, chunks);

        const recorder = new MediaRecorder(processedStream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorders.current.set(profileId, recorder);
        recorder.start();
        
      } catch (error) {
        console.error(`Failed to start recording for ${profile.name}:`, error);
        setResults(prev => prev.map(result => 
          result.profileId === profileId 
            ? { ...result, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
            : result
        ));
      }
    }

    // Progress tracking (30 seconds)
    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - recordingStartTime.current;
      const progress = Math.min((elapsed / 30000) * 100, 100);
      setRecordingProgress(progress);

      if (progress >= 100) {
        stopRecording();
      }
    }, 100);
  };

  const stopRecording = () => {
    setIsRecording(false);
    
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    // Stop all recorders
    mediaRecorders.current.forEach((recorder, profileId) => {
      if (recorder.state === 'recording') {
        recorder.stop();
        
        recorder.onstop = () => {
          processRecording(profileId);
        };
      }
    });
  };

  const processRecording = async (profileId: string) => {
    const chunks = audioChunks.current.get(profileId);
    if (!chunks || chunks.length === 0) return;

    setResults(prev => prev.map(result => 
      result.profileId === profileId 
        ? { ...result, status: 'processing' }
        : result
    ));

    try {
      const audioBlob = new Blob(chunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'test-audio.webm');

      const { data, error } = await supabase.functions.invoke('test-mp3-transcription', {
        body: formData
      });

      if (error) throw error;

      const duration = (Date.now() - recordingStartTime.current) / 1000;
      const wordCount = data.text ? data.text.split(/\s+/).filter((word: string) => word.length > 0).length : 0;

      setResults(prev => prev.map(result => 
        result.profileId === profileId 
          ? { 
              ...result, 
              status: 'completed',
              transcription: data.text || '',
              duration,
              wordCount,
              confidence: data.confidence,
              audioBlob,
              audioUrl
            }
          : result
      ));

    } catch (error) {
      console.error(`Processing failed for ${profileId}:`, error);
      setResults(prev => prev.map(result => 
        result.profileId === profileId 
          ? { 
              ...result, 
              status: 'error',
              error: error instanceof Error ? error.message : 'Processing failed'
            }
          : result
      ));
    }
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case 'safe': return 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950';
      case 'caution': return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950';
      case 'danger': return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
      default: return 'border-border bg-background';
    }
  };

  const getBadgeVariant = (color: string) => {
    switch (color) {
      case 'safe': return 'default';
      case 'caution': return 'secondary';
      case 'danger': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'recording': return <Mic className="h-4 w-4 text-red-500 animate-pulse" />;
      case 'processing': return <Clock className="h-4 w-4 text-amber-500 animate-spin" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <MicOff className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Mic Input Recording Tester
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Test different microphone configurations by recording external audio (e.g., YouTube videos playing through speakers) 
            and comparing transcription quality across 5 input profiles.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Instructions:</strong> Play audio from YouTube or another source through your speakers, 
              select the mic profiles you want to test, then click "Start 30s Recording Test". 
              Each profile will record the same audio simultaneously for comparison.
            </AlertDescription>
          </Alert>

          {/* Profile Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Select Profiles to Test</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {MIC_PROFILES.map((profile) => (
                <Card 
                  key={profile.id}
                  className={`cursor-pointer transition-all ${getColorClass(profile.color)} ${
                    selectedProfiles.includes(profile.id) 
                      ? 'ring-2 ring-primary shadow-md' 
                      : 'hover:shadow-sm'
                  }`}
                  onClick={() => toggleProfileSelection(profile.id)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <Badge variant={getBadgeVariant(profile.color)} className="text-xs">
                        🎧 {profile.id === 'chatgpt-recommended' ? 'GPT' : 'Profile ' + profile.id.slice(-1)}
                      </Badge>
                      <input
                        type="checkbox"
                        checked={selectedProfiles.includes(profile.id)}
                        onChange={() => {}}
                        className="rounded"
                      />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-1">{profile.name}</h4>
                      <p className="text-xs text-muted-foreground mb-2">{profile.description}</p>
                      <p className="text-xs bg-background/50 p-2 rounded">{profile.purpose}</p>
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <div>Noise Cancel: {profile.config.noiseCancellation ? 'On' : 'Off'}</div>
                      <div>Echo Cancel: {profile.config.echoCancellation ? 'On' : 'Off'}</div>
                      {profile.config.gain && <div>Gain: {profile.config.gain}</div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recording Controls */}
          <div className="flex items-center gap-4">
            <Button
              onClick={startRecording}
              disabled={isRecording || selectedProfiles.length === 0}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Start 30s Recording Test
            </Button>
            
            {isRecording && (
              <Button
                onClick={stopRecording}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                Stop Early
              </Button>
            )}

            <div className="text-sm text-muted-foreground">
              {selectedProfiles.length} profile{selectedProfiles.length !== 1 ? 's' : ''} selected
            </div>
          </div>

          {/* Recording Progress */}
          {isRecording && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Recording Progress</span>
                <span>{Math.round(recordingProgress)}%</span>
              </div>
              <Progress value={recordingProgress} className="w-full" />
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test Results</h3>
              <div className="grid gap-4">
                {results.map((result) => {
                  const profile = MIC_PROFILES.find(p => p.id === result.profileId);
                  if (!profile) return null;

                  return (
                    <Card key={result.profileId} className={getColorClass(profile.color)}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={getBadgeVariant(profile.color)}>
                              🎧 {profile.name}
                            </Badge>
                            {getStatusIcon(result.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {result.duration > 0 && `${result.duration.toFixed(1)}s`}
                            {result.wordCount > 0 && ` • ${result.wordCount} words`}
                            {result.confidence && ` • ${(result.confidence * 100).toFixed(1)}% confidence`}
                          </div>
                        </div>

                        {result.status === 'completed' && result.transcription && (
                          <div className="space-y-3">
                            <div className="bg-background/50 p-3 rounded-md text-sm">
                              <div className="font-medium mb-1">Transcription:</div>
                              <div className="whitespace-pre-wrap">{result.transcription}</div>
                            </div>
                            
                            {result.audioUrl && (
                              <div className="flex items-center gap-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const audio = audioRefs.current.get(result.profileId);
                                    if (audio) {
                                      if (audio.paused) {
                                        audio.play();
                                      } else {
                                        audio.pause();
                                      }
                                    }
                                  }}
                                  className="flex items-center gap-2"
                                >
                                  <Volume2 className="h-3 w-3" />
                                  Play Recording
                                </Button>
                                <audio
                                  ref={(el) => {
                                    if (el) audioRefs.current.set(result.profileId, el);
                                  }}
                                  src={result.audioUrl}
                                  controls
                                  className="h-8 flex-1"
                                  preload="metadata"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {result.status === 'error' && result.error && (
                          <div className="bg-red-100 dark:bg-red-900/20 p-3 rounded-md text-sm">
                            <div className="font-medium mb-1 text-red-700 dark:text-red-400">Error:</div>
                            <div className="text-red-600 dark:text-red-300">{result.error}</div>
                          </div>
                        )}

                        {result.status === 'recording' && (
                          <div className="text-sm text-muted-foreground animate-pulse">
                            Recording audio from this input source...
                          </div>
                        )}

                        {result.status === 'processing' && (
                          <div className="text-sm text-muted-foreground animate-pulse">
                            Processing audio through Whisper AI...
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};