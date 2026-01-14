import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Mic, MicOff, RefreshCw, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useMicrophoneSettings } from "@/hooks/useMicrophoneSettings";
import { cn } from "@/lib/utils";

interface MicrophoneSettingsProps {
  onDeviceChange?: (deviceId: string | null) => void;
}

export const MicrophoneSettings = ({ onDeviceChange }: MicrophoneSettingsProps) => {
  const {
    availableDevices,
    selectedDeviceId,
    isTestingMic,
    testVolume,
    testStatus,
    errorMessage,
    permissionStatus,
    enumerateDevices,
    selectDevice,
    startMicTest,
    stopMicTest,
  } = useMicrophoneSettings();

  // Notify parent of device changes
  useEffect(() => {
    onDeviceChange?.(selectedDeviceId);
  }, [selectedDeviceId, onDeviceChange]);

  const handleDeviceChange = (deviceId: string) => {
    selectDevice(deviceId);
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mic className="h-4 w-4" />
          Microphone Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Device selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Microphone</label>
          <div className="flex gap-2">
            <Select
              value={selectedDeviceId || ''}
              onValueChange={handleDeviceChange}
              disabled={availableDevices.length === 0 || permissionStatus === 'denied'}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={
                  permissionStatus === 'denied' 
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
              onClick={enumerateDevices}
              title="Refresh device list"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {availableDevices.length === 0 && permissionStatus !== 'denied' && (
            <p className="text-xs text-muted-foreground">
              Click refresh to detect microphones, or connect a microphone and try again.
            </p>
          )}
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

        {/* Test button and status */}
        <div className="flex items-center gap-3">
          <Button
            variant={isTestingMic ? "destructive" : "secondary"}
            onClick={isTestingMic ? stopMicTest : startMicTest}
            disabled={!selectedDeviceId || permissionStatus === 'denied'}
            className="gap-2"
          >
            {isTestingMic ? (
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
          The selected microphone will be used for all GP Scribe consultations.
        </p>
      </CardContent>
    </Card>
  );
};
