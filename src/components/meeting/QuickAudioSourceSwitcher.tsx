import { Button } from "@/components/ui/button";
import { Mic, Monitor, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
export type AudioSourceMode = 'microphone' | 'microphone_and_system' | 'system_only';

interface QuickAudioSourceSwitcherProps {
  currentMode: AudioSourceMode;
  onModeChange: (mode: AudioSourceMode) => Promise<void>;
  isRecording: boolean;
  isSwitching: boolean;
  micCaptured: boolean;
  systemAudioCaptured: boolean;
  disabled?: boolean;
}

export const QuickAudioSourceSwitcher = ({
  currentMode,
  onModeChange,
  isRecording,
  isSwitching,
  micCaptured,
  systemAudioCaptured,
  disabled = false
}: QuickAudioSourceSwitcherProps) => {
  const isMobile = useIsMobile();
  
  if (!isRecording) return null;

  // On mobile, only show microphone option (system audio not supported)
  const allModes: { mode: AudioSourceMode; icon: typeof Mic; label: string; shortLabel: string }[] = [
    { mode: 'microphone', icon: Mic, label: 'Microphone Only', shortLabel: 'Mic' },
    { mode: 'microphone_and_system', icon: Monitor, label: 'Mic + System Audio', shortLabel: 'Mic+Sys' },
  ];
  
  const modes = isMobile 
    ? allModes.filter(m => m.mode === 'microphone')
    : allModes;

  const getButtonClasses = (mode: AudioSourceMode) => {
    const isActive = currentMode === mode;
    const isActiveAndCaptured = isActive && (
      (mode === 'microphone' && micCaptured) ||
      (mode === 'microphone_and_system' && (micCaptured || systemAudioCaptured))
    );
    
    return cn(
      "h-8 px-3 text-xs font-medium transition-all duration-200 border",
      isActive 
        ? isActiveAndCaptured
          ? "bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300"
          : "bg-primary/10 border-primary text-primary"
        : "bg-secondary/50 border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
    );
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-secondary/30 rounded-lg border">
      {isSwitching ? (
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Switching audio...</span>
        </div>
      ) : (
        <>
          {modes.map(({ mode, icon: Icon, label, shortLabel }) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={getButtonClasses(mode)}
                  onClick={() => currentMode !== mode && onModeChange(mode)}
                  disabled={disabled || currentMode === mode}
                >
                  {mode === 'microphone_and_system' ? (
                    <div className="flex items-center gap-1">
                      <Mic className="h-3.5 w-3.5" />
                      <span className="text-xs">+</span>
                      <Monitor className="h-3.5 w-3.5" />
                    </div>
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">{shortLabel}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{label}</p>
                {mode === 'microphone_and_system' && currentMode !== mode && (
                  <p className="text-xs text-muted-foreground mt-1">
                    You'll be prompted to share a tab/window
                  </p>
                )}
                {currentMode === mode && (
                  <p className="text-xs text-green-500 mt-1">Currently active</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </>
      )}
    </div>
  );
};
