import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssemblyRealtimeTickerProps {
  transcript: string;
  status: string;
  confidence: number;
  isEnabled: boolean;
  className?: string;
}

const statusIcons = {
  idle: Mic,
  connecting: Activity,
  connected: CheckCircle,
  recording: Mic,
  error: AlertCircle,
  stopped: Mic
};

const statusColors = {
  idle: 'text-muted-foreground',
  connecting: 'text-yellow-500 animate-pulse',
  connected: 'text-green-500',
  recording: 'text-green-500 animate-pulse',
  error: 'text-destructive',
  stopped: 'text-muted-foreground'
};

const statusLabels = {
  idle: 'Ready',
  connecting: 'Connecting...',
  connected: 'Connected',
  recording: 'Recording',
  error: 'Error',
  stopped: 'Stopped'
};

export const AssemblyRealtimeTicker: React.FC<AssemblyRealtimeTickerProps> = ({
  transcript,
  status,
  confidence,
  isEnabled,
  className
}) => {
  const StatusIcon = statusIcons[status as keyof typeof statusIcons] || Mic;
  const wordCount = transcript.trim().split(/\s+/).filter(word => word.length > 0).length;

  if (!isEnabled) {
    return (
      <Card className={cn("border-2 border-dashed border-muted-foreground/50", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-muted-foreground">Assembly AI</span>
              <Badge variant="outline" className="text-xs">Disabled</Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Service disabled</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-2 transition-all duration-200", 
      status === 'recording' ? 'border-green-500 shadow-lg shadow-green-500/20' : 
      status === 'error' ? 'border-destructive' : 'border-border',
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-4 w-4", statusColors[status as keyof typeof statusColors])} />
            <span className="font-semibold">Assembly AI</span>
            <Badge 
              variant={status === 'recording' ? 'default' : status === 'error' ? 'destructive' : 'outline'}
              className="text-xs"
            >
              {statusLabels[status as keyof typeof statusLabels]}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {confidence > 0 && (
              <div className="flex items-center gap-1">
                <span>Confidence:</span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    confidence > 0.8 ? "text-green-600" : 
                    confidence > 0.6 ? "text-yellow-600" : "text-red-600"
                  )}
                >
                  {Math.round(confidence * 100)}%
                </Badge>
              </div>
            )}
            {wordCount > 0 && (
              <div className="flex items-center gap-1">
                <span>Words:</span>
                <Badge variant="outline" className="text-xs">
                  {wordCount}
                </Badge>
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          {transcript ? (
            <div className="space-y-2">
              <div className="bg-muted/50 rounded-lg p-3 min-h-[60px] max-h-32 overflow-y-auto">
                <p className="text-sm leading-relaxed">
                  {transcript}
                  {status === 'recording' && (
                    <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 border-2 border-dashed rounded-lg p-3 min-h-[60px] flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                {status === 'recording' ? 'Listening for speech...' : 
                 status === 'connecting' ? 'Connecting to Notewell Transcription Service...' :
                 status === 'error' ? 'Transcription error occurred' :
                 'Real-time transcription will appear here'}
              </p>
            </div>
          )}
        </div>

        {/* Real-time activity indicator */}
        {status === 'recording' && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-1 h-4 bg-green-500 rounded animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-4 bg-green-500 rounded animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-4 bg-green-500 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-green-600 font-medium">Live transcription active</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};