import { Button } from "@/components/ui/button";
import { ConsultationType } from "@/types/scribe";
import { Pause, Play, Square, Maximize2 } from "lucide-react";

interface MinimalRecordingStateProps {
  duration: number;
  wordCount: number;
  isPaused: boolean;
  formatDuration: (seconds: number) => string;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onExpandView: () => void;
}

export const MinimalRecordingState = ({
  duration,
  wordCount,
  isPaused,
  formatDuration,
  onPause,
  onResume,
  onFinish,
  onExpandView,
}: MinimalRecordingStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-180px)] px-4">
      {/* Expand button in corner */}
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onExpandView}
          className="text-muted-foreground hover:text-foreground"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Main content - centered */}
      <div className="flex flex-col items-center justify-center flex-1 -mt-16">
        {/* Recording indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`
            w-3 h-3 rounded-full 
            ${isPaused 
              ? 'bg-amber-500' 
              : 'bg-destructive animate-pulse'
            }
          `} />
          <span className="text-sm text-muted-foreground">
            {isPaused ? 'Paused' : 'Recording'}
          </span>
        </div>

        {/* Large timer */}
        <div className="font-mono text-6xl sm:text-7xl font-bold tracking-tight mb-4">
          {formatDuration(duration)}
        </div>

        {/* Word count */}
        <div className="text-xl text-muted-foreground">
          {wordCount.toLocaleString()} words
        </div>
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-sm pb-8">
        <div className="flex items-center justify-center gap-6">
          {/* Pause/Resume button */}
          <Button
            variant="outline"
            onClick={isPaused ? onResume : onPause}
            className="w-14 h-14 p-0 rounded-full"
          >
            {isPaused ? (
              <Play className="h-6 w-6" />
            ) : (
              <Pause className="h-6 w-6" />
            )}
          </Button>
          
          {/* Finish button */}
          <Button
            onClick={onFinish}
            className="h-14 px-8 gap-2 bg-primary hover:bg-primary/90 text-lg"
          >
            <Square className="h-5 w-5" />
            Finish
          </Button>
        </div>
      </div>
    </div>
  );
};
