import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Mic, MicOff, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2, Play, Square, Settings2, Monitor, Headphones } from "lucide-react";
import { useMeetingMicrophoneSettings, AudioSourceMode } from "@/hooks/useMeetingMicrophoneSettings";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface MeetingMicrophoneSettingsProps {
  onDeviceChange?: (deviceId: string | null) => void;
  onAudioSourceChange?: (mode: AudioSourceMode) => void;
  currentAudioSource?: AudioSourceMode;
}

export const MeetingMicrophoneSettings = ({ onDeviceChange, onAudioSourceChange, currentAudioSource }: MeetingMicrophoneSettingsProps) => {
  const {
    availableDevices,
    selectedDeviceId,
    audioSourceMode,
    isTestingMic,
    testVolume,
    waveformData,
    testStatus,
    errorMessage,
    permissionStatus,
    recordedAudioUrl,
    isPlayingBack,
    enumerateDevices,
    selectDevice,
    selectAudioSource,
    startMicTest,
    stopMicTest,
    playRecordedAudio,
    stopPlayback,
  } = useMeetingMicrophoneSettings(currentAudioSource);

  // Sync internal state from parent when currentAudioSource prop changes
  useEffect(() => {
    if (currentAudioSource && currentAudioSource !== audioSourceMode) {
      selectAudioSource(currentAudioSource);
    }
  }, [currentAudioSource]);

  // Notify parent of device changes
  useEffect(() => {
    onDeviceChange?.(selectedDeviceId);
  }, [selectedDeviceId, onDeviceChange]);

  const handleDeviceChange = (deviceId: string) => {
    selectDevice(deviceId);
  };

  const handleAudioSourceChange = (mode: string) => {
    selectAudioSource(mode as AudioSourceMode);
    onAudioSourceChange?.(mode as AudioSourceMode);
  };

  const getStatusIcon = () => {
    switch (testStatus) {
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'testing':
        return <Mic className="h-4 w-4 text-primary animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (testStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'testing':
        return 'Listening... Speak now';
      case 'success':
        return 'Microphone working!';
      case 'error':
        return errorMessage || 'Test failed';
      default:
        return 'Click to test your microphone';
    }
  };

  const getVolumeBarColor = () => {
    if (testVolume > 70) return 'bg-green-500';
    if (testVolume > 30) return 'bg-primary';
    if (testVolume > 10) return 'bg-amber-500';
    return 'bg-muted-foreground';
  };

  return (
    <Sheet>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-xs">
          <p className="font-medium">Microphone Settings</p>
          <p className="text-xs text-muted-foreground">Select and test your recording device</p>
        </TooltipContent>
      </Tooltip>
      
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Microphone Settings
          </SheetTitle>
        </SheetHeader>
        
        <div className="space-y-6">
          {/* Permission denied warning */}
          {permissionStatus === 'denied' && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Microphone access denied</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Please allow microphone access in your browser settings, then refresh the page.
                </p>
              </div>
            </div>
          )}

          {/* Audio Source selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Audio Source</Label>
            <Select
              value={audioSourceMode}
              onValueChange={handleAudioSourceChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select audio source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="microphone">
                  <div className="flex items-center gap-2">
                    <Mic className="h-3 w-3 text-muted-foreground" />
                    <span>Microphone Only</span>
                  </div>
                </SelectItem>
                <SelectItem value="microphone_and_system">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-3 w-3 text-muted-foreground" />
                    <span>Microphone + System Audio</span>
                  </div>
                </SelectItem>
                <SelectItem value="system_only">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-3 w-3 text-muted-foreground" />
                    <span>System Audio Only</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {audioSourceMode === 'microphone' && 'Record your voice only - ideal for in-person meetings'}
              {audioSourceMode === 'microphone_and_system' && 'Record your voice and computer audio - ideal for Teams/Zoom calls'}
              {audioSourceMode === 'system_only' && 'Record computer audio only - ideal for watching recordings'}
            </p>
          </div>

          {/* Device selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Select Microphone</Label>
            <div className="flex gap-2">
              <Select
                value={selectedDeviceId || ''}
                onValueChange={handleDeviceChange}
                disabled={availableDevices.length === 0 || permissionStatus === 'denied' || audioSourceMode === 'system_only'}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={
                    audioSourceMode === 'system_only'
                      ? 'Not required for system audio'
                      : permissionStatus === 'denied' 
                        ? 'Permission denied' 
                        : availableDevices.length === 0 
                          ? 'No microphones found' 
                          : 'Select a microphone'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {availableDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      <div className="flex items-center gap-2">
                        <Mic className="h-3 w-3 text-muted-foreground" />
                        <span>{device.label}</span>
                        {device.isDefault && (
                          <span className="text-xs text-muted-foreground">(Default)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => enumerateDevices()}
                title="Refresh device list"
                disabled={audioSourceMode === 'system_only'}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {availableDevices.length === 0 && permissionStatus !== 'denied' && audioSourceMode !== 'system_only' && (
              <p className="text-xs text-muted-foreground">
                Click refresh to detect microphones, or connect a microphone and try again.
              </p>
            )}
          </div>

          {/* Animated Waveform Visualiser */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Audio Waveform</label>
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
          </div>

          {/* Volume meter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Input Level</label>
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
          </div>

          {/* System audio info banner */}
          {(audioSourceMode === 'microphone_and_system' || audioSourceMode === 'system_only') && (
            <div className="flex items-start gap-2 p-3 bg-primary/10 border border-primary/20 rounded-md text-sm">
              <Monitor className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-primary">System Audio Capture</p>
                <p className="text-muted-foreground text-xs mt-1">
                  When you click "Test Audio", a screen share dialog will appear. Select a tab or window and <strong>check "Share audio"</strong> to capture system sound.
                </p>
              </div>
            </div>
          )}

          {/* Test button and status */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant={isTestingMic ? "destructive" : "secondary"}
              onClick={isTestingMic ? stopMicTest : startMicTest}
              disabled={(audioSourceMode !== 'system_only' && !selectedDeviceId) || permissionStatus === 'denied'}
              className="gap-2"
            >
              {isTestingMic ? (
                <>
                  <MicOff className="h-4 w-4" />
                  Stop Test
                </>
              ) : (
                <>
                  {audioSourceMode === 'system_only' ? <Monitor className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  Test Audio
                </>
              )}
            </Button>
            
            {/* Playback button */}
            {recordedAudioUrl && testStatus === 'success' && (
              <Button
                variant="outline"
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
            
            <div className="flex items-center gap-2 text-sm">
              {getStatusIcon()}
              <span className={cn(
                testStatus === 'success' && 'text-green-600 dark:text-green-400',
                testStatus === 'error' && 'text-destructive',
                testStatus === 'testing' && 'text-primary',
                testStatus === 'idle' && 'text-muted-foreground'
              )}>
                {getStatusText()}
              </span>
            </div>
          </div>

          {/* Help text */}
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> For best results, use a headset microphone and speak clearly. 
            The selected microphone will be used for all meeting recordings.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
