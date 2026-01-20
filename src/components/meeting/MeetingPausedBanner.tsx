import React from 'react';
import { Pause, MicOff, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MeetingPausedBannerProps {
  onResume: () => void;
  className?: string;
}

export const MeetingPausedBanner: React.FC<MeetingPausedBannerProps> = ({
  onResume,
  className,
}) => {
  return (
    <div
      className={cn(
        'w-full rounded-lg border-2 border-amber-500 bg-amber-500/10 p-4 shadow-md',
        className
      )}
    >
      <div className="flex flex-col items-center text-center gap-2">
        {/* Icons */}
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-amber-500/20 p-2 animate-pulse">
            <Pause className="h-5 w-5 text-amber-600" />
          </div>
          <div className="rounded-full bg-destructive/20 p-2 animate-pulse">
            <MicOff className="h-5 w-5 text-destructive" />
          </div>
        </div>

        {/* Primary Message */}
        <h2 className="text-lg font-bold text-amber-600">
          Meeting Paused – Not Listening
        </h2>

        {/* Secondary Message */}
        <p className="text-sm text-muted-foreground max-w-md">
          Audio capture is <strong className="text-foreground">completely stopped</strong>. 
          Any spoken content will <strong className="text-destructive">NOT</strong> be recorded whilst paused.
        </p>

        {/* Resume Button */}
        <Button
          size="default"
          onClick={onResume}
          className="mt-1 gap-2 px-6 py-2"
        >
          <Play className="h-4 w-4" />
          Resume Recording
        </Button>
      </div>
    </div>
  );
};
