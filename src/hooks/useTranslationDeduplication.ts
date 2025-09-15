import { useRef, useEffect } from 'react';

interface ConversationTracking {
  activeMessages: Map<string, { user: string; agent?: string; timestamp: number }>;
  sessionStartTime: number;
}

export const useTranslationDeduplication = () => {
  // Bulletproof Deduplication System
  const processedExchangeIds = useRef<Set<string>>(new Set());
  const processedMessageIds = useRef<Set<string>>(new Set());
  const conversationExchangeMap = useRef<Map<string, { timestamp: number; processed: boolean }>>(new Map());
  const lastProcessedTimestamp = useRef<number>(0);

  // Enhanced conversation tracking with data loss prevention
  const conversationTrackingRef = useRef<ConversationTracking>({
    activeMessages: new Map(),
    sessionStartTime: Date.now()
  });

  // Add cleanup interval to prevent memory leaks
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const CLEANUP_AGE = 300000; // 5 minutes
      
      // Clean up old exchange map entries
      for (const [key, entry] of conversationExchangeMap.current.entries()) {
        if (now - entry.timestamp > CLEANUP_AGE) {
          conversationExchangeMap.current.delete(key);
        }
      }
      
      // Clean up old message IDs more aggressively
      if (processedMessageIds.current.size > 30) {
        const idsArray = Array.from(processedMessageIds.current);
        processedMessageIds.current.clear();
        // Keep only the most recent 10 entries
        idsArray.slice(-10).forEach(id => processedMessageIds.current.add(id));
      }
      
      console.log('🧹 Memory cleanup completed - Exchange map size:', conversationExchangeMap.current.size, 'Message IDs:', processedMessageIds.current.size);
    }, 60000); // Run every minute
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Bulletproof deduplication helper functions
  const createExchangeId = (userMessage: string, agentResponse: string): string => {
    const contentHash = btoa(userMessage.trim() + '|||' + agentResponse.trim())
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 16);
    const timestamp = Math.floor(Date.now() / 1000);
    return `${timestamp}_${contentHash}`;
  };

  const createContentHash = (text: string): string => {
    return btoa(text.trim()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
  };

  const isWithinTimeWindow = (timestamp: number, windowMs: number = 2000): boolean => {
    return Math.abs(Date.now() - timestamp) < windowMs;
  };

  const resetMemory = () => {
    processedExchangeIds.current.clear();
    processedMessageIds.current.clear();
    conversationExchangeMap.current.clear();
    lastProcessedTimestamp.current = 0;
    conversationTrackingRef.current.activeMessages.clear();
    conversationTrackingRef.current.sessionStartTime = Date.now();
  };

  return {
    processedExchangeIds,
    processedMessageIds,
    conversationExchangeMap,
    lastProcessedTimestamp,
    conversationTrackingRef,
    createExchangeId,
    createContentHash,
    isWithinTimeWindow,
    resetMemory
  };
};
