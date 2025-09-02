import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Square, Wifi, WifiOff, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { RecordingState } from '../../hooks/useRecordingManager';

interface RecordingControlsProps {
  state: RecordingState;
  onStartRecording: () => Promise<boolean>;
  onStopRecording: () => Promise<boolean>;
  onResetRecording: () => void;
}

export const RecordingControls = ({
  state,
  onStartRecording,
  onStopRecording,
  onResetRecording
}: RecordingControlsProps) => {
  const handleToggleRecording = async () => {
    if (state.isRecording) {
      await onStopRecording();
    } else {
      await onStartRecording();
    }
  };

  const getRecordingStatus = () => {
    if (state.isRecording) {
      return { text: 'Recording', icon: MicOff, variant: 'default' as const, animate: true };
    } else if (state.isStoppingRecording) {
      return { text: 'Stopping...', icon: Loader2, variant: 'secondary' as const, animate: true };
    } else if (state.isCompleting) {
      return { text: 'Completing...', icon: Loader2, variant: 'secondary' as const, animate: true };
    } else if (state.isCompleted && !state.completionError) {
      return { text: 'Completed', icon: CheckCircle, variant: 'default' as const, animate: false };
    } else if (state.completionError) {
      return { text: 'Error', icon: AlertTriangle, variant: 'destructive' as const, animate: false };
    } else {
      return { text: 'Ready', icon: Mic, variant: 'secondary' as const, animate: false };
    }
  };

  const getConnectionStatus = () => {
    if (state.isCompleted && !state.completionError) {
      return { text: 'Saved', icon: CheckCircle, variant: 'default' as const };
    } else if (state.completionError) {
      return { text: 'Save Failed', icon: AlertTriangle, variant: 'destructive' as const };
    } else if (state.isConnected) {
      return { text: 'Connected', icon: Wifi, variant: 'default' as const };
    } else {
      return { text: 'Disconnected', icon: WifiOff, variant: 'destructive' as const };
    }
  };

  const recordingStatus = getRecordingStatus();
  const connectionStatus = getConnectionStatus();

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <Button
          onClick={handleToggleRecording}
          disabled={state.isStoppingRecording || state.isCompleting}
          size="lg"
          variant={state.isRecording ? "destructive" : "default"}
          className="h-16 w-16 rounded-full p-0 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          {state.isRecording ? (
            <Square className="h-8 w-8" />
          ) : (
            <Mic className="h-8 w-8" />
          )}
        </Button>

        {state.transcript && !state.isRecording && !state.isStoppingRecording && !state.isCompleting && (
          <Button
            onClick={onResetRecording}
            variant="outline"
            className="text-muted-foreground hover:text-foreground"
          >
            New Recording
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={recordingStatus.variant}>
          <recordingStatus.icon 
            className={`h-3 w-3 mr-1 ${recordingStatus.animate ? 'animate-pulse' : ''}`} 
          />
          {recordingStatus.text}
        </Badge>

        <Badge variant={connectionStatus.variant}>
          <connectionStatus.icon className="h-3 w-3 mr-1" />
          {connectionStatus.text}
        </Badge>
      </div>

      {state.completionError && (
        <div className="text-sm text-destructive text-center max-w-xs">
          {state.completionError}
        </div>
      )}
    </div>
  );
};