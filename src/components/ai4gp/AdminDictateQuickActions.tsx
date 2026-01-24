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
import { WordIcon } from '@/components/icons/WordIcon';
import { generateMeetingNotesDocx } from '@/utils/generateMeetingNotesDocx';
import { showToast } from '@/utils/toastWrapper';
import { AdminDictateCountdownOverlay } from './AdminDictateCountdownOverlay';

interface AdminDictateQuickActionsProps {
  status: AdminDictationStatus;
  isRecording: boolean;
  isConnecting: boolean;
  hasContent: boolean;
  isFormatting: boolean;
  systemAudioEnabled: boolean;
  content: string;
  cleanedContent: string;
  templateName: string;
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
  content,
  cleanedContent,
  templateName,
  onSystemAudioChange,
  onStart,
  onStop,
  onCopy,
  onClear,
}) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadWord = useCallback(async () => {
    // Always prefer cleaned content for Word export
    const exportContent = cleanedContent || content;
    if (!exportContent) return;
    
    setIsExporting(true);
    try {
      const now = new Date();
      await generateMeetingNotesDocx({
        metadata: {
          title: templateName || 'Dictation',
          date: now.toLocaleDateString('en-GB'),
          time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        },
        content: exportContent,
        filename: `${templateName.toLowerCase().replace(/\s+/g, '-')}-${now.toISOString().split('T')[0]}.docx`,
      });
      showToast.success('Document downloaded');
    } catch (error) {
      console.error('Failed to export Word document:', error);
      showToast.error('Failed to download document');
    } finally {
      setIsExporting(false);
    }
  }, [content, cleanedContent, templateName]);

  const handleStartClick = useCallback(() => {
    // Start countdown AND connection concurrently
    setCountdown(3);
    onStart(); // Start connecting immediately
  }, [onStart]);

  // Handle countdown timer (visual only now, connection starts immediately)
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

  return (
    <>
      {/* Full-screen countdown overlay */}
      {countdown !== null && countdown > 0 && (
        <AdminDictateCountdownOverlay countdown={countdown} />
      )}

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

        {/* Download Word Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownloadWord}
                disabled={!hasContent || isRecording || isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <WordIcon className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download as Word</TooltipContent>
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
    </>
  );
};
