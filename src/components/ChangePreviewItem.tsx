import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, X, ArrowRight } from "lucide-react";
import type { PotentialChange } from "./EnhancedFindReplacePanel";

interface ChangePreviewItemProps {
  change: PotentialChange;
  selected: boolean;
  onSelectionChange: (selected: boolean) => void;
}

export function ChangePreviewItem({
  change,
  selected,
  onSelectionChange
}: ChangePreviewItemProps) {
  const getConfidenceBadgeVariant = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getMatchTypeBadgeVariant = (matchType: string) => {
    switch (matchType) {
      case 'exact': return 'default';
      case 'case': return 'secondary';
      case 'partial': return 'outline';
      default: return 'outline';
    }
  };

  // Highlight the matched text in context
  const highlightContext = (context: string, originalText: string) => {
    const index = context.toLowerCase().indexOf(originalText.toLowerCase());
    if (index === -1) return context;

    const before = context.slice(0, index);
    const match = context.slice(index, index + originalText.length);
    const after = context.slice(index + originalText.length);

    return (
      <>
        {before}
        <mark className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {match}
        </mark>
        {after}
      </>
    );
  };

  return (
    <Card className={`p-2 border transition-all ${
      selected 
        ? 'border-primary bg-primary/5 shadow-sm' 
        : 'border-border hover:border-muted-foreground/50'
    }`}>
      <div className="flex items-center gap-2">
        {/* Selection Checkbox */}
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelectionChange(e.target.checked)}
          className="rounded border-border focus:ring-2 focus:ring-primary shrink-0"
        />

        {/* Change Details */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Replacement Preview */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border truncate max-w-[120px]">
              {change.originalText}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded border truncate max-w-[120px]">
              {change.replacementText}
            </span>
            <div className="flex items-center gap-1 ml-auto shrink-0">
              <Badge 
                variant={getConfidenceBadgeVariant(change.confidence)}
                className="text-[10px] px-1.5 py-0"
              >
                {change.confidence}
              </Badge>
            </div>
          </div>

          {/* Context - single line truncated */}
          <div className="text-[10px] text-muted-foreground font-mono truncate px-1.5 py-0.5 bg-muted/30 rounded">
            ...{highlightContext(change.context, change.originalText)}...
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            onClick={() => onSelectionChange(true)}
            variant={selected ? "default" : "outline"}
            size="sm"
            className="h-6 w-6 p-0"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            onClick={() => onSelectionChange(false)}
            variant={selected ? "outline" : "default"}
            size="sm"
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}