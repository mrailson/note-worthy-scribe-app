import { useState, useCallback, useMemo } from 'react';

export interface CollapsePreferences {
  autoExpand: boolean;
  previewCharCount: number;
  showContentIndicators: boolean;
}

const STORAGE_KEY = 'ai4gp-collapse-preferences';

const DEFAULT_PREFERENCES: CollapsePreferences = {
  autoExpand: false,
  previewCharCount: 400, // ~5-8 lines of text
  showContentIndicators: true,
};

// Minimum content length to trigger collapse behaviour
export const MIN_COLLAPSIBLE_LENGTH = 600;

export function useMessageCollapse() {
  // Track which messages are expanded (by message ID)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  
  // Load preferences from localStorage
  const [preferences, setPreferencesState] = useState<CollapsePreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load collapse preferences:', error);
    }
    return DEFAULT_PREFERENCES;
  });

  // Save preferences to localStorage
  const setPreferences = useCallback((updates: Partial<CollapsePreferences>) => {
    setPreferencesState(prev => {
      const newPrefs = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
      } catch (error) {
        console.error('Failed to save collapse preferences:', error);
      }
      return newPrefs;
    });
  }, []);

  // Check if a message should be collapsible based on content length
  const isCollapsible = useCallback((content: string): boolean => {
    return content.length >= MIN_COLLAPSIBLE_LENGTH;
  }, []);

  // Check if a message is currently expanded
  const isExpanded = useCallback((messageId: string, content: string): boolean => {
    // If auto-expand is on, all messages are expanded
    if (preferences.autoExpand) return true;
    // If message is too short, it's always expanded (not collapsible)
    if (!isCollapsible(content)) return true;
    // Otherwise check the expanded set
    return expandedMessages.has(messageId);
  }, [preferences.autoExpand, expandedMessages, isCollapsible]);

  // Toggle expansion for a specific message
  const toggleExpanded = useCallback((messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  // Expand a specific message
  const expandMessage = useCallback((messageId: string) => {
    setExpandedMessages(prev => new Set(prev).add(messageId));
  }, []);

  // Collapse a specific message
  const collapseMessage = useCallback((messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      newSet.delete(messageId);
      return newSet;
    });
  }, []);

  // Expand all messages
  const expandAll = useCallback((messageIds: string[]) => {
    setExpandedMessages(new Set(messageIds));
  }, []);

  // Collapse all messages
  const collapseAll = useCallback(() => {
    setExpandedMessages(new Set());
  }, []);

  // Get truncated preview content
  const getPreviewContent = useCallback((content: string): string => {
    if (content.length <= preferences.previewCharCount) {
      return content;
    }
    
    // Try to find a good break point (end of sentence or paragraph)
    const targetLength = preferences.previewCharCount;
    let breakPoint = targetLength;
    
    // Look for paragraph break
    const paragraphBreak = content.lastIndexOf('\n\n', targetLength);
    if (paragraphBreak > targetLength * 0.6) {
      breakPoint = paragraphBreak;
    } else {
      // Look for sentence break
      const sentenceBreak = content.lastIndexOf('. ', targetLength);
      if (sentenceBreak > targetLength * 0.6) {
        breakPoint = sentenceBreak + 1;
      }
    }
    
    return content.substring(0, breakPoint);
  }, [preferences.previewCharCount]);

  // Calculate remaining content stats
  const getContentStats = useCallback((content: string) => {
    const previewLength = Math.min(content.length, preferences.previewCharCount);
    const remainingChars = content.length - previewLength;
    const estimatedLines = Math.ceil(remainingChars / 80); // Rough estimate
    
    return {
      totalChars: content.length,
      previewChars: previewLength,
      remainingChars,
      estimatedLines,
      isLong: content.length > 2000,
      isVeryLong: content.length > 5000,
    };
  }, [preferences.previewCharCount]);

  return {
    preferences,
    setPreferences,
    isCollapsible,
    isExpanded,
    toggleExpanded,
    expandMessage,
    collapseMessage,
    expandAll,
    collapseAll,
    getPreviewContent,
    getContentStats,
  };
}

// Context-free utilities for components that need them
export function shouldCollapseContent(content: string): boolean {
  return content.length >= MIN_COLLAPSIBLE_LENGTH;
}

export function getPreviewText(content: string, maxLength: number = 400): string {
  if (content.length <= maxLength) {
    return content;
  }
  
  // Try to find a good break point
  const paragraphBreak = content.lastIndexOf('\n\n', maxLength);
  if (paragraphBreak > maxLength * 0.6) {
    return content.substring(0, paragraphBreak);
  }
  
  const sentenceBreak = content.lastIndexOf('. ', maxLength);
  if (sentenceBreak > maxLength * 0.6) {
    return content.substring(0, sentenceBreak + 1);
  }
  
  return content.substring(0, maxLength);
}
