import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Mic, 
  MicOff, 
  Radio, 
  Volume2, 
  Settings,
  Activity,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DualTranscriptionState } from '@/hooks/useDualTranscription';

interface DualRecordingControlsProps {
  state: DualTranscriptionState;
  onStart: () => void;
  onStop: () => void;
  onToggleService: (service: 'assembly' | 'whisper') => void;
  onSetPrimarySource: (source: 'assembly' | 'whisper') => void;
}

const statusIcons = {
  idle: Mic,
  connecting: Activity,
  connected: CheckCircle,
  recording: Mic,
  error: AlertCircle,
  stopped: MicOff
};

const statusColors = {
  idle: 'text-muted-foreground',
  connecting: 'text-yellow-500',
  connected: 'text-green-500',
  recording: 'text-green-500',
  error: 'text-destructive',
  stopped: 'text-muted-foreground'
};

export const DualRecordingControls: React.FC<DualRecordingControlsProps> = ({
  state,
  onStart,
  onStop,
  onToggleService,
  onSetPrimarySource
}) => {
  const AssemblyIcon = statusIcons[state.assemblyStatus as keyof typeof statusIcons] || Radio;
  const WhisperIcon = statusIcons[state.whisperStatus as keyof typeof statusIcons] || Volume2;

  const bothServicesDisabled = !state.assemblyEnabled && !state.whisperEnabled;

  return (
    <div className="space-y-4">
      {/* Main Recording Control */}
      <Card className={cn(
        "transition-all duration-200",
        state.isRecording ? "border-green-500 shadow-lg shadow-green-500/20" : "border-border"
      )}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {state.isRecording ? (
                <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
              Dual Transcription Recording
            </div>
            <Badge variant={state.isRecording ? "default" : "outline"}>
              {state.isRecording ? "Recording" : "Ready"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            {!state.isRecording ? (
              <Button
                onClick={onStart}
                disabled={bothServicesDisabled}
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3"
              >
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={onStop}
                size="lg"
                variant="destructive"
                className="px-8 py-3"
              >
                <MicOff className="h-5 w-5 mr-2" />
                Stop Recording
              </Button>
            )}
          </div>

          {bothServicesDisabled && (
            <div className="text-center text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
              ⚠️ Enable at least one transcription service to start recording
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Transcription Services
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Assembly AI Service */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AssemblyIcon className={cn("h-5 w-5", statusColors[state.assemblyStatus as keyof typeof statusColors])} />
              <div>
                <Label className="text-base font-medium">Assembly AI (Real-time)</Label>
                <p className="text-sm text-muted-foreground">
                  Live streaming transcription with instant results
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant={state.assemblyEnabled ? "default" : "outline"}
                className="text-xs"
              >
                {state.assemblyStatus === 'recording' ? 'Live' : 
                 state.assemblyStatus === 'connecting' ? 'Connecting' :
                 state.assemblyStatus === 'error' ? 'Error' :
                 state.assemblyEnabled ? 'Ready' : 'Disabled'}
              </Badge>
              <Switch
                checked={state.assemblyEnabled}
                onCheckedChange={() => onToggleService('assembly')}
                disabled={state.isRecording}
              />
            </div>
          </div>

          {/* Whisper Service */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WhisperIcon className={cn("h-5 w-5", statusColors[state.whisperStatus as keyof typeof statusColors])} />
              <div>
                <Label className="text-base font-medium">Whisper (Chunked)</Label>
                <p className="text-sm text-muted-foreground">
                  High-accuracy batch processing with detailed transcription
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant={state.whisperEnabled ? "default" : "outline"}
                className="text-xs"
              >
                {state.whisperStatus === 'recording' ? 'Processing' : 
                 state.whisperStatus === 'starting' ? 'Starting' :
                 state.whisperStatus === 'error' ? 'Error' :
                 state.whisperEnabled ? 'Ready' : 'Disabled'}
              </Badge>
              <Switch
                checked={state.whisperEnabled}
                onCheckedChange={() => onToggleService('whisper')}
                disabled={state.isRecording}
              />
            </div>
          </div>

          {/* Primary Source Selection */}
          {state.assemblyEnabled && state.whisperEnabled && (
            <div className="pt-4 border-t">
              <Label className="text-base font-medium mb-3 block">Primary Transcript Source</Label>
              <div className="flex rounded-lg border p-1">
                <Button
                  variant={state.primarySource === 'whisper' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onSetPrimarySource('whisper')}
                  className="flex-1"
                  disabled={state.isRecording}
                >
                  <Volume2 className="h-4 w-4 mr-2" />
                  Whisper
                </Button>
                <Button
                  variant={state.primarySource === 'assembly' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onSetPrimarySource('assembly')}
                  className="flex-1"
                  disabled={state.isRecording}
                >
                  <Radio className="h-4 w-4 mr-2" />
                  Assembly AI
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Choose which transcript to use as the primary source for AI processing and exports
              </p>
            </div>
          )}

          {/* Status Summary */}
          {state.isRecording && (
            <div className="pt-4 border-t space-y-2">
              <Label className="text-sm font-medium">Recording Status</Label>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {state.assemblyEnabled && (
                  <div className="flex justify-between">
                    <span>Assembly AI:</span>
                    <span className={cn(
                      "font-medium",
                      state.assemblyStatus === 'recording' ? "text-green-600" :
                      state.assemblyStatus === 'error' ? "text-red-600" : "text-yellow-600"
                    )}>
                      {state.assemblyTranscript.split(' ').filter(w => w.length > 0).length} words
                    </span>
                  </div>
                )}
                {state.whisperEnabled && (
                  <div className="flex justify-between">
                    <span>Whisper:</span>
                    <span className={cn(
                      "font-medium",
                      state.whisperStatus === 'recording' ? "text-green-600" :
                      state.whisperStatus === 'error' ? "text-red-600" : "text-yellow-600"
                    )}>
                      {state.whisperTranscript.split(' ').filter(w => w.length > 0).length} words
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};