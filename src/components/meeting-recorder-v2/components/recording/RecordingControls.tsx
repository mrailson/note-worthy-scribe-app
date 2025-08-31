import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Square, Wifi, WifiOff } from 'lucide-react';
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

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-4">
        <Button
          onClick={handleToggleRecording}
          disabled={state.isStoppingRecording}
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

        {state.transcript && !state.isRecording && (
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
        <Badge variant={state.isRecording ? "default" : "secondary"}>
          {state.isRecording ? (
            <>
              <MicOff className="h-3 w-3 mr-1 animate-pulse" />
              Recording
            </>
          ) : (
            <>
              <Mic className="h-3 w-3 mr-1" />
              Ready
            </>
          )}
        </Badge>

        <Badge variant={state.isConnected ? "default" : "destructive"}>
          {state.isConnected ? (
            <>
              <Wifi className="h-3 w-3 mr-1" />
              Connected
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 mr-1" />
              Disconnected
            </>
          )}
        </Badge>
      </div>
    </div>
  );
};