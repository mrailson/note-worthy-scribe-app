import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock } from 'lucide-react';

interface TimelineSegment {
  start: number;
  end: number;
  text: string;
  chunkNumber?: number;
}

interface TranscriptTimelineProps {
  segments: TimelineSegment[];
  currentTime?: number;
  onJumpToTime?: (time: number) => void;
  className?: string;
}

/**
 * Formats seconds into MM:SS format
 */
const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Interactive timeline component for transcript navigation
 * Displays segments along a timeline with timestamps
 */
export const TranscriptTimeline: React.FC<TranscriptTimelineProps> = ({
  segments,
  currentTime,
  onJumpToTime,
  className = ''
}) => {
  if (!segments || segments.length === 0) {
    return (
      <div className={`w-full border rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm">No timeline data available</span>
        </div>
      </div>
    );
  }

  const totalDuration = segments.length > 0 ? segments[segments.length - 1].end : 0;
  
  return (
    <div className={`w-full border rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4" />
        <h3 className="font-semibold text-sm">Timeline</h3>
        <Badge variant="outline" className="ml-auto text-xs">
          {formatTimestamp(totalDuration)} total
        </Badge>
      </div>
      
      {/* Timeline bar */}
      <div className="relative h-12 bg-muted rounded-lg overflow-hidden mb-4">
        {segments.map((seg, i) => {
          const leftPercent = totalDuration > 0 ? (seg.start / totalDuration) * 100 : 0;
          const widthPercent = totalDuration > 0 ? ((seg.end - seg.start) / totalDuration) * 100 : 0;
          
          return (
            <button
              key={i}
              className="absolute h-full px-0.5 hover:bg-primary/30 border-r border-background transition-colors"
              style={{ 
                left: `${leftPercent}%`,
                width: `${widthPercent}%`
              }}
              onClick={() => onJumpToTime?.(seg.start)}
              title={`${formatTimestamp(seg.start)} - ${seg.text.substring(0, 50)}...`}
            >
              <div className="h-full bg-primary/10 hover:bg-primary/20" />
            </button>
          );
        })}
        
        {/* Current time indicator */}
        {currentTime !== undefined && totalDuration > 0 && (
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
            style={{ left: `${(currentTime / totalDuration) * 100}%` }}
          />
        )}
      </div>
      
      {/* Segment list */}
      <ScrollArea className="h-48">
        <div className="space-y-2">
          {segments.map((seg, i) => (
            <div 
              key={i}
              className="flex items-start gap-2 p-2 hover:bg-muted/50 rounded text-sm group cursor-pointer"
              onClick={() => onJumpToTime?.(seg.start)}
            >
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-primary/20 shrink-0"
              >
                {formatTimestamp(seg.start)}
              </Badge>
              <p className="flex-1 text-xs text-muted-foreground group-hover:text-foreground line-clamp-2">
                {seg.text}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
