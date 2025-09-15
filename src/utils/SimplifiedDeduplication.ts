/**
 * Simplified Translation Deduplication System
 * 
 * This utility provides essential deduplication while avoiding the data loss
 * issues caused by overly aggressive filtering.
 */

export interface DeduplicationConfig {
  maxRecentEntries: number;
  duplicateWindowMs: number;
  enableLanguageSetupFilter: boolean;
}

export class SimplifiedDeduplicationManager {
  private processedExchangeIds = new Set<string>();
  private recentTranslations: Array<{
    userMessage: string;
    agentResponse: string;
    timestamp: number;
  }> = [];

  constructor(private config: DeduplicationConfig = {
    maxRecentEntries: 20,
    duplicateWindowMs: 5000,
    enableLanguageSetupFilter: true
  }) {}

  shouldProcessTranslation(userMessage: string, agentResponse: string): {
    shouldProcess: boolean;
    reason?: string;
  } {
    console.log('🔍 Deduplication check:', {
      userPreview: userMessage.substring(0, 50),
      agentPreview: agentResponse.substring(0, 50)
    });

    // Check 1: Skip language setup phrases (very specific)
    if (this.config.enableLanguageSetupFilter) {
      const isLanguageSetup = this.isLanguageSetupPhrase(userMessage, agentResponse);
      if (isLanguageSetup) {
        return { shouldProcess: false, reason: 'Language setup phrase' };
      }
    }

    // Check 2: Skip empty messages
    if (userMessage.trim().length === 0 || agentResponse.trim().length === 0) {
      return { shouldProcess: false, reason: 'Empty message' };
    }

    // Check 3: Check for exact recent duplicates
    const currentTime = Date.now();
    const isDuplicate = this.recentTranslations.some(recent => 
      recent.userMessage.trim() === userMessage.trim() &&
      recent.agentResponse.trim() === agentResponse.trim() &&
      (currentTime - recent.timestamp) < this.config.duplicateWindowMs
    );

    if (isDuplicate) {
      return { shouldProcess: false, reason: 'Recent exact duplicate' };
    }

    // All checks passed
    return { shouldProcess: true };
  }

  markProcessed(userMessage: string, agentResponse: string): string {
    const timestamp = Date.now();
    const exchangeId = `${timestamp}_${this.createContentHash(userMessage + agentResponse)}`;
    
    // Add to tracking
    this.processedExchangeIds.add(exchangeId);
    this.recentTranslations.push({
      userMessage: userMessage.trim(),
      agentResponse: agentResponse.trim(),
      timestamp
    });

    // Cleanup old entries
    this.cleanup();

    return exchangeId;
  }

  private isLanguageSetupPhrase(userMessage: string, agentResponse: string): boolean {
    const userLower = userMessage.toLowerCase().trim();
    const agentLower = agentResponse.toLowerCase();

    // Only block very specific setup phrases
    return (
      (userLower === 'german please' || 
       userLower === 'spanish please' || 
       userLower === 'french please' ||
       userLower.includes('which language')) &&
      agentLower.includes('ready')
    );
  }

  private createContentHash(text: string): string {
    // Simple hash that includes timestamp to avoid collisions
    return btoa(text.trim() + Date.now().toString())
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 12);
  }

  private cleanup(): void {
    // Keep only recent entries
    if (this.recentTranslations.length > this.config.maxRecentEntries) {
      this.recentTranslations = this.recentTranslations.slice(-this.config.maxRecentEntries);
    }

    // Keep only recent processed IDs
    if (this.processedExchangeIds.size > this.config.maxRecentEntries) {
      const idsArray = Array.from(this.processedExchangeIds);
      this.processedExchangeIds.clear();
      idsArray.slice(-10).forEach(id => this.processedExchangeIds.add(id));
    }
  }

  getStats() {
    return {
      processedExchanges: this.processedExchangeIds.size,
      recentTranslations: this.recentTranslations.length,
      config: this.config
    };
  }

  reset(): void {
    this.processedExchangeIds.clear();
    this.recentTranslations = [];
    console.log('🗑️ Deduplication system reset');
  }
}

// Export singleton instance
export const simplifiedDeduplication = new SimplifiedDeduplicationManager();
