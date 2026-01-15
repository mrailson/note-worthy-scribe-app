import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mic, RefreshCw, Users, Phone, Video, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import { ConsultationType } from "@/types/scribe";

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
}

export const ScribeMicrophoneSettings = ({
  currentConsultationType,
  f2fMicrophoneId,
  telephoneMicrophoneId,
  videoMicrophoneId,
  onF2FMicrophoneChange,
  onTelephoneMicrophoneChange,
  onVideoMicrophoneChange,
}: ScribeMicrophoneSettingsProps) => {
  const [availableDevices, setAvailableDevices] = useState<MicrophoneDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [isOpen, setIsOpen] = useState(false);

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
