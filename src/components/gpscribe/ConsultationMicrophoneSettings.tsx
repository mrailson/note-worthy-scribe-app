import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, RefreshCw, Users, Phone, Video, CheckCircle2, AlertCircle } from "lucide-react";
import { ConsultationType } from "@/types/gpscribe";
import { toast } from "sonner";

interface MicrophoneDevice {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

interface ConsultationMicrophoneSettingsProps {
  currentConsultationType: ConsultationType;
  f2fMicrophoneId: string | null;
  telephoneMicrophoneId: string | null;
  videoMicrophoneId: string | null;
  onF2FMicrophoneChange: (deviceId: string | null) => void;
  onTelephoneMicrophoneChange: (deviceId: string | null) => void;
  onVideoMicrophoneChange: (deviceId: string | null) => void;
}

export const ConsultationMicrophoneSettings = ({
  currentConsultationType,
  f2fMicrophoneId,
  telephoneMicrophoneId,
  videoMicrophoneId,
  onF2FMicrophoneChange,
  onTelephoneMicrophoneChange,
  onVideoMicrophoneChange,
}: ConsultationMicrophoneSettingsProps) => {
  const [availableDevices, setAvailableDevices] = useState<MicrophoneDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const enumerateDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      // Request permission first to get device labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tempStream.getTracks().forEach(track => track.stop());
      
      setPermissionStatus('granted');

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map((device, index) => {
          let label = device.label || `Microphone ${index + 1}`;
          // Remove USB vendor:product IDs like (0c76:0063)
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
        toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
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
    };
  }, [enumerateDevices]);

  const getDeviceLabel = (deviceId: string | null) => {
    if (!deviceId) return "System Default";
    const device = availableDevices.find(d => d.deviceId === deviceId);
    return device?.label || "Unknown Device";
  };

  const getActiveTypeLabel = () => {
    switch (currentConsultationType) {
      case 'face-to-face': return 'Face-to-Face';
      case 'telephone': return 'Telephone';
      case 'video': return 'Video';
      default: return currentConsultationType;
    }
  };

  const microphoneConfigs = [
    {
      type: 'face-to-face' as ConsultationType,
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Microphone Access Required
          </CardTitle>
          <CardDescription>
            Please allow microphone access in your browser settings to configure microphones for different consultation types.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={enumerateDevices} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Microphone Settings
            </CardTitle>
            <CardDescription className="mt-1">
              Configure different microphones for each consultation type. The microphone will automatically switch when you change consultation type.
            </CardDescription>
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
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current active indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>
            Currently using <strong className="text-foreground">{getActiveTypeLabel()}</strong> microphone: 
            <span className="text-primary ml-1">
              {getDeviceLabel(
                currentConsultationType === 'face-to-face' ? f2fMicrophoneId :
                currentConsultationType === 'telephone' ? telephoneMicrophoneId : videoMicrophoneId
              )}
            </span>
          </span>
        </div>

        {/* Microphone selectors for each consultation type */}
        <div className="space-y-4">
          {microphoneConfigs.map((config) => {
            const Icon = config.icon;
            const isActive = currentConsultationType === config.type;
            
            return (
              <div
                key={config.type}
                className={`p-4 rounded-lg border transition-colors ${
                  isActive ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.label}</span>
                        {isActive && (
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                      
                      <Select
                        value={config.value || "default"}
                        onValueChange={(value) => config.onChange(value === "default" ? null : value)}
                      >
                        <SelectTrigger className="w-full">
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
              </div>
            );
          })}
        </div>

        {availableDevices.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No microphones detected. Please connect a microphone and click Refresh.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
