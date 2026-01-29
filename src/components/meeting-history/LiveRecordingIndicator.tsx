import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LiveRecordingIndicatorProps {
  wordCount?: number;
  className?: string;
}

export const LiveRecordingIndicator = ({ wordCount = 0, className }: LiveRecordingIndicatorProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Pulsing red dot */}
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
      </span>
      
      {/* Live badge */}
      <Badge 
        variant="destructive" 
        className="animate-pulse bg-red-500/90 text-white font-medium text-xs px-2 py-0.5"
      >
        LIVE
      </Badge>
      
      {/* Word count display */}
      {wordCount > 0 && (
        <span className="text-xs text-muted-foreground">
          {wordCount.toLocaleString()} words
        </span>
      )}
    </div>
  );
};
