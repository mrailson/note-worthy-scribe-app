/**
 * Translation Data Loss Monitor
 * 
 * This utility helps track and prevent translation data loss by monitoring
 * conversations between ElevenLabs and the application storage.
 */

export interface ConversationMessage {
  id: string;
  userMessage: string;
  agentResponse?: string;
  timestamp: number;
  sessionId: string;
  processed: boolean;
}

export class TranslationDataLossMonitor {
  private activeConversations = new Map<string, ConversationMessage>();
  private lostMessages: ConversationMessage[] = [];
  private onDataLoss?: (lostMessage: ConversationMessage) => void;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(onDataLoss?: (lostMessage: ConversationMessage) => void) {
    this.onDataLoss = onDataLoss;
    this.startMonitoring();
  }

  /**
   * Track a new user message
   */
  trackUserMessage(userMessage: string, sessionId: string): string {
    const messageId = this.generateMessageId(userMessage, sessionId);
    
    const conversation: ConversationMessage = {
      id: messageId,
      userMessage,
      timestamp: Date.now(),
      sessionId,
      processed: false
    };

    this.activeConversations.set(messageId, conversation);
    
    console.log('🔍 DATA_MONITOR: User message tracked:', {
      messageId,
      sessionId,
      preview: userMessage.substring(0, 50),
      totalActive: this.activeConversations.size
    });

    return messageId;
  }

  /**
   * Mark agent response received
   */
  trackAgentResponse(messageId: string, agentResponse: string): void {
    const conversation = this.activeConversations.get(messageId);
    if (conversation) {
      conversation.agentResponse = agentResponse;
      console.log('🔍 DATA_MONITOR: Agent response tracked:', {
        messageId,
        preview: agentResponse.substring(0, 50)
      });
    } else {
      console.warn('🚨 DATA_MONITOR: Agent response without tracked user message:', {
        messageId,
        agentPreview: agentResponse.substring(0, 50)
      });
    }
  }

  /**
   * Mark conversation as processed (saved to database)
   */
  markProcessed(messageId: string): void {
    const conversation = this.activeConversations.get(messageId);
    if (conversation) {
      conversation.processed = true;
      console.log('✅ DATA_MONITOR: Message marked as processed:', messageId);
      
      // Remove from active tracking after a delay
      setTimeout(() => {
        this.activeConversations.delete(messageId);
      }, 30000); // Keep for 30 seconds after processing
    }
  }

  /**
   * Find user message by content (for matching with agent responses)
   */
  findUserMessageByContent(userContent: string, sessionId: string): string | null {
    for (const [messageId, conversation] of this.activeConversations.entries()) {
      if (conversation.userMessage === userContent && 
          conversation.sessionId === sessionId && 
          !conversation.agentResponse) {
        return messageId;
      }
    }
    return null;
  }

  /**
   * Start monitoring for data loss
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      const now = Date.now();
      const orphanThreshold = 20000; // Reduced to 20 seconds
      const unprocessedThreshold = 45000; // Reduced to 45 seconds

      for (const [messageId, conversation] of this.activeConversations.entries()) {
        const age = now - conversation.timestamp;

        // Check for orphaned user messages (no agent response)
        if (!conversation.agentResponse && age > orphanThreshold) {
          console.error('🚨 DATA_LOSS: Orphaned user message detected:', {
            messageId,
            userMessage: conversation.userMessage.substring(0, 100),
            ageSeconds: Math.round(age / 1000),
            sessionId: conversation.sessionId,
            totalActive: this.activeConversations.size
          });

          this.lostMessages.push({ ...conversation });
          this.activeConversations.delete(messageId);

          if (this.onDataLoss) {
            this.onDataLoss(conversation);
          }
        }

        // Check for unprocessed complete conversations
        if (conversation.agentResponse && 
            !conversation.processed && 
            age > unprocessedThreshold) {
          console.error('🚨 DATA_LOSS: Unprocessed conversation detected:', {
            messageId,
            userMessage: conversation.userMessage.substring(0, 50),
            agentResponse: conversation.agentResponse.substring(0, 50),
            ageSeconds: Math.round(age / 1000),
            sessionId: conversation.sessionId,
            totalActive: this.activeConversations.size
          });

          this.lostMessages.push({ ...conversation });
          
          if (this.onDataLoss) {
            this.onDataLoss(conversation);
          }
        }
      }
      
      console.log('🔍 DATA_MONITOR: Monitoring check completed -', {
        activeConversations: this.activeConversations.size,
        lostMessages: this.lostMessages.length
      });
    }, 10000); // Check every 10 seconds (more frequent)
  }

  /**
   * Get current monitoring stats
   */
  getStats() {
    return {
      activeConversations: this.activeConversations.size,
      lostMessages: this.lostMessages.length,
      conversationDetails: Array.from(this.activeConversations.values()).map(conv => ({
        id: conv.id,
        hasResponse: !!conv.agentResponse,
        processed: conv.processed,
        age: Date.now() - conv.timestamp,
        sessionId: conv.sessionId
      }))
    };
  }

  /**
   * Get lost messages for recovery
   */
  getLostMessages(): ConversationMessage[] {
    return [...this.lostMessages];
  }

  /**
   * Clear lost messages history
   */
  clearLostMessages(): void {
    this.lostMessages = [];
  }

  /**
   * Stop monitoring
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.activeConversations.clear();
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(userMessage: string, sessionId: string): string {
    const timestamp = Date.now();
    const hash = btoa(userMessage.trim() + sessionId).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    return `${timestamp}_${hash}`;
  }
}

// Export a singleton instance
export const translationDataLossMonitor = new TranslationDataLossMonitor();