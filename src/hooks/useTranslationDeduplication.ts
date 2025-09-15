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
    try {
      // Use safe Unicode-compatible hashing
      const contentHash = createContentHashSync(userMessage.trim() + '|||' + agentResponse.trim());
      const timestamp = Math.floor(Date.now() / 1000);
      return `${timestamp}_${contentHash}`;
    } catch (error) {
      console.error('Exchange ID creation failed:', error);
      return `${Date.now()}_fallback_${Math.random().toString(36).substr(2, 9)}`;
    }
  };

  /**
   * Creates a robust content hash with Unicode support
   * Fixes btoa crash on French accents and other non-Latin1 characters
   */
  const createContentHash = (text: string): string => {
    return createContentHashSync(text);
  };

  /**
   * Synchronous Unicode-safe hash function
   * Uses simple string hash algorithm instead of base64
   */
  const createContentHashSync = (input: string): string => {
    try {
      let hash = 0;
      const normalized = input.normalize('NFC').trim();
      
      if (normalized.length === 0) return '0';
      
      for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return Math.abs(hash).toString(36).substring(0, 12);
    } catch (error) {
      console.error('Hash creation failed:', error);
      return Date.now().toString(36).substring(0, 8);
    }
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
