import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { userNameCorrections } from '@/utils/UserNameCorrections';

interface SelectionFindReplacePopupProps {
  selectedText: string;
  position: DOMRect;
  getCurrentText: () => string;
  onApply: (updatedText: string) => void;
  onClose: () => void;
  meetingId?: string;
  /** Optional: Current meeting title (for find/replace in title) */
  meetingTitle?: string;
  /** Optional: Callback when meeting title is updated */
  onTitleUpdate?: (updatedTitle: string) => void;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Floating find/replace popup that appears when user selects 1-3 words.
 * Shows occurrence count and allows replacing all with save option.
 */
export function SelectionFindReplacePopup({
  selectedText,
  position,
  getCurrentText,
  onApply,
  onClose,
  meetingId,
  meetingTitle,
  onTitleUpdate,
}: SelectionFindReplacePopupProps) {
  const [replaceWith, setReplaceWith] = useState('');
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Count occurrences of selected text (including in title)
  const { occurrenceCount, titleHasMatch } = React.useMemo(() => {
    const text = getCurrentText();
    let count = 0;
    let titleMatch = false;
    
    if (!selectedText) return { occurrenceCount: 0, titleHasMatch: false };
    
    try {
      const regex = new RegExp(escapeRegex(selectedText), 'gi');
      
      // Count in content
      if (text) {
        const matches = text.match(regex);
        count = matches?.length || 0;
      }
      
      // Check if title contains match
      if (meetingTitle) {
        titleMatch = regex.test(meetingTitle);
        if (titleMatch) count += 1;
      }
      
      return { occurrenceCount: count, titleHasMatch: titleMatch };
    } catch {
      return { occurrenceCount: 0, titleHasMatch: false };
    }
  }, [getCurrentText, selectedText, meetingTitle]);

  // Calculate all matches with context for hover preview
  const matchesWithContext = React.useMemo(() => {
    const text = getCurrentText();
    const matches: { match: string; context: string; location: 'content' | 'title' }[] = [];
    
    if (!selectedText) return matches;
    
    try {
      const regex = new RegExp(escapeRegex(selectedText), 'gi');
      
      // Find matches in content with context
      let match;
      const contentRegex = new RegExp(escapeRegex(selectedText), 'gi');
      while ((match = contentRegex.exec(text)) !== null) {
        const contextChars = 40;
        const start = Math.max(0, match.index - contextChars);
        const end = Math.min(text.length, match.index + match[0].length + contextChars);
        matches.push({
          match: match[0],
          context: text.slice(start, end),
          location: 'content'
        });
      }
      
      // Check title for matches
      if (meetingTitle && regex.test(meetingTitle)) {
        matches.push({
          match: selectedText,
          context: meetingTitle,
          location: 'title'
        });
      }
      
      return matches;
    } catch {
      return matches;
    }
  }, [getCurrentText, selectedText, meetingTitle]);

  // Highlight match within context text
  const highlightMatch = (context: string, matchText: string) => {
    const index = context.toLowerCase().indexOf(matchText.toLowerCase());
    if (index === -1) return <span className="text-muted-foreground">...{context}...</span>;

    const before = context.slice(0, index);
    const match = context.slice(index, index + matchText.length);
    const after = context.slice(index + matchText.length);

    // Determine if we need ellipsis
    const needsStartEllipsis = before.length > 0 && context !== matchText;
    const needsEndEllipsis = after.length > 0;

    return (
      <span className="text-muted-foreground">
        {needsStartEllipsis && '...'}
        {before}
        <mark className="bg-yellow-200 dark:bg-yellow-800 text-foreground px-0.5 rounded">
          {match}
        </mark>
        {after}
        {needsEndEllipsis && '...'}
      </span>
    );
  };

  // Calculate popup position with robust boundary handling
  const popupStyle = React.useMemo(() => {
    const popupWidth = 300;
    const popupHeight = 200; // Slightly taller to account for content
    const safeMargin = 16;
    
    // Calculate centered position below selection
    let left = position.left + (position.width / 2) - (popupWidth / 2);
    let top = position.bottom + safeMargin;
    
    // Clamp horizontal position to stay within viewport
    left = Math.max(safeMargin, Math.min(left, window.innerWidth - popupWidth - safeMargin));
    
    // If popup would go below viewport, position above selection
    if (top + popupHeight > window.innerHeight - safeMargin) {
      top = position.top - popupHeight - safeMargin;
    }
    
    // Final safety clamp for top position
    top = Math.max(safeMargin, Math.min(top, window.innerHeight - popupHeight - safeMargin));
    
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 9999,
    };
  }, [position]);

  // Focus input on mount (prevent scroll jumps inside ScrollArea)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Some browsers will scroll the nearest scroll container when focusing.
      // preventScroll avoids the transcript view "jumping".
      (inputRef.current as any)?.focus?.({ preventScroll: true });
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to avoid immediate close from the selection click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleReplaceAll = useCallback(async () => {
    if (!replaceWith.trim() && replaceWith !== '') {
      toast.error('Please enter replacement text');
      return;
    }

    setIsApplying(true);

    try {
      const currentText = getCurrentText();
      const regex = new RegExp(escapeRegex(selectedText), 'gi');
      const updatedText = currentText.replace(regex, replaceWith);

      // Apply the replacement to content
      onApply(updatedText);
      
      // Also update meeting title if it contains the search term
      if (titleHasMatch && onTitleUpdate && meetingTitle) {
        const updatedTitle = meetingTitle.replace(regex, replaceWith);
        onTitleUpdate(updatedTitle);
      }
      
      toast.success(`Replaced ${occurrenceCount} occurrence${occurrenceCount !== 1 ? 's' : ''}${titleHasMatch ? ' (including title)' : ''}`);

      // Save correction for future if checkbox is checked (separate try/catch so it doesn't block replacement)
      if (saveForFuture && selectedText !== replaceWith) {
        try {
          const saved = await userNameCorrections.addCorrection(selectedText, replaceWith);
          if (saved) {
            toast.success(`Saved correction: "${selectedText}" → "${replaceWith}"`);
          } else {
            toast.error('Replacement applied, but failed to save for future meetings');
          }
        } catch (saveError) {
          console.error('Error saving correction for future:', saveError);
          toast.error('Replacement applied, but failed to save for future meetings');
        }
      }

      onClose();
    } catch (error) {
      console.error('Error applying replacement:', error);
      toast.error('Failed to apply replacement');
    } finally {
      setIsApplying(false);
    }
  }, [selectedText, replaceWith, saveForFuture, getCurrentText, onApply, onClose, occurrenceCount, titleHasMatch, meetingTitle, onTitleUpdate]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleReplaceAll();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleReplaceAll, onClose]);

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      className="bg-popover border border-border rounded-lg shadow-xl p-4 w-[300px] animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate max-w-[150px]" title={selectedText}>
            "{selectedText}"
          </span>
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <Badge 
                variant="secondary" 
                className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
              >
                {occurrenceCount} match{occurrenceCount !== 1 ? 'es' : ''}
              </Badge>
            </HoverCardTrigger>
            <HoverCardContent 
              className="w-80 p-0" 
              side="bottom" 
              align="start"
              sideOffset={8}
            >
              <ScrollArea className="max-h-[200px]">
                <div className="p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    All matches for "{selectedText}"
                  </p>
                  {matchesWithContext.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No matches found</p>
                  ) : (
                    matchesWithContext.map((m, idx) => (
                      <div 
                        key={idx} 
                        className="text-xs border-l-2 border-primary/30 pl-2 py-1"
                      >
                        {m.location === 'title' && (
                          <span className="text-[10px] font-medium text-primary/70 block mb-0.5">
                            [Meeting Title]
                          </span>
                        )}
                        {highlightMatch(m.context, m.match)}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </HoverCardContent>
          </HoverCard>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Replace input */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="replace-input" className="text-xs text-muted-foreground">
            Replace with
          </Label>
          <Input
            ref={inputRef}
            id="replace-input"
            value={replaceWith}
            onChange={(e) => setReplaceWith(e.target.value)}
            placeholder="Enter replacement text..."
            className="mt-1 h-9"
          />
        </div>

        {/* Save for future checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="save-future"
            checked={saveForFuture}
            onCheckedChange={(checked) => setSaveForFuture(checked === true)}
          />
          <Label
            htmlFor="save-future"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Save for future meetings
          </Label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleReplaceAll}
            disabled={isApplying || occurrenceCount === 0}
          >
            {isApplying ? (
              'Applying...'
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Replace All
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
