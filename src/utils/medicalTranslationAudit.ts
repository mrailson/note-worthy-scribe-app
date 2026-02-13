import { safeSetItem } from '@/utils/localStorageManager';

interface AuditEntry {
  id: string;
  timestamp: Date;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  medicalSafetyLevel: 'safe' | 'warning' | 'unsafe';
  servicesUsed: string[];
  warnings: string[];
  userOverride?: {
    applied: boolean;
    reason: string;
    authorizedBy: string;
    timestamp: Date;
  };
  validationResults?: {
    romanianValidator?: any;
    calculationValidator?: any;
    aiReview?: any;
    crossVerification?: any;
  };
}

export class MedicalTranslationAuditTrail {
  private static storageKey = 'medical_translation_audit';

  static logTranslation(entry: Omit<AuditEntry, 'id' | 'timestamp'>): string {
    const auditEntry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...entry
    };

    // Get existing audit log
    const existingLog = this.getAuditLog();
    
    // Add new entry
    existingLog.push(auditEntry);
    
    // Keep only last 100 entries to prevent storage bloat
    if (existingLog.length > 100) {
      existingLog.splice(0, existingLog.length - 100);
    }
    
    // Save to localStorage
    safeSetItem(this.storageKey, JSON.stringify(existingLog));
    
    console.log('Medical translation audit entry logged:', auditEntry.id);
    
    return auditEntry.id;
  }

  static getAuditLog(): AuditEntry[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error reading audit log:', error);
      return [];
    }
  }

  static getEntryById(id: string): AuditEntry | null {
    const log = this.getAuditLog();
    return log.find(entry => entry.id === id) || null;
  }

  static addUserOverride(entryId: string, reason: string, authorizedBy: string): boolean {
    try {
      const log = this.getAuditLog();
      const entryIndex = log.findIndex(entry => entry.id === entryId);
      
      if (entryIndex === -1) {
        console.error('Audit entry not found:', entryId);
        return false;
      }

      log[entryIndex].userOverride = {
        applied: true,
        reason,
        authorizedBy,
        timestamp: new Date()
      };

      safeSetItem(this.storageKey, JSON.stringify(log));
      console.log('User override added to audit entry:', entryId);
      
      return true;
    } catch (error) {
      console.error('Error adding user override:', error);
      return false;
    }
  }

  static getHighRiskTranslations(): AuditEntry[] {
    return this.getAuditLog().filter(entry => 
      entry.medicalSafetyLevel === 'unsafe' || 
      entry.confidence < 0.7 ||
      entry.warnings.some(warning => 
        warning.includes('critical') || 
        warning.includes('unsafe') ||
        warning.includes('error')
      )
    );
  }

  static getRecentTranslations(hours: number = 24): AuditEntry[] {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);
    
    return this.getAuditLog().filter(entry => 
      new Date(entry.timestamp) > cutoff
    );
  }

  static generateComplianceReport(): {
    totalTranslations: number;
    safeTranslations: number;
    warningTranslations: number;
    unsafeTranslations: number;
    averageConfidence: number;
    overridesApplied: number;
    recentActivity: AuditEntry[];
  } {
    const log = this.getAuditLog();
    
    const safeCount = log.filter(e => e.medicalSafetyLevel === 'safe').length;
    const warningCount = log.filter(e => e.medicalSafetyLevel === 'warning').length;
    const unsafeCount = log.filter(e => e.medicalSafetyLevel === 'unsafe').length;
    
    const totalConfidence = log.reduce((sum, entry) => sum + entry.confidence, 0);
    const averageConfidence = log.length > 0 ? totalConfidence / log.length : 0;
    
    const overridesCount = log.filter(e => e.userOverride?.applied).length;
    
    return {
      totalTranslations: log.length,
      safeTranslations: safeCount,
      warningTranslations: warningCount,
      unsafeTranslations: unsafeCount,
      averageConfidence,
      overridesApplied: overridesCount,
      recentActivity: this.getRecentTranslations(24)
    };
  }

  static exportAuditLog(): string {
    const log = this.getAuditLog();
    const report = {
      exportedAt: new Date().toISOString(),
      entries: log,
      summary: this.generateComplianceReport()
    };
    
    return JSON.stringify(report, null, 2);
  }

  static clearAuditLog(): void {
    localStorage.removeItem(this.storageKey);
    console.log('Medical translation audit log cleared');
  }

  static flagForManualReview(entryId: string, reason: string): boolean {
    try {
      const log = this.getAuditLog();
      const entryIndex = log.findIndex(entry => entry.id === entryId);
      
      if (entryIndex === -1) {
        return false;
      }

      if (!log[entryIndex].validationResults) {
        log[entryIndex].validationResults = {};
      }

        // Add manual review flag
        (log[entryIndex].validationResults as any).manualReviewRequired = {
          flagged: true,
          reason,
          flaggedAt: new Date(),
          status: 'pending'
        };

      safeSetItem(this.storageKey, JSON.stringify(log));
      return true;
    } catch (error) {
      console.error('Error flagging for manual review:', error);
      return false;
    }
  }

  static searchTranslations(query: string): AuditEntry[] {
    const log = this.getAuditLog();
    const lowerQuery = query.toLowerCase();
    
    return log.filter(entry => 
      entry.originalText.toLowerCase().includes(lowerQuery) ||
      entry.translatedText.toLowerCase().includes(lowerQuery) ||
      entry.warnings.some(warning => warning.toLowerCase().includes(lowerQuery))
    );
  }
}
