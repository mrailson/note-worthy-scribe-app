import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Trash2, Save, Clock, Type, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}: DictationQuickActionsProps) {
  const hasContent = content.trim().length > 0;

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50 border',
      isRecording && 'bg-primary/5 border-primary/20'
    )}>
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
      </div>
    </div>
  );
}
