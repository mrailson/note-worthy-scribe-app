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
  };
  onApplyCorrection: (correction: {
    original: string;
    replacement: string;
    applyToAll: boolean;
    saveForFuture: boolean;
  }) => void;
  isActive: boolean;
  selectionRootRef?: React.RefObject<HTMLElement>;
}

export const InlineWordCorrector: React.FC<InlineWordCorrectorProps> = ({
  content,
  allTabsContent,
  onApplyCorrection,
  isActive,
  selectionRootRef
}) => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [applyToAll, setApplyToAll] = useState(true);
  const [saveForFuture, setSaveForFuture] = useState(true);
  const [occurrenceCount, setOccurrenceCount] = useState(0);
  const [occurrenceBreakdown, setOccurrenceBreakdown] = useState({ minutes: 0, executive: 0 });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const internalPointerDownRef = useRef(false);

  // Selection handling and global outside click management
  useEffect(() => {
    if (!isActive) return;

    const debug = localStorage.getItem('inlineCorrectorDebug') === '1';
    let timeoutId: any = null;

    const isNodeWithin = (node: Node | null, root: HTMLElement | null): boolean => {
      if (!node || !root) return false;
      let cur: any = node as any;
      while (cur) {
        if (cur === root) return true;
        cur = cur.parentNode || (cur.getRootNode && (cur.getRootNode() as any).host) || null;
      }
      return false;
    };

    const onSelectionChange = () => {
      if (!isActive || showPopup) return;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (!sel || !text || text.length < 2 || text.length > 100 || sel.rangeCount === 0) return;
        const anchorNode = sel.anchorNode as Node | null;

        // Ignore selection inside the popup
        if (isNodeWithin(anchorNode, popupRef.current)) return;

        // If a selection root is provided, only react to selections inside it
        if (selectionRootRef?.current && !isNodeWithin(anchorNode, selectionRootRef.current)) return;

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setSelectedText(text);
        setSelectionRect(rect);
        setReplacement(text);
        countOccurrences(text);
        loadSuggestions(text);
        setShowPopup(true);

        if (debug) console.debug('[InlineCorrector] selectionchange -> open', { text, rect });
      }, 20);
    };

    const onGlobalPointerDown = (e: PointerEvent) => {
      if (!showPopup || !popupRef.current) return;
      const target = e.target as HTMLElement | null;
      const path = (e.composedPath && e.composedPath()) || [];

      const inside = (!!target && typeof (target as any).closest === 'function' && (target as any).closest('[data-inline-corrector="1"]'))
        || path.includes(popupRef.current)
        || popupRef.current.contains(target as any)
        || internalPointerDownRef.current;

      if (debug) console.debug('[InlineCorrector] global pointerdown', { inside, internal: internalPointerDownRef.current });

      if (inside) return;

      setShowPopup(false);
      window.getSelection()?.removeAllRanges();
    };

    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('pointerdown', onGlobalPointerDown as any, false as any);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPopup) {
        setShowPopup(false);
        window.getSelection()?.removeAllRanges();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('pointerdown', onGlobalPointerDown as any, false as any);
      document.removeEventListener('keydown', onKeyDown);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isActive, showPopup, selectionRootRef]);

  // Capture-phase guard on the popup itself to mark internal interactions
  useEffect(() => {
    if (!showPopup || !popupRef.current) return;
    const node = popupRef.current;

    const onPopupPointerDownCapture = (e: PointerEvent) => {
      internalPointerDownRef.current = true;
      // Reset on pointerup instead of requestAnimationFrame for reliable timing
    };

    const onPopupPointerUpCapture = () => {
      // Delay reset to ensure global handler has checked the flag
      setTimeout(() => {
        internalPointerDownRef.current = false;
      }, 150);
    };

    node.addEventListener('pointerdown', onPopupPointerDownCapture as any, { capture: true } as any);
    node.addEventListener('pointerup', onPopupPointerUpCapture as any, { capture: true } as any);
    document.addEventListener('pointerup', onPopupPointerUpCapture as any, { capture: true } as any);
    
    return () => {
      node.removeEventListener('pointerdown', onPopupPointerDownCapture as any, { capture: true } as any);
      node.removeEventListener('pointerup', onPopupPointerUpCapture as any, { capture: true } as any);
      document.removeEventListener('pointerup', onPopupPointerUpCapture as any, { capture: true } as any);
    };
  }, [showPopup]);

  // Calculate popup position with improved viewport containment
  useEffect(() => {
    if (!showPopup || !popupRef.current || !selectionRect) return;

    const PADDING = 16; // Padding from viewport edges

    const calcPosition = () => {
      const popupEl = popupRef.current!;
      const popupHeight = popupEl.offsetHeight;
      const popupWidth = popupEl.offsetWidth;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Always work in fixed (viewport) coordinates — do NOT add scroll offsets
      const sel = window.getSelection();
      const rect = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : selectionRect;

      // Prefer above selection, centred
      let top = rect.top - popupHeight - 8;
      let left = rect.left + (rect.width / 2) - (popupWidth / 2);

      // If above is off-screen, place below
      if (top < PADDING) {
        top = rect.bottom + 8;
        if (top + popupHeight > viewportHeight - PADDING) {
          top = viewportHeight - popupHeight - PADDING;
        }
      }

      // Clamp vertical
      if (top + popupHeight > viewportHeight - PADDING) {
        top = viewportHeight - popupHeight - PADDING;
      }

      // Clamp horizontal
      if (left < PADDING) {
        left = PADDING;
      } else if (left + popupWidth > viewportWidth - PADDING) {
        left = viewportWidth - popupWidth - PADDING;
      }

      setPopupPosition({ top, left });
    };

    // Initial calc
    calcPosition();

    // Reposition on scroll/resize while visible
    const onReposition = () => {
      calcPosition();
    };
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);

    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
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

    const total = style3Matches + style4Matches;

    setOccurrenceCount(total);
    setOccurrenceBreakdown({
      minutes: style3Matches,
      executive: style4Matches
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
      data-inline-corrector="1"
      className="fixed z-[9999] bg-popover rounded-lg shadow-2xl border-2 border-primary p-4 animate-in fade-in duration-200"
      style={{
        top: `${popupPosition.top}px`,
        left: `${popupPosition.left}px`,
        maxWidth: '320px',
        minWidth: '280px',
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto'
      }}
      onMouseDown={(e) => { e.stopPropagation(); (e as any).nativeEvent?.stopImmediatePropagation?.(); }}
      onClick={(e) => { e.stopPropagation(); (e as any).nativeEvent?.stopImmediatePropagation?.(); }}
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
                Minutes: {occurrenceBreakdown.minutes}, Executive: {occurrenceBreakdown.executive}
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
