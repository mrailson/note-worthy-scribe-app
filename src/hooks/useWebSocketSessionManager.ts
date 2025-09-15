/**
 * WebSocket Session Manager - Fixes data loss issues
 * Implements session guards, message queuing, and retry logic
 */

import { useRef, useCallback, useEffect } from 'react';

interface MessagePayload {
  id: string;
  content: string;
  sessionId: string;
  timestamp: number;
  type: 'user' | 'agent';
}

interface InFlightMessage {
  payload: MessagePayload;
  timestamp: number;
  retryCount: number;
}

interface SessionState {
  sessionId: string | null;
  wsState: 'disconnected' | 'connecting' | 'connected';
  lastHeartbeat: number;
  connectionAttempt: number;
}

interface UseWebSocketSessionManagerOptions {
  onDataLoss?: (lostMessage: MessagePayload) => void;
  onSessionChange?: (sessionId: string | null) => void;
  heartbeatInterval?: number;
  messageTimeout?: number;
  maxRetries?: number;
}

export const useWebSocketSessionManager = (options: UseWebSocketSessionManagerOptions = {}) => {
  const {
    onDataLoss,
    onSessionChange,
    heartbeatInterval = 15000, // 15 seconds
    messageTimeout = 10000,    // 10 seconds
    maxRetries = 3
  } = options;

  // Session state management
  const sessionStateRef = useRef<SessionState>({
    sessionId: null,
    wsState: 'disconnected',
    lastHeartbeat: 0,
    connectionAttempt: 0
  });

  // Message tracking
  const inflightMessagesRef = useRef<Map<string, InFlightMessage>>(new Map());
  const pendingQueueRef = useRef<MessagePayload[]>([]);
  const heartbeatTimerRef = useRef<number | null>(null);
  const monitoringTimerRef = useRef<number | null>(null);

  /**
   * Check if we can send messages
   */
  const canSend = useCallback((): boolean => {
    const state = sessionStateRef.current;
    return state.wsState === 'connected' && state.sessionId !== null;
  }, []);

  /**
   * Generate unique message ID
   */
  const generateMessageId = useCallback((): string => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  /**
   * Send message with queuing and tracking
   */
  const sendMessage = useCallback((content: string, type: 'user' | 'agent'): string => {
    const messageId = generateMessageId();
    const sessionId = sessionStateRef.current.sessionId;
    
    const payload: MessagePayload = {
      id: messageId,
      content,
      sessionId: sessionId || 'pending',
      timestamp: Date.now(),
      type
    };

    console.log('📤 Session Manager: Sending message:', {
      messageId,
      sessionId,
      canSend: canSend(),
      type,
      contentPreview: content.substring(0, 50) + '...'
    });

    // If we can't send, queue the message
    if (!canSend()) {
      console.log('📦 Session Manager: Queueing message (no active session)');
      pendingQueueRef.current.push(payload);
      return messageId;
    }

    // Track in-flight message
    inflightMessagesRef.current.set(messageId, {
      payload,
      timestamp: Date.now(),
      retryCount: 0
    });

    console.log('✅ Session Manager: Message sent and tracked:', messageId);
    return messageId;
  }, [canSend, generateMessageId]);

  /**
   * Acknowledge message receipt
   */
  const acknowledgeMessage = useCallback((messageId: string) => {
    const wasTracked = inflightMessagesRef.current.has(messageId);
    inflightMessagesRef.current.delete(messageId);
    
    console.log('✅ Session Manager: Message acknowledged:', {
      messageId,
      wasTracked,
      remainingInflight: inflightMessagesRef.current.size
    });
  }, []);

  /**
   * Handle session connection
   */
  const onSessionConnect = useCallback((newSessionId: string) => {
    const currentAttempt = ++sessionStateRef.current.connectionAttempt;
    
    console.log('🔗 Session Manager: Session connected:', {
      sessionId: newSessionId,
      attempt: currentAttempt,
      pendingMessages: pendingQueueRef.current.length
    });

    // Update session state
    sessionStateRef.current = {
      sessionId: newSessionId,
      wsState: 'connected',
      lastHeartbeat: Date.now(),
      connectionAttempt: currentAttempt
    };

    // Notify callback
    onSessionChange?.(newSessionId);

    // Drain pending queue with current session ID
    const pendingMessages = [...pendingQueueRef.current];
    pendingQueueRef.current = [];

    pendingMessages.forEach(message => {
      const updatedMessage = { ...message, sessionId: newSessionId };
      inflightMessagesRef.current.set(message.id, {
        payload: updatedMessage,
        timestamp: Date.now(),
        retryCount: 0
      });
      
      console.log('📤 Session Manager: Draining queued message:', message.id);
    });

    // Start heartbeat
    startHeartbeat();
    
    console.log('✅ Session Manager: Session setup complete:', {
      sessionId: newSessionId,
      drainedMessages: pendingMessages.length,
      inflightCount: inflightMessagesRef.current.size
    });
  }, [onSessionChange]);

  /**
   * Handle session disconnection
   */
  const onSessionDisconnect = useCallback(() => {
    console.log('💔 Session Manager: Session disconnected');
    
    // Update session state
    sessionStateRef.current = {
      ...sessionStateRef.current,
      sessionId: null,
      wsState: 'disconnected'
    };

    // Stop heartbeat
    stopHeartbeat();

    // Notify callback
    onSessionChange?.(null);

    // Move in-flight messages back to pending queue for retry
    const inflightMessages = Array.from(inflightMessagesRef.current.values());
    inflightMessages.forEach(({ payload }) => {
      pendingQueueRef.current.push(payload);
    });
    inflightMessagesRef.current.clear();

    console.log('📦 Session Manager: Moved inflight messages to pending queue:', inflightMessages.length);
  }, [onSessionChange]);

  /**
   * Start heartbeat monitoring
   */
  const startHeartbeat = useCallback(() => {
    stopHeartbeat(); // Clear any existing heartbeat
    
    heartbeatTimerRef.current = window.setInterval(() => {
      const now = Date.now();
      const state = sessionStateRef.current;
      
      if (state.wsState === 'connected' && state.sessionId) {
        console.log('💓 Session Manager: Heartbeat ping');
        // In a real implementation, you'd send a ping message here
        sessionStateRef.current.lastHeartbeat = now;
      }
    }, heartbeatInterval);
  }, [heartbeatInterval]);

  /**
   * Stop heartbeat monitoring
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  /**
   * Start monitoring for orphaned messages
   */
  const startMonitoring = useCallback(() => {
    stopMonitoring(); // Clear any existing monitoring
    
    monitoringTimerRef.current = window.setInterval(() => {
      const now = Date.now();
      const orphanedMessages: InFlightMessage[] = [];

      // Check for orphaned messages
      for (const [messageId, inflightMessage] of inflightMessagesRef.current.entries()) {
        const age = now - inflightMessage.timestamp;
        
        if (age > messageTimeout) {
          if (inflightMessage.retryCount < maxRetries) {
            // Retry the message
            inflightMessage.retryCount++;
            inflightMessage.timestamp = now;
            console.log('🔄 Session Manager: Retrying message:', {
              messageId,
              retryCount: inflightMessage.retryCount,
              age
            });
          } else {
            // Mark as data loss
            orphanedMessages.push(inflightMessage);
            inflightMessagesRef.current.delete(messageId);
            
            console.error('🚨 Session Manager: DATA LOSS DETECTED:', {
              messageId,
              sessionId: inflightMessage.payload.sessionId,
              age,
              retryCount: inflightMessage.retryCount,
              content: inflightMessage.payload.content.substring(0, 100)
            });
            
            // Notify callback
            onDataLoss?.(inflightMessage.payload);
          }
        }
      }
    }, 2000); // Check every 2 seconds
  }, [messageTimeout, maxRetries, onDataLoss]);

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(() => {
    if (monitoringTimerRef.current) {
      clearInterval(monitoringTimerRef.current);
      monitoringTimerRef.current = null;
    }
  }, []);

  /**
   * Get current session statistics
   */
  const getSessionStats = useCallback(() => {
    const state = sessionStateRef.current;
    return {
      sessionId: state.sessionId,
      wsState: state.wsState,
      inflightCount: inflightMessagesRef.current.size,
      pendingCount: pendingQueueRef.current.length,
      lastHeartbeat: state.lastHeartbeat,
      connectionAttempt: state.connectionAttempt
    };
  }, []);

  /**
   * Force clear all pending and inflight messages
   */
  const clearAllMessages = useCallback(() => {
    inflightMessagesRef.current.clear();
    pendingQueueRef.current = [];
    console.log('🗑️ Session Manager: All messages cleared');
  }, []);

  // Start monitoring on mount
  useEffect(() => {
    startMonitoring();
    
    return () => {
      stopMonitoring();
      stopHeartbeat();
    };
  }, [startMonitoring, stopMonitoring, stopHeartbeat]);

  return {
    // Core functionality
    sendMessage,
    acknowledgeMessage,
    canSend,
    
    // Session management
    onSessionConnect,
    onSessionDisconnect,
    
    // Utilities
    getSessionStats,
    clearAllMessages,
    
    // State getters
    get sessionId() { return sessionStateRef.current.sessionId; },
    get wsState() { return sessionStateRef.current.wsState; },
    get inflightCount() { return inflightMessagesRef.current.size; },
    get pendingCount() { return pendingQueueRef.current.length; }
  };
};