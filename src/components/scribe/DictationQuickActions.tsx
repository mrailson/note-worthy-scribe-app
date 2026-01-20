import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Copy, Trash2, Save, Clock, Type, Sparkles, Loader2, FileText, Mic, Square, Settings, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import type { DictationStatus } from '@/hooks/useDictation';

interface DictationQuickActionsProps {
  content: string;
  wordCount: number;
  duration: number;
  formatDuration: (secs: number) => string;
  onCopyAll: () => void;
  onClear: () => void;
  onSave: () => void;
  onFormatAndClean: () => Promise<void>;
  isRecording: boolean;
  isFormatting: boolean;
  currentSessionId: string | null;
  // New props for dictation control
  status: DictationStatus;
  isConnecting: boolean;
  onStart: () => void;
  onStop: () => void;
  systemAudioEnabled?: boolean;
  onSystemAudioChange?: (enabled: boolean) => void;
}

export function DictationQuickActions({
  content,
  wordCount,
  duration,
  formatDuration,
  onCopyAll,
  onClear,
  onSave,
  onFormatAndClean,
  isRecording,
  isFormatting,
  currentSessionId,
  status,
  isConnecting,
  onStart,
  onStop,
  systemAudioEnabled = false,
  onSystemAudioChange,
}: DictationQuickActionsProps) {
  const hasContent = content.trim().length > 0;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleStartClick = useCallback(() => {
    onStart();
    setCountdown(2);
  }, [onStart]);

  // Handle countdown timer
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCountdown(null);
    }
  }, [countdown]);

  const handleDownloadWord = async () => {
    if (!hasContent) return;

    const lines = content.split('\n');
    const children: Paragraph[] = [];

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      
      // Check if it's a header (starts with ## or is all caps and short)
      if (trimmedLine.startsWith('## ')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine.replace('## ', ''),
                bold: true,
                size: 28,
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          })
        );
      } else if (trimmedLine.startsWith('# ')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine.replace('# ', ''),
                bold: true,
                size: 32,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
          })
        );
      } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        // Bold text (like section headers)
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine.replace(/\*\*/g, ''),
                bold: true,
                size: 24,
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (trimmedLine === '') {
        // Empty line
        children.push(new Paragraph({ children: [] }));
      } else {
        // Regular paragraph
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                size: 24,
              }),
            ],
            spacing: { after: 120 },
          })
        );
      }
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const timestamp = new Date().toISOString().slice(0, 10);
    saveAs(blob, `dictation-${timestamp}.docx`);
  };

  // Countdown overlay
  if (countdown !== null) {
    const circumference = 2 * Math.PI * 44;
    const progress = (2 - countdown) / 2;
    const strokeDashoffset = circumference * (1 - progress);

    return (
      <div className={cn(
        'flex items-center justify-center p-6 rounded-lg bg-primary/5 border border-primary/20'
      )}>
        <div className="flex items-center gap-6">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                className="text-muted-foreground/20"
                strokeWidth="3"
                stroke="currentColor"
                fill="transparent"
                r="28"
                cx="32"
                cy="32"
              />
              <circle
                className="text-primary transition-all duration-1000 ease-linear"
                strokeWidth="3"
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="28"
                cx="32"
                cy="32"
                style={{
                  strokeDasharray: 2 * Math.PI * 28,
                  strokeDashoffset: (2 * Math.PI * 28) * (1 - progress),
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary animate-pulse">
                {countdown}
              </span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-medium text-foreground">Get ready...</span>
            <span className="text-sm text-muted-foreground">
              Recording starts in {countdown} second{countdown !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50 border',
      isRecording && 'bg-primary/5 border-primary/20'
    )}>
      {/* Start/Stop Dictation Button */}
      {isRecording ? (
        <Button
          size="sm"
          variant="destructive"
          onClick={onStop}
          className="gap-2 h-9 px-4 font-medium"
        >
          <Square className="h-4 w-4 fill-current" />
          Stop
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={handleStartClick}
          disabled={isConnecting || countdown !== null}
          className="gap-2 h-9 px-4 font-medium bg-primary hover:bg-primary/90"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">Connecting...</span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              <span className="hidden sm:inline">{hasContent ? 'Continue' : 'Start'}</span>
            </>
          )}
        </Button>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-1.5 text-destructive animate-pulse">
          <div className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-xs font-medium">REC</span>
        </div>
      )}

      <Separator orientation="vertical" className="h-6" />

      {/* Stats */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Type className="h-3.5 w-3.5" />
          <span>{wordCount} words</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatDuration(duration)}</span>
        </div>
        
        {/* Format & Clean Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onFormatAndClean}
              disabled={!hasContent || isRecording || isFormatting}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
            >
              {isFormatting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Format & Clean (AI)</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="h-6 hidden sm:block" />

      {/* Copy Actions */}
      <div className="flex items-center gap-1 ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onCopyAll}
          disabled={!hasContent}
          className="gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Copy All</span>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadWord}
              disabled={!hasContent}
              className="gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Word</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Download as Word document</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {currentSessionId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={!hasContent || isRecording}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={!hasContent && !currentSessionId}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </Button>

        {/* Settings button */}
        {!isRecording && onSystemAudioChange && (
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
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
