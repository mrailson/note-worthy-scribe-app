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
        'w-full rounded-lg border-2 border-amber-500 bg-amber-500/10 p-6 shadow-lg',
        className
      )}
    >
      <div className="flex flex-col items-center text-center gap-4">
        {/* Icons */}
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-amber-500/20 p-3 animate-pulse">
            <Pause className="h-8 w-8 text-amber-600" />
          </div>
          <div className="rounded-full bg-destructive/20 p-3 animate-pulse">
            <MicOff className="h-8 w-8 text-destructive" />
          </div>
        </div>

        {/* Primary Message */}
        <h2 className="text-2xl font-bold text-amber-600">
          Meeting Paused – Not Listening
        </h2>

        {/* Secondary Message */}
        <p className="text-muted-foreground max-w-md">
          Audio capture is <strong className="text-foreground">completely stopped</strong>. 
          Any spoken content will <strong className="text-destructive">NOT</strong> be recorded whilst paused.
        </p>

        {/* Resume Button */}
        <Button
          size="lg"
          onClick={onResume}
          className="mt-2 gap-2 text-lg px-8 py-6 h-auto"
        >
          <Play className="h-5 w-5" />
          Resume Recording
        </Button>
      </div>
    </div>
  );
};
