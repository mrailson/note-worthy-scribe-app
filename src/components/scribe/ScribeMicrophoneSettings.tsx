import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Mic, MicOff, RefreshCw, Users, Phone, Video, CheckCircle2, AlertCircle, ChevronDown, Play, Square, MonitorSpeaker, Loader2, Volume2 } from "lucide-react";
import { ConsultationType } from "@/types/scribe";
import { cn } from "@/lib/utils";
interface MicrophoneDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

interface ScribeMicrophoneSettingsProps {
  currentConsultationType: ConsultationType;
  f2fMicrophoneId: string | null | undefined;
  telephoneMicrophoneId: string | null | undefined;
  videoMicrophoneId: string | null | undefined;
  onF2FMicrophoneChange: (deviceId: string | null) => void;
  onTelephoneMicrophoneChange: (deviceId: string | null) => void;
  onVideoMicrophoneChange: (deviceId: string | null) => void;
  systemAudioEnabled?: boolean;
  onSystemAudioChange?: (enabled: boolean) => void;
}

const WAVEFORM_BARS = 32;

export const ScribeMicrophoneSettings = ({
  currentConsultationType,
  f2fMicrophoneId,
  telephoneMicrophoneId,
  videoMicrophoneId,
  onF2FMicrophoneChange,
  onTelephoneMicrophoneChange,
  onVideoMicrophoneChange,
  systemAudioEnabled = false,
  onSystemAudioChange,
}: ScribeMicrophoneSettingsProps) => {
  const [availableDevices, setAvailableDevices] = useState<MicrophoneDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [isOpen, setIsOpen] = useState(false);

  // Mic test state
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [testVolume, setTestVolume] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(WAVEFORM_BARS).fill(0));
  const [testStatus, setTestStatus] = useState<'idle' | 'connecting' | 'testing' | 'success' | 'error'>('idle');
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [micGain, setMicGain] = useState(100); // 0-200, 100 = normal

  // Refs for mic test
  const testStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTestingRef = useRef<boolean>(false);
  const maxVolumeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const enumerateDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach(track => track.stop());
      
      setPermissionStatus('granted');

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map((device, index) => {
          let label = device.label || `Microphone ${index + 1}`;
          label = label.replace(/\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)\s*/g, '').trim();
          
          return {
            deviceId: device.deviceId,
            label,
            isDefault: device.deviceId === 'default' || index === 0,
          };
        });

      setAvailableDevices(audioInputs);
    } catch (error: any) {
      console.error('Failed to enumerate devices:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    enumerateDevices();
    
    const handleDeviceChange = () => {
      enumerateDevices();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      cleanupTest();
    };
  }, [enumerateDevices]);

  const getDeviceLabel = (deviceId: string | null | undefined) => {
    if (!deviceId) return "System Default";
    const device = availableDevices.find(d => d.deviceId === deviceId);
    return device?.label || "Unknown Device";
  };

  const getActiveTypeLabel = () => {
    switch (currentConsultationType) {
      case 'f2f': return 'Face-to-Face';
      case 'telephone': return 'Telephone';
      case 'video': return 'Video';
      default: return currentConsultationType;
    }
  };

  const getCurrentMicrophoneId = () => {
    switch (currentConsultationType) {
      case 'f2f': return f2fMicrophoneId;
      case 'telephone': return telephoneMicrophoneId;
      case 'video': return videoMicrophoneId;
      default: return null;
    }
  };

  // Cleanup mic test resources
  const cleanupTest = useCallback(() => {
    isTestingRef.current = false;
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(track => track.stop());
      testStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    gainNodeRef.current = null;
  }, []);

  // Start microphone test
  const startMicTest = useCallback(async () => {
    cleanupTest();
    maxVolumeRef.current = 0;
    isTestingRef.current = true;
    audioChunksRef.current = [];
    
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    
    setIsTestingMic(true);
    setTestStatus('connecting');
    setTestVolume(0);
    setWaveformData(new Array(WAVEFORM_BARS).fill(0));
    setRecordedAudioUrl(null);
    setIsPlayingBack(false);

    try {
      const deviceId = getCurrentMicrophoneId();
      
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      };

      testStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      
      audioContextRef.current = new AudioContext();
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;
      
      // Create gain node for volume control
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = micGain / 100;
      
      const source = audioContextRef.current.createMediaStreamSource(testStreamRef.current);
      source.connect(gainNodeRef.current);
      gainNodeRef.current.connect(analyserRef.current);
      
      mediaRecorderRef.current = new MediaRecorder(testStreamRef.current, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.start();
      setTestStatus('testing');

      const frequencyData = new Uint8Array(analyserRef.current.frequencyBinCount);
      const timeDomainData = new Uint8Array(analyserRef.current.frequencyBinCount);

      const updateVolume = () => {
        if (!isTestingRef.current || !analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(frequencyData);
        analyserRef.current.getByteTimeDomainData(timeDomainData);
        
        let sum = 0;
        for (let i = 0; i < timeDomainData.length; i++) {
          const normalized = (timeDomainData[i] - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / timeDomainData.length);
        const volumePercent = Math.min(100, Math.round(rms * 400));
        
        maxVolumeRef.current = Math.max(maxVolumeRef.current, volumePercent);

        const waveform: number[] = [];
        const binsPerBar = Math.floor(frequencyData.length / WAVEFORM_BARS);
        for (let i = 0; i < WAVEFORM_BARS; i++) {
          let barSum = 0;
          for (let j = 0; j < binsPerBar; j++) {
            barSum += frequencyData[i * binsPerBar + j];
          }
          const barAvg = barSum / binsPerBar;
          waveform.push(Math.round((barAvg / 255) * 100));
        }

        setTestVolume(volumePercent);
        setWaveformData(waveform);

        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      animationFrameRef.current = requestAnimationFrame(updateVolume);

      testTimeoutRef.current = setTimeout(() => {
        const maxVolume = maxVolumeRef.current;
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { 
              type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
            });
            const audioUrl = URL.createObjectURL(audioBlob);
            setRecordedAudioUrl(audioUrl);
          };
          mediaRecorderRef.current.stop();
        }
        
        cleanupTest();
        setIsTestingMic(false);
        setTestStatus(maxVolume > 3 ? 'success' : 'error');
        setTestVolume(0);
        setWaveformData(new Array(WAVEFORM_BARS).fill(0));
      }, 5000);

    } catch (error: any) {
      console.error('Failed to start mic test:', error);
      cleanupTest();
      setIsTestingMic(false);
      setTestStatus('error');
    }
  }, [cleanupTest, recordedAudioUrl, getCurrentMicrophoneId, micGain]);

  // Update gain in real-time when slider changes during test
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = micGain / 100;
    }
  }, [micGain]);

  const stopMicTest = useCallback(() => {
    cleanupTest();
    setIsTestingMic(false);
    setTestStatus('idle');
    setTestVolume(0);
    setWaveformData(new Array(WAVEFORM_BARS).fill(0));
  }, [cleanupTest]);

  const playRecordedAudio = useCallback(() => {
    if (!recordedAudioUrl) return;
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    
    audioElementRef.current = new Audio(recordedAudioUrl);
    audioElementRef.current.onplay = () => setIsPlayingBack(true);
    audioElementRef.current.onended = () => setIsPlayingBack(false);
    audioElementRef.current.onpause = () => setIsPlayingBack(false);
    audioElementRef.current.play();
  }, [recordedAudioUrl]);

  const stopPlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setIsPlayingBack(false);
  }, []);

  const getVolumeBarColor = () => {
    if (testVolume > 70) return 'bg-red-500';
    if (testVolume > 40) return 'bg-green-500';
    if (testVolume > 10) return 'bg-primary';
    return 'bg-primary/50';
  };

  const getStatusText = () => {
    switch (testStatus) {
      case 'connecting': return 'Connecting...';
      case 'testing': return 'Speak now...';
      case 'success': return 'Microphone working!';
      case 'error': return 'No audio detected';
      default: return 'Ready to test';
    }
  };

  const microphoneConfigs = [
    {
      type: 'f2f' as ConsultationType,
      label: 'Face-to-Face',
      icon: Users,
      value: f2fMicrophoneId,
      onChange: onF2FMicrophoneChange,
      description: 'For in-person consultations',
    },
    {
      type: 'telephone' as ConsultationType,
      label: 'Telephone',
      icon: Phone,
      value: telephoneMicrophoneId,
      onChange: onTelephoneMicrophoneChange,
      description: 'For phone consultations',
    },
    {
      type: 'video' as ConsultationType,
      label: 'Video',
      icon: Video,
      value: videoMicrophoneId,
      onChange: onVideoMicrophoneChange,
      description: 'For video consultations',
    },
  ];
  if (permissionStatus === 'denied') {
    return (
      <Card className="border-destructive">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-destructive text-base">
            <AlertCircle className="h-5 w-5" />
            Microphone Access Required
          </CardTitle>
          <CardDescription>
            Please allow microphone access in your browser settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={enumerateDevices} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-2 font-semibold">
              <Mic className="h-5 w-5" />
              Microphone Settings
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {getActiveTypeLabel()}: {getDeviceLabel(
                  currentConsultationType === 'f2f' ? f2fMicrophoneId :
                  currentConsultationType === 'telephone' ? telephoneMicrophoneId : videoMicrophoneId
                )}
              </Badge>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <CardDescription>
              Configure different microphones for each consultation type. The microphone will automatically switch when you change consultation type.
            </CardDescription>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>
                  Currently using <strong className="text-foreground">{getActiveTypeLabel()}</strong> microphone
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={enumerateDevices}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Microphone selectors for each consultation type */}
            <div className="space-y-3">
              {microphoneConfigs.map((config) => {
                const Icon = config.icon;
                const isActive = currentConsultationType === config.type;
                
                return (
                  <div
                    key={config.type}
                    className={`p-3 rounded-lg border transition-colors ${
                      isActive ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{config.label}</span>
                          {isActive && (
                            <Badge variant="default" className="text-xs">
                              Active
                            </Badge>
                          )}
                        </div>
                        <Select
                          value={config.value || "default"}
                          onValueChange={(value) => config.onChange(value === "default" ? null : value)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select microphone" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">System Default</SelectItem>
                            {availableDevices.map((device) => (
                              <SelectItem key={device.deviceId} value={device.deviceId}>
                                {device.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* System Audio Option for Telephone/Video */}
            {(currentConsultationType === 'telephone' || currentConsultationType === 'video') && onSystemAudioChange && (
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <MonitorSpeaker className="h-4 w-4" />
                    </div>
                    <div>
                      <Label htmlFor="system-audio" className="font-medium text-sm cursor-pointer">
                        Capture System Audio
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Record audio from phone software (e.g., AccuRx, eConsult)
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="system-audio"
                    checked={systemAudioEnabled}
                    onCheckedChange={onSystemAudioChange}
                  />
                </div>
              </div>
            )}

            {/* Microphone Test Section */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Test Microphone</span>
                <span className={cn(
                  "text-xs",
                  testStatus === 'success' && 'text-green-600 dark:text-green-400',
                  testStatus === 'error' && 'text-destructive',
                  testStatus === 'testing' && 'text-primary',
                  (testStatus === 'idle' || testStatus === 'connecting') && 'text-muted-foreground'
                )}>
                  {getStatusText()}
                </span>
              </div>

              {/* Waveform Visualiser */}
              <div className="relative h-16 bg-muted/50 rounded-lg overflow-hidden border border-border">
                <div className="absolute inset-0 flex items-center justify-center gap-[2px] px-2">
                  {waveformData.map((value, index) => (
                    <div
                      key={index}
                      className={cn(
                        "w-full rounded-full transition-all duration-75",
                        isTestingMic 
                          ? value > 50 
                            ? "bg-green-500" 
                            : value > 20 
                              ? "bg-primary" 
                              : "bg-primary/50"
                          : "bg-muted-foreground/20"
                      )}
                      style={{
                        height: isTestingMic 
                          ? `${Math.max(4, value * 0.6)}%` 
                          : '4%',
                        minHeight: '2px',
                      }}
                    />
                  ))}
                </div>
                {!isTestingMic && testStatus === 'idle' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">
                      Click "Test Microphone" to see waveform
                    </span>
                  </div>
                )}
              </div>

              {/* Mic Gain/Volume Control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Input Gain</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{micGain}%</span>
                </div>
                <Slider
                  value={[micGain]}
                  onValueChange={(value) => setMicGain(value[0])}
                  min={10}
                  max={200}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Quieter</span>
                  <span className={cn(micGain === 100 && "text-primary font-medium")}>Normal</span>
                  <span>Louder</span>
                </div>
              </div>

              {/* Input Level */}
              <div className="space-y-1">
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-75 rounded-full",
                      isTestingMic ? getVolumeBarColor() : 'bg-muted-foreground/30'
                    )}
                    style={{ width: `${testVolume}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>

              {/* Test Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={isTestingMic ? "destructive" : "secondary"}
                  size="sm"
                  onClick={isTestingMic ? stopMicTest : startMicTest}
                  disabled={testStatus === 'connecting'}
                  className="gap-2"
                >
                  {testStatus === 'connecting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : isTestingMic ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Stop Test
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Test Microphone
                    </>
                  )}
                </Button>
                
                {recordedAudioUrl && testStatus === 'success' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={isPlayingBack ? stopPlayback : playRecordedAudio}
                    className="gap-2"
                  >
                    {isPlayingBack ? (
                      <>
                        <Square className="h-4 w-4" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Play Recording
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {availableDevices.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No microphones detected. Please connect a microphone and click Refresh.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
