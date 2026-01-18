import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Mic, Square, Loader2, Monitor, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DictationStatus } from '@/hooks/useDictation';

interface DictationControlsProps {
  status: DictationStatus;
  isRecording: boolean;
  isConnecting: boolean;
  onStart: () => void;
  onStop: () => void;
  hasContent: boolean;
  systemAudioEnabled?: boolean;
  onSystemAudioChange?: (enabled: boolean) => void;
}

export function DictationControls({
  status,
  isRecording,
  isConnecting,
  onStart,
  onStop,
  hasContent,
  systemAudioEnabled = false,
  onSystemAudioChange,
}: DictationControlsProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleStartClick = useCallback(() => {
    // Start connection immediately AND start countdown in parallel
    onStart();
    setCountdown(2);
  }, [onStart]);

  // Handle countdown timer - purely visual, connection already started
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished
      setCountdown(null);
    }
  }, [countdown]);

  // Render countdown animation
  if (countdown !== null) {
    const circumference = 2 * Math.PI * 44; // radius = 44
    const progress = (2 - countdown) / 2; // 0 to 1 over 2 seconds
    const strokeDashoffset = circumference * (1 - progress);

    return (
      <div className="flex flex-col items-center justify-center gap-4 pt-2">
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
            Recording starts in {countdown} second{countdown !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 pt-2">
      <div className="flex items-center justify-center gap-4">
        {isRecording ? (
          <Button
            size="lg"
            variant="destructive"
            onClick={onStop}
            className="gap-2 h-14 px-8 text-lg font-medium"
          >
            <Square className="h-5 w-5 fill-current" />
            Stop Dictation
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleStartClick}
            disabled={isConnecting || countdown !== null}
            className="gap-2 h-14 px-8 text-lg font-medium bg-primary hover:bg-primary/90"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                {hasContent ? 'Continue Dictation' : 'Start Dictation'}
              </>
            )}
          </Button>
        )}

        {isRecording && (
          <div className="flex items-center gap-2 text-destructive animate-pulse">
            <div className="w-3 h-3 rounded-full bg-destructive" />
            <span className="text-sm font-medium">Recording</span>
          </div>
        )}

        {/* Settings button - only show when not recording */}
        {!isRecording && onSystemAudioChange && (
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Recording settings</p>
              </TooltipContent>
            </Tooltip>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Recording Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="system-audio-modal" className="flex items-center gap-2 cursor-pointer">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>Capture PC Audio</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        Include system audio in recording
                      </span>
                    </div>
                  </Label>
                  <Switch
                    id="system-audio-modal"
                    checked={systemAudioEnabled}
                    onCheckedChange={onSystemAudioChange}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
