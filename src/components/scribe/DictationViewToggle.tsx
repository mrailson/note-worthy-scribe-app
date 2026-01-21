import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, Loader2, Wand2, Settings2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DictationViewToggleProps {
  showCleaned: boolean;
  onToggle: () => void;
  autoCleanEnabled: boolean;
  onAutoCleanChange: (enabled: boolean) => void;
  hasCleanedContent: boolean;
  isFormatting: boolean;
  onManualClean?: () => void;
}

export function DictationViewToggle({
  showCleaned,
  onToggle,
  autoCleanEnabled,
  onAutoCleanChange,
  hasCleanedContent,
  isFormatting,
  onManualClean,
}: DictationViewToggleProps) {
  const canShowCleaned = hasCleanedContent && !isFormatting;

  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg border">
      {/* View Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => showCleaned && onToggle()}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
            !showCleaned
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Original
        </button>

        <div className="h-4 w-px bg-border" />

        <button
          onClick={() => !showCleaned && canShowCleaned && onToggle()}
          disabled={!canShowCleaned}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
            showCleaned && canShowCleaned
              ? 'bg-background text-foreground shadow-sm'
              : !canShowCleaned
              ? 'text-muted-foreground/50 cursor-not-allowed'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Cleaned
        </button>

        {/* Status badge */}
        {isFormatting ? (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Cleaning...
          </Badge>
        ) : showCleaned && hasCleanedContent ? (
          <Badge variant="default" className="gap-1 bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-3 w-3" />
            Magic Cleaned
          </Badge>
        ) : !hasCleanedContent && !autoCleanEnabled ? (
          <Badge variant="outline" className="gap-1">
            <FileText className="h-3 w-3" />
            Raw Transcript
          </Badge>
        ) : null}
      </div>

      {/* Right side: Manual clean button (if needed) + Settings */}
      <div className="flex items-center gap-2">
        {/* Manual clean button - show when auto-clean is off and no cleaned content */}
        {!autoCleanEnabled && !hasCleanedContent && !isFormatting && onManualClean && (
          <Button
            variant="outline"
            size="sm"
            onClick={onManualClean}
            className="gap-1.5"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Clean Now
          </Button>
        )}

        {/* Settings popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Cleaning Settings</h4>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="auto-clean" className="text-sm text-muted-foreground">
                  Auto-clean on stop
                </Label>
                <Switch
                  id="auto-clean"
                  checked={autoCleanEnabled}
                  onCheckedChange={onAutoCleanChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {autoCleanEnabled
                  ? 'Transcripts are automatically cleaned when you stop recording.'
                  : 'You can manually clean transcripts after recording.'}
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
