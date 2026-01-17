import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Activity, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptionHealthIndicatorProps {
  healthStatus: 'healthy' | 'warning' | 'critical' | 'inactive';
  timeSinceLastChunk: number;
  totalChunks: number;
  actualChunksPerMinute: number;
  isVisible?: boolean;
}

export const TranscriptionHealthIndicator: React.FC<TranscriptionHealthIndicatorProps> = ({
  healthStatus,
  timeSinceLastChunk,
  totalChunks,
  actualChunksPerMinute,
  isVisible = true
}) => {
  if (!isVisible || healthStatus === 'inactive') {
    return null;
  }

  const getStatusConfig = () => {
    switch (healthStatus) {
      case 'healthy':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          pulseColor: 'bg-green-500',
          label: 'Transcription Active',
          description: 'Audio is being processed normally'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          pulseColor: 'bg-yellow-500',
          label: 'Checking Status',
          description: 'No new transcription for a while'
        };
      case 'critical':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          pulseColor: 'bg-red-500',
          label: 'Transcription Stalled',
          description: 'Check your recording - transcription may have stopped'
        };
      default:
        return {
          icon: Activity,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted/10',
          borderColor: 'border-muted/30',
          pulseColor: 'bg-muted',
          label: 'Inactive',
          description: 'Transcription not active'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  
  const formatTimeSince = (ms: number): string => {
    if (ms < 1000) return 'just now';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s ago`;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-full border transition-all cursor-help",
            config.bgColor,
            config.borderColor,
            healthStatus === 'critical' && "animate-pulse"
          )}
        >
          {/* Pulsing dot indicator */}
          <span className="relative flex h-2.5 w-2.5">
            {healthStatus === 'healthy' && (
              <span 
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  config.pulseColor
                )} 
              />
            )}
            <span 
              className={cn(
                "relative inline-flex rounded-full h-2.5 w-2.5",
                config.pulseColor
              )} 
            />
          </span>
          
          <Icon className={cn("h-3.5 w-3.5", config.color)} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1.5">
          <div className="font-semibold flex items-center gap-2">
            <Icon className={cn("h-4 w-4", config.color)} />
            {config.label}
          </div>
          <p className="text-xs text-muted-foreground">{config.description}</p>
          <div className="text-xs space-y-1 pt-1 border-t border-border/50">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Chunks processed:</span>
              <span className="font-medium">{totalChunks}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Last chunk:</span>
              <span>{formatTimeSince(timeSinceLastChunk)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Chunks/min:</span>
              <span>{actualChunksPerMinute.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
