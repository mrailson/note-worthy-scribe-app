import React from 'react';
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
            Stop Recording
          </Button>
        ) : (
          <Button
            onClick={onStart}
            variant="default"
            size="lg"
            disabled={isConnecting}
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
                {hasContent ? 'Continue' : 'Start Recording'}
              </>
            )}
          </Button>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 text-red-600">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Recording</span>
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
              <h4 className="font-medium text-sm">Recording Settings</h4>
              
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
