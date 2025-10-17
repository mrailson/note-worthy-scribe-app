import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X } from 'lucide-react';
import { medicalTermCorrector } from '@/utils/MedicalTermCorrector';
import { NHS_DEFAULT_RULES } from '@/lib/nhsDefaultRules';

interface InlineWordCorrectorProps {
  content: string;
  allTabsContent: {
    style3: string;
    style4: string;
    style5: string;
  };
  onApplyCorrection: (correction: {
    original: string;
    replacement: string;
    applyToAll: boolean;
    saveForFuture: boolean;
  }) => void;
  isActive: boolean;
}

export const InlineWordCorrector: React.FC<InlineWordCorrectorProps> = ({
  content,
  allTabsContent,
  onApplyCorrection,
  isActive
}) => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [applyToAll, setApplyToAll] = useState(true);
  const [saveForFuture, setSaveForFuture] = useState(true);
  const [occurrenceCount, setOccurrenceCount] = useState(0);
  const [occurrenceBreakdown, setOccurrenceBreakdown] = useState({ minutes: 0, executive: 0, limerick: 0 });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle text selection
  useEffect(() => {
    if (!isActive) return;

    const handleMouseUp = (e: MouseEvent) => {
      // Ignore selections made inside the popup
      if (popupRef.current && popupRef.current.contains(e.target as Node)) {
        return;
      }

      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (text && text.length >= 2 && text.length <= 100) {
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            setSelectedText(text);
            setSelectionRect(rect);
            setReplacement(text);
            countOccurrences(text);
            loadSuggestions(text);
            setShowPopup(true);
          }
        }
      }, 10);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (!showPopup || !popupRef.current) return;
      
      const target = e.target as Node;
      // Don't close if clicking inside the popup or any of its child elements
      if (popupRef.current.contains(target)) {
        e.stopPropagation();
        return;
      }
      
      setShowPopup(false);
      window.getSelection()?.removeAllRanges();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPopup) {
        setShowPopup(false);
        window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, showPopup]);

  // Calculate popup position with improved viewport containment
  useEffect(() => {
    if (showPopup && selectionRect && popupRef.current) {
      const popupHeight = popupRef.current.offsetHeight;
      const popupWidth = popupRef.current.offsetWidth;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      const PADDING = 16; // Padding from viewport edges

      // Start with popup above selection, centered
      let top = selectionRect.top + scrollY - popupHeight - 8;
      let left = selectionRect.left + scrollX + (selectionRect.width / 2) - (popupWidth / 2);

      // If popup would go above viewport, show below selection
      if (top < scrollY + PADDING) {
        top = selectionRect.bottom + scrollY + 8;
        
        // If still going off bottom of viewport, position at bottom with padding
        if (top + popupHeight > scrollY + viewportHeight - PADDING) {
          top = scrollY + viewportHeight - popupHeight - PADDING;
        }
      }
      
      // Ensure popup doesn't go off bottom even when positioned above
      if (top + popupHeight > scrollY + viewportHeight - PADDING) {
        top = scrollY + viewportHeight - popupHeight - PADDING;
      }

      // Adjust horizontal position to stay within viewport
      if (left < scrollX + PADDING) {
        left = scrollX + PADDING;
      } else if (left + popupWidth > scrollX + viewportWidth - PADDING) {
        left = scrollX + viewportWidth - popupWidth - PADDING;
      }

      setPopupPosition({ top, left });
    }
  }, [showPopup, selectionRect]);

  // Focus input when popup opens
  useEffect(() => {
    if (showPopup && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [showPopup]);

  const countOccurrences = (text: string) => {
    const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedText}\\b`, 'gi');

    const style3Matches = (allTabsContent.style3.match(regex) || []).length;
    const style4Matches = (allTabsContent.style4.match(regex) || []).length;
    const style5Matches = (allTabsContent.style5.match(regex) || []).length;

    const total = style3Matches + style4Matches + style5Matches;

    setOccurrenceCount(total);
    setOccurrenceBreakdown({
      minutes: style3Matches,
      executive: style4Matches,
      limerick: style5Matches
    });
  };

  const loadSuggestions = async (text: string) => {
    try {
      // Get suggestions from medical term corrector
      const medicalSuggestions = medicalTermCorrector.getSuggestions(text);
      
      // Check NHS default rules
      const nhsSuggestions = NHS_DEFAULT_RULES
        .filter(rule => rule.find.toLowerCase() === text.toLowerCase())
        .map(rule => rule.replace);

      // Combine and deduplicate
      const allSuggestions = [
        ...medicalSuggestions.map(s => s.correct),
        ...nhsSuggestions
      ];
      const uniqueSuggestions = [...new Set(allSuggestions)].filter(s => 
        s.toLowerCase() !== text.toLowerCase()
      );

      setSuggestions(uniqueSuggestions.slice(0, 3));
    } catch (error) {
      console.error('Error loading suggestions:', error);
      setSuggestions([]);
    }
  };

  const handleApplyCorrection = () => {
    const trimmedReplacement = replacement.trim();
    
    if (selectedText === trimmedReplacement) {
      return;
    }

    onApplyCorrection({
      original: selectedText,
      replacement: trimmedReplacement,
      applyToAll,
      saveForFuture
    });

    setShowPopup(false);
    setSelectedText('');
    setReplacement('');
    window.getSelection()?.removeAllRanges();
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApplyCorrection();
    }
  };

  if (!showPopup || !isActive) return null;

  const popupContent = (
    <div
      ref={popupRef}
      className="fixed z-[9999] bg-popover rounded-lg shadow-2xl border-2 border-primary p-4 animate-in fade-in duration-200"
      style={{
        top: `${popupPosition.top}px`,
        left: `${popupPosition.left}px`,
        maxWidth: '320px',
        minWidth: '280px',
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto'
      }}
      role="dialog"
      aria-label="Word correction popup"
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-6 w-6 p-0"
        onClick={() => {
          setShowPopup(false);
          window.getSelection()?.removeAllRanges();
        }}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Selected text */}
      <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-1">Selected:</p>
        <p className="text-sm font-medium break-words">{selectedText}</p>
      </div>

      <div className="border-t pt-3 mb-3">
        <label className="text-xs text-muted-foreground mb-1.5 block">Replace with:</label>
        <Input
          ref={inputRef}
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={handleKeyPress}
          className="text-sm"
          placeholder="Enter replacement text"
        />
      </div>

      {/* Checkboxes */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start space-x-2">
          <Checkbox
            id="apply-to-all"
            checked={applyToAll}
            onCheckedChange={(checked) => setApplyToAll(checked as boolean)}
          />
          <label
            htmlFor="apply-to-all"
            className="text-xs leading-tight cursor-pointer flex-1"
          >
            Apply to all ({occurrenceCount} occurrence{occurrenceCount !== 1 ? 's' : ''})
            {occurrenceCount > 1 && (
              <span className="block text-muted-foreground mt-0.5">
                Minutes: {occurrenceBreakdown.minutes}, Executive: {occurrenceBreakdown.executive}, Limerick: {occurrenceBreakdown.limerick}
              </span>
            )}
          </label>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="save-for-future"
            checked={saveForFuture}
            onCheckedChange={(checked) => setSaveForFuture(checked as boolean)}
          />
          <label
            htmlFor="save-for-future"
            className="text-xs leading-tight cursor-pointer"
          >
            Save for future corrections
          </label>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-3 pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-1.5">Suggestions:</p>
          <div className="flex gap-1 flex-wrap">
            {suggestions.map((suggestion, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs h-6 px-2"
                onClick={() => setReplacement(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => {
            setShowPopup(false);
            window.getSelection()?.removeAllRanges();
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1 text-xs"
          onClick={handleApplyCorrection}
          disabled={!replacement.trim() || selectedText === replacement.trim()}
        >
          Apply
        </Button>
      </div>
    </div>
  );

  return createPortal(popupContent, document.body);
};
