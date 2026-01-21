import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Mic, 
  MicOff, 
  Copy, 
  Trash2, 
  Settings2, 
  Loader2,
  Monitor
} from 'lucide-react';
import { AdminDictationStatus } from '@/hooks/useAdminDictation';
import { cn } from '@/lib/utils';

interface AdminDictateQuickActionsProps {
  status: AdminDictationStatus;
  isRecording: boolean;
  isConnecting: boolean;
  hasContent: boolean;
  isFormatting: boolean;
  systemAudioEnabled: boolean;
  onSystemAudioChange: (enabled: boolean) => void;
  onStart: () => void;
  onStop: () => void;
  onCopy: () => void;
  onClear: () => void;
}

export const AdminDictateQuickActions: React.FC<AdminDictateQuickActionsProps> = ({
  status,
  isRecording,
  isConnecting,
  hasContent,
  isFormatting,
  systemAudioEnabled,
  onSystemAudioChange,
  onStart,
  onStop,
  onCopy,
  onClear,
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleStartClick = useCallback(() => {
    // Start countdown, then trigger recording
    setCountdown(3);
  }, []);

  // Handle countdown timer
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished, start recording
      setCountdown(null);
      onStart();
    }
  }, [countdown, onStart]);

  // Render countdown overlay
  if (countdown !== null) {
    const circumference = 2 * Math.PI * 44; // radius = 44
    const progress = (3 - countdown) / 3; // 0 to 1 over 3 seconds
    const strokeDashoffset = circumference * (1 - progress);

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-4">
        <div className="relative w-24 h-24">
          {/* Background circle */}
          <svg className="w-24 h-24 transform -rotate-90">
            <circle
              className="text-muted-foreground/20"
              strokeWidth="4"
              stroke="currentColor"
              fill="transparent"
              r="44"
              cx="48"
              cy="48"
            />
            {/* Animated progress circle */}
            <circle
              className="text-primary transition-all duration-1000 ease-linear"
              strokeWidth="4"
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="44"
              cx="48"
              cy="48"
              style={{
                strokeDasharray: circumference,
                strokeDashoffset: strokeDashoffset,
              }}
            />
          </svg>
          {/* Countdown number */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-primary animate-pulse">
              {countdown}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-medium text-foreground">
            Get ready...
          </span>
          <span className="text-sm text-muted-foreground">
            Listening starts in {countdown} second{countdown !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {/* Main Record/Stop Button */}
        {isRecording ? (
          <Button 
            onClick={onStop}
            variant="destructive"
            size="lg"
            className="gap-2 min-w-[140px]"
          >
            <MicOff className="w-4 h-4" />
            Stop
          </Button>
        ) : (
          <Button
            onClick={handleStartClick}
            variant="default"
            size="lg"
            disabled={isConnecting || countdown !== null}
            className={cn(
              "gap-2 min-w-[140px]",
              hasContent && "bg-green-600 hover:bg-green-700"
            )}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                {hasContent ? 'Continue' : 'Start Listening'}
              </>
            )}
          </Button>
        )}

        {/* Listening indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 text-primary">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm font-medium">Listening...</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Copy Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCopy}
                disabled={!hasContent || isRecording}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy to clipboard</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Clear Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClear}
                disabled={!hasContent || isRecording}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear dictation</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Settings Popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings2 className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Dictation Settings</h4>
              
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="system-audio" className="text-sm">
                    Capture system audio
                  </Label>
                </div>
                <Switch
                  id="system-audio"
                  checked={systemAudioEnabled}
                  onCheckedChange={onSystemAudioChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enable to transcribe audio from your computer (e.g., video calls, presentations).
              </p>
            </div>
          </PopoverContent>
        </Popover>

        {/* Formatting indicator */}
        {isFormatting && (
          <div className="flex items-center gap-2 text-primary text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Formatting...</span>
          </div>
        )}
      </div>
    </div>
  );
};
