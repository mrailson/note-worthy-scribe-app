import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Circle } from 'lucide-react';

interface RecordingTimerProps {
  duration: number;
  isRecording: boolean;
}

export const RecordingTimer: React.FC<RecordingTimerProps> = ({
  duration,
  isRecording
}) => {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {isRecording ? (
          <Circle className="h-3 w-3 text-red-500 fill-current animate-pulse" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      
      <Badge 
        variant={isRecording ? "destructive" : "secondary"}
        className="font-mono text-sm"
      >
        {formatDuration(duration)}
      </Badge>
    </div>
  );
};