import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Check, Save } from 'lucide-react';
import { toast } from 'sonner';
import { userNameCorrections } from '@/utils/UserNameCorrections';

interface SelectionFindReplacePopupProps {
  selectedText: string;
  position: DOMRect;
  getCurrentText: () => string;
  onApply: (updatedText: string) => void;
  onClose: () => void;
  meetingId?: string;
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
}: SelectionFindReplacePopupProps) {
  const [replaceWith, setReplaceWith] = useState('');
  const [saveForFuture, setSaveForFuture] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Count occurrences of selected text
  const occurrenceCount = React.useMemo(() => {
    const text = getCurrentText();
    if (!text || !selectedText) return 0;
    
    try {
      const regex = new RegExp(escapeRegex(selectedText), 'gi');
      const matches = text.match(regex);
      return matches?.length || 0;
    } catch {
      return 0;
    }
  }, [getCurrentText, selectedText]);

  // Calculate popup position (below selection, within viewport)
  const popupStyle = React.useMemo(() => {
    const popupWidth = 300;
    const popupHeight = 180;
    const padding = 12;
    
    let left = position.left + (position.width / 2) - (popupWidth / 2);
    let top = position.bottom + padding;
    
    // Keep within horizontal viewport bounds
    if (left < padding) left = padding;
    if (left + popupWidth > window.innerWidth - padding) {
      left = window.innerWidth - popupWidth - padding;
    }
    
    // If popup would go below viewport, show above selection
    if (top + popupHeight > window.innerHeight - padding) {
      top = position.top - popupHeight - padding;
    }
    
    // Ensure top is never negative
    if (top < padding) top = padding;
    
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 9999,
    };
  }, [position]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
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

      // Apply the replacement first (always)
      onApply(updatedText);
      toast.success(`Replaced ${occurrenceCount} occurrence${occurrenceCount !== 1 ? 's' : ''}`);

      // Save correction for future if checkbox is checked (separate try/catch so it doesn't block replacement)
      if (saveForFuture && selectedText !== replaceWith) {
        try {
          await userNameCorrections.addCorrection(selectedText, replaceWith);
          toast.success(`Saved correction: "${selectedText}" → "${replaceWith}"`);
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
  }, [selectedText, replaceWith, saveForFuture, getCurrentText, onApply, onClose, occurrenceCount]);

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
          <span className="text-sm font-medium text-foreground truncate max-w-[180px]" title={selectedText}>
            "{selectedText}"
          </span>
          <Badge variant="secondary" className="text-xs">
            {occurrenceCount} match{occurrenceCount !== 1 ? 'es' : ''}
          </Badge>
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
