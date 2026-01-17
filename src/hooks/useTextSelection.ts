import { useState, useEffect, useCallback, RefObject } from 'react';

export interface TextSelectionState {
  text: string;
  rect: DOMRect | null;
  isValid: boolean;
}

interface UseTextSelectionOptions {
  minWords?: number;
  maxWords?: number;
  enabled?: boolean;
}

/**
 * Hook to detect and validate text selections within a container.
 * Returns selection details including position for popup placement.
 */
export function useTextSelection(
  containerRef: RefObject<HTMLElement>,
  options: UseTextSelectionOptions = {}
): { selection: TextSelectionState; clearSelection: () => void } {
  const { minWords = 1, maxWords = 3, enabled = true } = options;
  
  const [selection, setSelection] = useState<TextSelectionState>({
    text: '',
    rect: null,
    isValid: false,
  });

  const clearSelection = useCallback(() => {
    setSelection({ text: '', rect: null, isValid: false });
  }, []);

  const validateWordCount = useCallback((text: string): boolean => {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length >= minWords && words.length <= maxWords;
  }, [minWords, maxWords]);

  useEffect(() => {
    if (!enabled) return;

    const handleMouseUp = (event: MouseEvent) => {
      // Small delay to ensure selection is complete
      requestAnimationFrame(() => {
        const windowSelection = window.getSelection();
        
        if (!windowSelection || windowSelection.isCollapsed) {
          clearSelection();
          return;
        }

        const selectedText = windowSelection.toString().trim();
        
        if (!selectedText) {
          clearSelection();
          return;
        }

        // Check if selection is within our container
        const container = containerRef.current;
        if (!container) {
          clearSelection();
          return;
        }

        const range = windowSelection.getRangeAt(0);
        const commonAncestor = range.commonAncestorContainer;
        
        // Verify selection is within our container
        const isWithinContainer = container.contains(
          commonAncestor.nodeType === Node.TEXT_NODE 
            ? commonAncestor.parentElement 
            : commonAncestor
        );

        if (!isWithinContainer) {
          clearSelection();
          return;
        }

        // Validate word count
        const isValidWordCount = validateWordCount(selectedText);

        if (!isValidWordCount) {
          clearSelection();
          return;
        }

        // Get selection rectangle for positioning
        const rect = range.getBoundingClientRect();

        setSelection({
          text: selectedText,
          rect,
          isValid: true,
        });
      });
    };

    // Listen on document to catch all mouseup events
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, enabled, validateWordCount, clearSelection]);

  // Clear selection when clicking outside or pressing Escape
  useEffect(() => {
    if (!selection.isValid) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
        window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selection.isValid, clearSelection]);

  // Clear selection on scroll/resize to avoid stale DOMRect causing "jumping" popups
  useEffect(() => {
    if (!selection.isValid) return;

    const container = containerRef.current;
    const scrollContainer = (container?.closest?.('[data-radix-scroll-area-viewport]') as HTMLElement | null) || null;

    const clear = () => {
      clearSelection();
      window.getSelection()?.removeAllRanges();
    };

    scrollContainer?.addEventListener('scroll', clear, { passive: true });
    window.addEventListener('resize', clear);

    return () => {
      scrollContainer?.removeEventListener('scroll', clear);
      window.removeEventListener('resize', clear);
    };
  }, [selection.isValid, containerRef, clearSelection]);

  return { selection, clearSelection };
}
