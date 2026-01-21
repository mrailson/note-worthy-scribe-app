import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, FileText, Loader2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminDictateViewToggleProps {
  showCleaned: boolean;
  onToggle: () => void;
  autoCleanEnabled: boolean;
  onAutoCleanChange: (enabled: boolean) => void;
  hasCleanedContent: boolean;
  isFormatting: boolean;
  onManualClean?: () => void;
}

export const AdminDictateViewToggle: React.FC<AdminDictateViewToggleProps> = ({
  showCleaned,
  onToggle,
  autoCleanEnabled,
  onAutoCleanChange,
  hasCleanedContent,
  isFormatting,
  onManualClean,
}) => {
  const canToggle = hasCleanedContent && !isFormatting;

  return (
    <div className="flex items-center gap-2">
      {/* View Toggle Buttons */}
      <div className="flex items-center border rounded-lg p-1 bg-muted/50">
        <Button
          variant={!showCleaned ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggle}
          disabled={!canToggle}
          className="h-7 px-3 text-xs gap-1.5"
        >
          <FileText className="w-3 h-3" />
          Original
        </Button>
        <Button
          variant={showCleaned ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggle}
          disabled={!canToggle}
          className="h-7 px-3 text-xs gap-1.5"
        >
          <Sparkles className="w-3 h-3" />
          Cleaned
        </Button>
      </div>

      {/* Status Badge */}
      {isFormatting ? (
        <Badge variant="outline" className="gap-1.5 text-xs">
          <Loader2 className="w-3 h-3 animate-spin" />
          Cleaning...
        </Badge>
      ) : hasCleanedContent ? (
        <Badge variant="secondary" className="gap-1.5 text-xs text-primary">
          <Sparkles className="w-3 h-3" />
          AI Cleaned
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs">
          Raw Transcript
        </Badge>
      )}

      {/* Manual Clean Button (when auto-clean is off) */}
      {!autoCleanEnabled && !hasCleanedContent && onManualClean && (
        <Button
          variant="outline"
          size="sm"
          onClick={onManualClean}
          disabled={isFormatting}
          className="h-7 text-xs gap-1.5"
        >
          <Sparkles className="w-3 h-3" />
          Clean Now
        </Button>
      )}

      {/* Settings Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Settings2 className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56">
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Formatting Settings</h4>
            
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="auto-clean" className="text-sm">
                Auto-clean after recording
              </Label>
              <Switch
                id="auto-clean"
                checked={autoCleanEnabled}
                onCheckedChange={onAutoCleanChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically format and clean your dictation when you stop recording.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
