import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Square, 
  Pause, 
  Mic, 
  MicOff, 
  Download, 
  Trash2,
  Loader2
} from 'lucide-react';

interface RecorderControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  isMuted: boolean;
  isTranscribing: boolean;
  transcript?: string;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onToggleMute: () => void;
  onExport: () => void;
  onClear: () => void;
}

export const RecorderControls: React.FC<RecorderControlsProps> = ({
  isRecording,
  isPaused,
  isMuted,
  isTranscribing,
  transcript,
  onStart,
  onStop,
  onPause,
  onResume,
  onToggleMute,
  onExport,
  onClear
}) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {/* Primary Controls */}
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <Button onClick={onStart} size="lg" className="bg-red-600 hover:bg-red-700">
            <Play className="h-5 w-5 mr-2" />
            Start Recording
          </Button>
        ) : (
          <>
            {isPaused ? (
              <Button onClick={onResume} size="lg" variant="default">
                <Play className="h-5 w-5 mr-2" />
                Resume
              </Button>
            ) : (
              <Button onClick={onPause} size="lg" variant="secondary">
                <Pause className="h-5 w-5 mr-2" />
                Pause
              </Button>
            )}
            
            <Button onClick={onStop} size="lg" variant="destructive">
              <Square className="h-5 w-5 mr-2" />
              Stop
            </Button>
          </>
        )}
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Audio Controls */}
      <div className="flex items-center gap-2">
        <Button
          onClick={onToggleMute}
          variant={isMuted ? "destructive" : "outline"}
          size="lg"
          disabled={!isRecording}
        >
          {isMuted ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Export & Clear */}
      <div className="flex items-center gap-2">
        <Button
          onClick={onExport}
          variant="outline"
          size="lg"
          disabled={isRecording || !Boolean(transcript?.trim())}
        >
          <Download className="h-5 w-5 mr-2" />
          Export
        </Button>
        
        <Button
          onClick={onClear}
          variant="outline"
          size="lg"
          disabled={isRecording}
        >
          <Trash2 className="h-5 w-5 mr-2" />
          Clear
        </Button>
      </div>

      {/* Transcription Status */}
      {isTranscribing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Transcribing...
        </div>
      )}
    </div>
  );
};